# BLAST 本地序列比对工具设计

## 概述

为 ABC 育种助手新增 BLAST 序列比对工具，使用本地 BLAST+ 命令行 + subprocess + tabular 输出 + pandas 解析的方案。仅通过 Agent 聊天对话触发，不提供独立 UI 入口。

## 支持的 BLAST 类型

| Program | 查询类型 | 数据库类型 | 用途 |
|---------|---------|-----------|------|
| blastn | 核酸 | 核酸 (nucl) | 核酸序列比对 |
| blastp | 蛋白 | 蛋白 (prot) | 蛋白序列比对 |
| blastx | 核酸 | 蛋白 (prot) | 核酸翻译后比蛋白库 |
| tblastn | 蛋白 | 核酸 (nucl) | 蛋白比核酸翻译库 |

## 工具函数接口

### `blast_search` 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | str | 必填 | FASTA 序列字符串、基因 ID、或上传文件路径 |
| `query_type` | str | `"sequence"` | `"sequence"` / `"gene_id"` / `"file"` |
| `program` | str | `"blastn"` | `"blastn"` / `"blastp"` / `"blastx"` / `"tblastn"` |
| `database` | str | `"MH63"` | 预置数据库名或用户上传的数据库路径 |
| `evalue` | float | `1e-5` | E-value 阈值 |
| `max_hits` | int | `50` | 最大返回比对数 |
| `identity_threshold` | float | `0.0` | 最低相似度百分比过滤（0-100） |

### query_type 处理逻辑

- `"sequence"`：直接写入临时 FASTA 文件作为查询输入
- `"gene_id"`：从预置数据库对应的 FASTA 源文件中提取目标序列
- `"file"`：读取用户通过聊天框拖拽上传的 FASTA 文件路径

## BLAST 调用与输出解析

### 命令构造

```bash
blastn -query /tmp/query.fa -db backend/data/blastdb/MH63 \
  -outfmt "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore qcovs stitle" \
  -evalue 1e-5 -max_target_seqs 50
```

### tabular 字段定义

```
qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore qcovs stitle
```

使用 `pd.read_csv(output, sep='\t', names=[...])` 解析。

### 返回 JSON 结构

```json
{
  "hits": [
    {
      "query_id": "LOC_Os01g01010",
      "subject_id": "MH63_01g000100",
      "identity": 98.5,
      "alignment_length": 1200,
      "mismatches": 18,
      "gap_opens": 0,
      "query_start": 1,
      "query_end": 1200,
      "subject_start": 1,
      "subject_end": 1200,
      "evalue": 0.0,
      "bit_score": 2215.0,
      "query_coverage": 100,
      "subject_title": "MH63 chr1 protein..."
    }
  ],
  "summary": {
    "program": "blastn",
    "database": "MH63",
    "query_count": 1,
    "total_hits": 15,
    "top_hit_identity": 98.5,
    "top_hit_evalue": 0.0
  }
}
```

## 数据库管理

### 存储路径

```
backend/data/blastdb/
├── databases.json          # 数据库元信息配置
├── MH63/                   # 预置核酸数据库
│   ├── MH63RS3.fa          # FASTA 源文件（用于基因 ID 提取）
│   ├── MH63RS3.fa.ndb      # BLAST 索引文件
│   ├── MH63RS3.fa.nhr
│   ├── MH63RS3.fa.nin
│   ├── MH63RS3.fa.nsq
│   └── ...
├── MH63_pep/               # 预置蛋白数据库
│   └── ...
└── user/                   # 用户上传的自定义数据库
    └── ...
```

### databases.json 格式

```json
[
  {
    "name": "MH63",
    "type": "nucl",
    "description": "MH63RS3 水稻基因组",
    "fasta_source": "MH63RS3.fa",
    "programs": ["blastn", "tblastn"]
  },
  {
    "name": "MH63_pep",
    "type": "prot",
    "description": "MH63RS3 蛋白质序列",
    "fasta_source": "MH63RS3_pep.fa",
    "programs": ["blastp", "blastx"]
  }
]
```

### 数据库类型与 program 校验

- `nucl` 数据库：blastn、tblastn 可用
- `prot` 数据库：blastp、blastx 可用
- 不匹配时返回错误提示

### 用户上传数据库

- 用户拖拽 FASTA 文件到聊天框，Agent 判断意图（查询 or 建库）
- 建库时调用 `makeblastdb -in file.fa -dbtype nucl/prot -out backend/data/blastdb/user/dbname`
- 建库完成后更新 databases.json

### 基因 ID 序列提取

- `query_type: "gene_id"` 时，从预置数据库的 FASTA 源文件中按 ID 匹配提取序列
- MVP 阶段使用逐行扫描匹配，后续可优化为索引查找

## Agent 集成

### SYSTEM_PROMPT 更新

在 `backend/app/routers/chat.py` 的 SYSTEM_PROMPT 中增加：

- BLAST 工具使用场景说明（"比对"、"BLAST"、"同源"、"序列相似"等关键词触发）
- 根据用户输入自动选择 program（核酸 → blastn，蛋白 → blastp 等）
- 结果末尾嵌入 `<!-- BLAST_DATA: {...} -->` 注释

### 工具注册

- `backend/app/tools/blast.py`：实现 `blast_search` 函数和 `BLAST_SEARCH_SCHEMA`
- `backend/app/tools/__init__.py`：导出
- `backend/app/agent/analysis_agent.py`：注册到 `TOOL_HANDLERS` 和 `TOOLS`

## 前端改动

### ChatPage.tsx

- 增加解析 `<!-- BLAST_DATA: {...} -->` 注释的逻辑（与 ENRICHMENT_DATA 模式一致）
- 聊天输入框增加拖拽上传 FASTA 文件支持
- 上传成功后，文件路径随消息一起发送给 Agent

### BlastResultCard.tsx（新增）

- 比对命中表格：Subject ID、Identity%、E-value、Bit Score、Coverage%
- 支持排序和搜索
- 可展开行显示比对详情（位置区间、mismatch/gap 信息）

### 文件上传端点

- `POST /api/analysis/upload-fasta`：接收 FASTA 文件，存储到 `backend/data/uploads/`，返回文件路径

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| BLAST+ 未安装 | `{"error": "BLAST+ not installed. Please install ncbi-blast+."}` |
| 数据库不存在 | `{"error": "Database 'xxx' not found."}` |
| 序列格式错误 | `{"error": "Invalid FASTA format."}` |
| 无比对结果 | `{"hits": [], "summary": {...}}`，Agent 说明无命中 |
| subprocess 超时 | 默认 300s 超时，返回超时错误 |
| program 与数据库类型不匹配 | `{"error": "Program 'blastp' requires protein database, but 'MH63' is nucleotide."}` |

## 不在 MVP 范围内

- 比对结果可视化图表（如序列比对图谱）
- 多序列比对（MSA）
- 数据库管理独立 UI 页面
- 批量 BLAST 任务队列
