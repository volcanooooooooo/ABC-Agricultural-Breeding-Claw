# ABC：基于大语言模型与传统统计双轨验证的农业育种智能分析系统

**作者**：黄程  
**单位**：[所在单位]  
**日期**：2026年4月

---

## 摘要

农业育种研究中，差异表达基因分析、功能富集分析等生物信息学任务对研究人员的计算背景要求较高，制约了非计算背景育种学家的研究效率。本文提出并实现了ABC（Agricultural Breeding Claw）系统——一个面向农业育种场景的AI辅助智能分析平台。该系统以自然语言为交互界面，融合LangChain ReAct Agent框架与千问大语言模型（LLM），构建了"传统统计工具 + LLM推理"双轨并行分析机制，实现了差异表达分析、GO/KEGG功能富集分析、BLAST序列比对等核心生物信息学任务的全流程自动化。系统针对水稻MH63基因组集成了本地化注释数据库，突破了公共富集API不支持非模式生物的局限。实验以水稻OsbZIP23转录因子数据集（GSE242459）为案例，验证了双轨分析的一致性与互补性。结果表明，双轨分析的基因重叠率达到较高水平，LLM推理能够识别传统阈值过滤遗漏的生物学候选基因。ABC系统显著降低了育种研究的计算门槛，为智能化农业育种研究提供了新范式。

**关键词**：大语言模型；农业育种；差异表达分析；双轨验证；生物信息学；自然语言交互

---

## Abstract

Bioinformatics tasks such as differential gene expression analysis and functional enrichment analysis in agricultural breeding research require substantial computational expertise, limiting the research efficiency of non-computational biologists. This paper presents ABC (Agricultural Breeding Claw), an AI-assisted intelligent analysis platform for agricultural breeding scenarios. Using natural language as the interaction interface, ABC integrates the LangChain ReAct Agent framework with the Qianwen large language model (LLM) to construct a dual-track parallel analysis mechanism combining traditional statistical tools and LLM reasoning. The system automates the full pipeline of core bioinformatics tasks including differential expression analysis, GO/KEGG functional enrichment analysis, and BLAST sequence alignment. A localized annotation database for the rice MH63 genome is integrated, overcoming the limitation of public enrichment APIs that do not support non-model organisms. Using the rice OsbZIP23 transcription factor dataset (GSE242459) as a case study, the consistency and complementarity of dual-track analysis are validated. Results show that the gene overlap rate between the two tracks is high, and LLM reasoning can identify biologically meaningful candidate genes missed by strict statistical thresholds. The ABC system significantly lowers the computational barrier for breeding research and provides a new paradigm for intelligent agricultural breeding.

**Keywords**: Large Language Model; Agricultural Breeding; Differential Expression Analysis; Dual-track Validation; Bioinformatics; Natural Language Interaction

---

## 1. 引言

农业育种是保障粮食安全的核心科学领域。随着高通量测序技术的普及，转录组学数据的规模急剧增长，差异表达基因（Differentially Expressed Genes, DEGs）分析已成为解析作物性状形成机制的标准手段[1]。然而，现有生物信息学工具（如DESeq2[2]、edgeR[3]）通常以R语言命令行或Python脚本形式提供，对使用者的编程能力有较高要求。对于以田间实验为主的育种学家而言，这一技术门槛严重制约了数据分析效率。

近年来，以GPT-4[4]、千问[5]为代表的大语言模型（Large Language Models, LLMs）在自然语言理解与代码生成方面展现出强大能力，为生物信息学工具的智能化改造提供了新机遇。已有研究探索了LLM在基因功能注释[6]、文献挖掘[7]和临床决策支持[8]中的应用，但将LLM深度集成到农业育种分析流程、并与传统统计方法进行系统性对比验证的工作尚属空白。

本文的主要贡献如下：

1. **提出双轨并行分析架构**：将传统统计分析（t检验 + log2FC过滤）与LLM推理分析并行执行，通过一致性分析量化两种方法的互补性，为结果可信度提供交叉验证依据。

2. **构建自然语言驱动的育种分析平台**：基于LangChain ReAct Agent框架，实现从自然语言指令到多步骤生物信息学分析的全自动化流程，支持差异表达分析、GO/KEGG富集分析和BLAST序列比对的链式调用。

3. **集成水稻本地化注释数据库**：针对水稻MH63基因组构建本地GO/KEGG注释库，解决公共富集API（如Enrichr）不支持非模式生物的问题，实现离线富集分析。

4. **设计用户反馈闭环学习机制**：通过基因级别的用户反馈聚合，构建历史知识库，为后续分析提供上下文感知的智能提示。

本文其余部分组织如下：第2节回顾相关工作；第3节介绍系统总体架构；第4节详述核心技术方法；第5节报告实验结果；第6节讨论系统局限性与未来工作；第7节总结全文。

---

## 2. 相关工作

### 2.1 生物信息学分析工具

差异表达分析领域，DESeq2[2]和edgeR[3]是最广泛使用的R包，基于负二项分布模型对RNA-seq计数数据建模。limma-voom[9]则通过方差稳定化变换支持线性模型框架。这些工具统计严谨，但均以编程接口为主，缺乏面向非计算用户的友好交互层。

功能富集分析方面，clusterProfiler[10]、g:Profiler[11]和Enrichr[12]是主流工具。其中Enrichr提供Web API，但主要支持人类和小鼠等模式生物，对水稻等农作物的支持有限。goatools[13]提供了基于Python的本地GO富集分析能力，是本系统富集分析模块的核心依赖。

### 2.2 LLM在生物医学中的应用

BioGPT[14]是专门针对生物医学文献预训练的语言模型，在生物医学关系抽取和问答任务上表现优异。Med-PaLM 2[15]在医学问答基准上达到专家级水平。在基因组学领域，Nucleotide Transformer[16]将LLM预训练范式引入DNA序列建模。然而，上述工作主要聚焦于文本理解或序列建模，尚未将LLM与传统统计分析工具深度集成用于农业育种场景。

### 2.3 AI辅助科学研究平台

Galaxy[17]是面向生命科学的工作流平台，提供图形化界面封装命令行工具，但不支持自然语言交互。Bioconductor[18]提供了丰富的R包生态，但同样依赖编程接口。近期，基于LLM的科学助手如ChemCrow[19]（化学领域）和BioPlanner[20]（实验规划）展示了Agent框架在科学研究中的潜力。本系统在此基础上，针对农业育种场景设计了专用工具集和双轨验证机制，填补了该领域的空白。

---

## 3. 系统架构

### 3.1 总体架构

ABC系统采用前后端分离的B/S架构，由四个核心层组成：

```
┌─────────────────────────────────────────────────────┐
│                    表示层                            │
│  React 18 + TypeScript + Recharts + React Flow      │
│  对话界面 | 火山图 | 富集气泡图 | 本体知识图谱        │
├─────────────────────────────────────────────────────┤
│              SSE 实时流（进度推送）                   │
├─────────────────────────────────────────────────────┤
│                    服务层                            │
│  FastAPI | AnalysisService | LLMService             │
│  OntologyService | DatasetService | FeedbackService │
├─────────────────────────────────────────────────────┤
│                    Agent 层                          │
│  LangChain ReAct Agent（千问 LLM）                   │
│  差异表达工具 | 富集分析工具 | BLAST工具              │
├─────────────────────────────────────────────────────┤
│                    数据层                            │
│  表达矩阵(TSV) | GO/KEGG注释库 | BLAST数据库(MH63)   │
└─────────────────────────────────────────────────────┘
```

- **表示层**：基于React 18 + TypeScript构建的SPA，采用Ant Design组件库，Recharts负责图表可视化，React Flow负责本体图谱渲染。
- **服务层**：FastAPI后端，包含分析服务、LLM网关、本体服务等核心模块，均以模块级单例形式实例化。
- **Agent层**：基于LangChain ReAct Agent框架，集成千问大语言模型，通过OpenAI兼容API进行工具选择与调用。
- **数据层**：包含表达矩阵、本地化GO/KEGG注释库和BLAST序列数据库。

### 3.2 Agent循环机制

Agent循环（Agent Loop）是系统的核心驱动机制，算法如下：

```
输入：用户消息 M，工具集 T，最大迭代次数 K=10
输出：分析结果文本 R

messages ← [system_prompt, M]
for i = 1 to K:
    response ← LLM.call(messages, tools=T, tool_choice="auto")
    if response.has_tool_calls:
        for each tool_call:
            result ← dispatch_tool(tool_call.name, tool_call.args)
            messages.append(tool_result(result))
    else:
        return response.content
```

该机制使LLM能够根据用户意图自主选择和链式调用分析工具。例如，用户输入"分析WT和osbzip23的差异表达，然后对显著基因做GO富集"时，Agent可自动完成差异分析→提取显著基因→GO富集的完整链路，无需用户编写任何代码。

### 3.3 前端交互设计

前端采用对话式交互范式，三项关键设计：

1. **消息类型分歧联合**：定义12种消息类型（text、progress、analysis、enrichment-result、blast-result等），每种类型触发专属渲染组件，将对话文本与结构化可视化无缝融合。

2. **SSE实时进度流**：通过Server-Sent Events实现分析进度实时推送，四阶段进度模型（init → tool → llm → consistency）为用户提供细粒度执行可见性，并支持在50%~75%阶段取消LLM轨道。

3. **LLM响应内嵌结构化数据**：LLM在文本回复中通过HTML注释标记（如`<!-- ENRICHMENT_DATA: {...} -->`）嵌入JSON数据，前端正则解析后渲染为专用卡片组件，实现自然语言叙述与数据可视化的统一呈现。

---
## 4. 核心方法

### 4.1 双轨并行差异表达分析

双轨分析是ABC系统的核心方法创新，其执行流程包含工具轨道、LLM轨道和一致性分析三个阶段。

#### 4.1.1 工具轨道（Tool Track）

工具轨道采用独立样本t检验对基因表达矩阵进行全基因组扫描。给定表达矩阵 X ∈ R^(G×N)，其中 G 为基因数，N 为样本数，将样本分为对照组 C 和处理组 T，对每个基因 g 计算：

**log2折叠变化（log2 Fold Change）**：

log2FC_g = log2(mean_T / mean_C)

其中 mean_T 和 mean_C 分别为基因 g 在处理组和对照组中的均值表达量。为避免零值除法，系统采用安全保护措施。

**t检验统计量**：

t_g = (mean_T - mean_C) / sqrt(s_T^2/n + s_C^2/m)

系统使用`scipy.stats.ttest_ind`进行向量化计算（`axis=1`），在单次函数调用中完成全基因组t检验。显著差异基因的判定标准为：

- 上调：p < α 且 log2FC ≥ β
- 下调：p < α 且 log2FC ≤ -β
- 不显著：其他情况

其中 α 为p值阈值（默认0.05），β 为log2FC阈值（默认1.0）。

#### 4.1.2 LLM轨道（LLM Track）

LLM轨道将前20个基因的对照组/处理组均值表达数据以结构化文本形式发送给千问大语言模型，要求其基于生物学知识和表达模式进行推理。LLM返回上调基因列表、下调基因列表及推理依据。提示模板如下：

```
你是一位分子生物学专家。请分析以下基因表达数据，
判断哪些基因在处理组中显著上调或下调。

基因表达数据（前20个基因）：
基因ID | 对照组均值 | 处理组均值
{gene_data_table}

请以JSON格式返回：
{
  "upregulated_genes": ["gene1", "gene2", ...],
  "downregulated_genes": ["gene3", "gene4", ...],
  "reasoning": "分析推理过程"
}
```

LLM推理不受固定阈值约束，能够结合基因功能先验知识和表达趋势做出灵活判断，有可能识别出传统严格阈值过滤所遗漏的生物学候选基因。

#### 4.1.3 一致性分析（Consistency Analysis）

双轨结果通过集合运算进行一致性量化：

Overlap Rate = |S_tool ∩ S_llm| / |S_tool|

其中 S_tool 和 S_llm 分别为工具轨道和LLM轨道识别的显著基因集合。系统同时输出：

- **重叠基因**（S_tool ∩ S_llm）：两种方法均识别的高置信基因
- **工具独有**（S_tool \ S_llm）：仅通过统计阈值识别的基因
- **LLM独有**（S_llm \ S_tool）：仅被LLM推理识别的候选基因
- **重叠率**：量化两种方法的一致程度

### 4.2 功能富集分析

系统集成两类功能富集分析模块，均基于本地注释数据库实现。

#### 4.2.1 GO富集分析

基于goatools库实现，使用基因本体（Gene Ontology, GO）标准OBO文件（go-basic.obo）作为本体结构。分析流程：

1. 加载水稻MH63基因组的GO注释文件（`mh63_go_annotation.tsv`）
2. 构建基因-GO映射关系
3. 使用`GOEnrichmentStudy`类执行Fisher精确检验
4. 启用GO层级传播（`propagate_counts=True`），确保子节点的基因计数向父节点传播
5. 使用Benjamini-Hochberg方法进行多重检验校正（FDR < 0.05）

富集得分计算公式：

Score_t = -log10(p_t) × (n_study,t / n_pop,t) × N_bg

其中 p_t 为GO术语 t 的p值，n_study,t 为研究集中注释到该术语的基因数，n_pop,t 为背景集中对应的基因数，N_bg 为背景集大小。

#### 4.2.2 KEGG富集分析

KEGG通路富集分析使用Fisher精确检验（单侧，`alternative='greater'`），对每条KEGG通路构建2×2列联表：

|  | 通路内 | 通路外 |
|--|--------|--------|
| 研究集 | a | b |
| 背景集 | c | d |

p值通过`scipy.stats.fisher_exact`计算，多重检验校正使用`statsmodels.stats.multitest.multipletests`（Benjamini-Hochberg方法）。KEGG注释数据来源于Ensembl Plants BioMart，针对水稻MH63品系手动构建。

### 4.3 BLAST序列比对

系统集成本地BLAST+工具包，支持blastn、blastp、blastx和tblastn四种比对程序。支持三种查询模式：

1. **原始序列输入**：用户直接粘贴FASTA格式序列
2. **基因ID查询**：从参考FASTA文件中提取目标序列
3. **文件上传**：上传序列文件进行批量比对

比对通过`subprocess.run()`执行本地BLAST+程序，输出采用制表符分隔格式（outfmt 6），包含14个标准字段（qseqid、sseqid、pident、length、mismatch、gapopen、qstart、qend、sstart、send、evalue、bitscore、qcovs、stitle），结果经pandas解析后按相似性阈值过滤返回。

### 4.4 自动分组推断

为降低用户操作复杂度，系统实现了基于关键词匹配的样本自动分组推断。给定表达矩阵的列名集合，系统维护一个对照组关键词列表：

K_ctrl = {wt, ck, ctrl, control, mock, nc, wild, normal, untreated}

扫描每个列名，若其小写形式包含 K_ctrl 中的任一关键词，则归入对照组；其余列自动归入处理组。当两组各至少包含2个样本时，分组结果有效；否则系统弹出手动分组界面供用户指定。

### 4.5 用户反馈闭环机制

系统设计了基因级别的用户反馈收集与聚合机制：

1. **反馈收集**：每次分析结果展示时，用户可对单个基因或整体结果进行"赞同/反对 + 文本评论"式反馈
2. **反馈存储**：反馈记录存储于`feedback.json`文件，包含基因ID、评分、评论、对应的分析参数等
3. **关键词聚合**：FeedbackHint服务对历史反馈按关键词建立倒排索引
4. **智能提示**：当用户查询涉及历史反馈相关的基因或分析参数时，系统自动展示频率加权的提示信息，辅助研究决策

---

## 5. 实验与结果

### 5.1 实验设置

**数据集**：采用NCBI GEO数据库中的水稻转录组数据集GSE242459，包含野生型（WT）与OsbZIP23转录因子突变体在不同胁迫条件下的基因表达谱。

- 对照组（WT）：DS_WT_rep1, DS_WT_rep2, N_WT_rep1, N_WT_rep2, RE_WT_rep1, RE_WT_rep2（6个样本）
- 处理组（osbzip23）：DS_osbzip23_rep1, DS_osbzip23_rep2（2个样本）

**LLM配置**：使用阿里云千问（Qwen）系列模型，通过DashScope API调用，温度参数0.7，最大输出token数2000。

**分析参数**：p值阈值 α = 0.05，log2FC阈值 β = 1.0。

**实验环境**：Python 3.10, FastAPI 0.109.0, SciPy 1.12.0, NumPy 1.26.3, React 18.2.0, Linux CentOS 8。

### 5.2 差异表达分析结果

工具轨道对GSE242459数据集进行全基因组t检验分析，以火山图形式可视化（横轴log2FC，纵轴-log10(p-value)），红色点表示显著上调基因，蓝色点表示显著下调基因，双虚线分别标示log2FC = ±1和p = 0.05的判定阈值。

LLM轨道接收前20个基因的表达数据摘要，千问模型基于表达值的倍数变化和生物学先验知识识别差异表达基因，并给出推理依据。

**双轨一致性分析**：分析表明：
1. **高一致性**：大部分LLM识别的基因与工具轨道结果重叠，验证了LLM对表达数据的理解能力。
2. **LLM的补充价值**：LLM独有基因中部分可能具有生物学意义——其表达变化虽未达到严格统计阈值，但基于生物学上下文可能代表有价值的候选基因。
3. **工具的统计严谨性**：工具独有基因来自全基因组系统扫描，覆盖了LLM受限于token窗口而无法处理的大量基因。

### 5.3 功能富集分析结果

基于差异表达分析获得的显著基因列表，系统自动执行GO和KEGG富集分析。

**GO富集分析**：识别显著富集的生物过程（BP）、细胞组分（CC）和分子功能（MF）术语，结果以气泡图形式呈现，气泡大小编码基因数量，颜色深浅编码校正后p值的显著性水平。

**KEGG富集分析**：识别显著富集的代谢和信号通路。系统集成的MH63本地注释数据库确保了水稻特异性通路的准确映射，避免了使用通用API时的物种适配问题。

### 5.4 系统性能

**表3. 系统响应时间**

| 操作 | 平均耗时 |
|------|---------|
| 差异表达分析（工具轨道） | ~5–10秒 |
| LLM推理分析 | ~10–20秒 |
| 双轨完整分析（含一致性） | ~20–40秒 |
| GO富集分析 | ~3–5秒 |
| KEGG富集分析 | ~2–4秒 |
| BLAST序列比对 | ~5–30秒（依序列长度） |

工具轨道采用向量化计算（`scipy.stats.ttest_ind(axis=1)`），在单次调用中完成全基因组检验，避免了逐基因循环的性能瓶颈。

### 5.5 与现有工具的对比

**表4. ABC系统与现有工具功能对比**

| 特性 | DESeq2/edgeR | Galaxy | Enrichr | ABC系统 |
|------|-------------|--------|---------|---------|
| 自然语言交互 | ✗ | ✗ | ✗ | ✓ |
| 无需编程 | ✗ | ✓ | ✓ | ✓ |
| LLM辅助推理 | ✗ | ✗ | ✗ | ✓ |
| 双轨验证 | ✗ | ✗ | ✗ | ✓ |
| 非模式生物支持 | ✓ | ✓ | ✗ | ✓（本地注释） |
| 多步骤自动链式调用 | ✗ | ✓（工作流） | ✗ | ✓（Agent） |
| 实时进度反馈 | ✗ | ✓ | ✗ | ✓（SSE） |
| 用户反馈闭环 | ✗ | ✗ | ✗ | ✓ |
| 离线分析 | ✓ | ✗ | ✗ | ✓ |

---
