# 水稻 MH63 本地富集分析设计文档

## 概述

将富集分析从 Enrichr API（仅支持人类/小鼠）改造为基于本地注释文件的水稻 MH63 专用富集分析，支持 GO 功能富集和 KEGG 通路富集。

## 背景

- 当前使用 gseapy + Enrichr API，水稻基因 ID 被映射到 human 库，结果不准确
- MH63 基因 ID 格式为 `OsMH_01G0516300`，非标准 RAP-DB/MSU 格式
- 需要本地注释文件 + 统计检验的方式实现真正的水稻富集分析

## 架构

### 数据流

```
用户基因列表 (OsMH_ IDs)
    ↓
本地注释文件查找 (gene → GO terms / KEGG pathways)
    ↓
Fisher's exact test 超几何检验
    ↓
多重检验校正 (BH/FDR)
    ↓
返回富集结果 JSON（格式与现有前端兼容）
```

### 注释文件

存放于 `backend/data/annotations/`：

| 文件 | 说明 | 格式 |
|------|------|------|
| `mh63_go_annotation.tsv` | gene → GO term 映射 | gene_id, go_id, go_name, go_namespace |
| `mh63_kegg_annotation.tsv` | gene → KEGG pathway 映射 | gene_id, kegg_pathway_id, kegg_pathway_name |
| `go-basic.obo` | GO 本体结构文件 | OBO format |

### 内存数据结构

应用启动时一次性加载：

- `gene2go: Dict[str, Set[str]]` — 基因 → GO term 集合
- `gene2kegg: Dict[str, Set[str]]` — 基因 → KEGG pathway 集合
- `go2genes: Dict[str, Set[str]]` — GO term → 基因集合（反向索引）
- `kegg2genes: Dict[str, Set[str]]` — KEGG pathway → 基因集合（反向索引）
- 背景基因集 = 注释文件中所有有注释的基因

## 富集分析算法

### GO 富集

- 使用 `goatools.go_enrichment.GOEnrichmentStudy`
- Fisher's exact test + BH (Benjamini-Hochberg) FDR 校正
- 支持三个 namespace：biological_process、molecular_function、cellular_component
- 返回 adjusted_pvalue <= pvalue_cutoff 的前 20 条

### KEGG 富集

- 使用 `scipy.stats.fisher_exact` 手动实现
- 2x2 列联表：

```
                  在通路中    不在通路中
用户基因列表        a           b
背景基因集          c           d
```

- `statsmodels.stats.multitest.multipletests` 做 BH 校正
- enrichment_score = -log10(pvalue) * (a / expected)

## 注释文件获取

### GO 注释
- Ensembl Plants BioMart REST API 查询 `oryza_sativa_mh63` 数据集
- 导出字段：ensembl_gene_id、go_id、go_term_name、namespace_1003

### KEGG 注释
- KEGG REST API 获取水稻通路列表：`https://rest.kegg.jp/list/pathway/osa`
- 获取每个通路的基因：`https://rest.kegg.jp/link/genes/pathway`
- 通过 Ensembl BioMart 获取 MH63 gene ID → MSU/RAP ID 映射关系进行 ID 转换

### go-basic.obo
- 从 `http://purl.obolibrary.org/obo/go/go-basic.obo` 下载

### 生成脚本
- `backend/scripts/prepare_annotations.py`：一次性运行生成注释文件
- 生成的文件提交到项目中，用户无需自己运行

## 依赖变更

- 移除：`gseapy`
- 新增：`goatools>=1.4.0`、`statsmodels>=0.14.0`

## 代码改动范围

| 文件 | 改动 |
|------|------|
| `backend/app/tools/enrichment.py` | 重写：移除 gseapy/Enrichr，改用 goatools + scipy 本地分析 |
| `backend/requirements.txt` | 移除 gseapy，新增 goatools、statsmodels |
| `backend/scripts/prepare_annotations.py` | 新增：注释文件下载/生成脚本 |
| `backend/data/annotations/` | 新增：注释文件目录 |
| 前端代码 | 无改动（返回 JSON 格式与现有 EnrichmentResultCard 兼容） |

## 返回格式（保持不变）

```json
{
  "kegg_results": [
    {
      "pathway": "Glycolysis / Gluconeogenesis",
      "pathway_id": "osa00010",
      "gene_count": 5,
      "total_genes": 67,
      "pvalue": 0.001,
      "adjusted_pvalue": 0.01,
      "enrichment_score": 15.2,
      "genes": ["OsMH_01G0000400", "OsMH_02G0001200"]
    }
  ],
  "go_results": [...],
  "summary": {
    "input_gene_count": 100,
    "kegg_significant": 8,
    "go_significant": 25,
    "top_kegg_pathway": "...",
    "top_go_term": "...",
    "organism": "oryza sativa (MH63)",
    "pvalue_cutoff": 0.05
  }
}
```
