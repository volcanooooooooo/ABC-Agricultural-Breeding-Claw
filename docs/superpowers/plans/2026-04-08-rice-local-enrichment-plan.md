# 水稻 MH63 本地富集分析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将富集分析从 Enrichr API 替换为基于本地 MH63 注释文件的 GO + KEGG 富集分析。

**Architecture:** 预处理脚本从 Ensembl Plants BioMart + KEGG REST API 下载 MH63 注释数据，保存为 TSV 文件。enrichment.py 启动时加载注释到内存，使用 goatools (GO) 和 scipy + statsmodels (KEGG) 做本地 Fisher's exact test 富集分析。返回 JSON 格式与现有前端完全兼容。

**Tech Stack:** Python, goatools, scipy, statsmodels, httpx (注释下载)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/scripts/prepare_annotations.py` | Create | 从 Ensembl BioMart + KEGG API 下载并生成 MH63 注释文件 |
| `backend/data/annotations/go-basic.obo` | Create (downloaded) | GO 本体结构文件 |
| `backend/data/annotations/mh63_go_annotation.tsv` | Create (generated) | MH63 gene → GO term 映射 |
| `backend/data/annotations/mh63_kegg_annotation.tsv` | Create (generated) | MH63 gene → KEGG pathway 映射 |
| `backend/app/tools/enrichment.py` | Rewrite | 本地富集分析核心逻辑 |
| `backend/requirements.txt` | Modify | 移除 gseapy，新增 goatools、statsmodels |
| `backend/tests/test_enrichment.py` | Create | 富集分析单元测试 |

---

### Task 1: 更新依赖

**Files:**
- Modify: `backend/requirements.txt:14`

- [ ] **Step 1: 更新 requirements.txt**

Replace line 14 (`gseapy>=1.0.0`) with new dependencies:

```text
goatools>=1.4.0
statsmodels>=0.14.0
```

The full file should be:

```text
fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
openai>=1.0.0
httpx==0.26.0
python-multipart==0.0.6
pandas==2.2.0
numpy==1.26.3
scipy==1.12.0
pydeseq2==0.4.0
python-dotenv==1.0.0
scikit-learn==1.4.0
goatools>=1.4.0
statsmodels>=0.14.0
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
sqlalchemy==2.0.25
```

- [ ] **Step 2: 安装新依赖**

Run: `cd backend && pip install goatools>=1.4.0 statsmodels>=0.14.0`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: replace gseapy with goatools and statsmodels for local enrichment"
```

---

### Task 2: 创建注释文件下载脚本

**Files:**
- Create: `backend/scripts/prepare_annotations.py`

- [ ] **Step 1: 创建 scripts 目录和脚本文件**

```python
"""从 Ensembl Plants BioMart + KEGG REST API 下载 MH63 注释文件。

用法: python -m scripts.prepare_annotations
输出:
  data/annotations/go-basic.obo
  data/annotations/mh63_go_annotation.tsv
  data/annotations/mh63_kegg_annotation.tsv
"""

import csv
import os
import time
from pathlib import Path
from xml.etree import ElementTree

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
ANNOTATIONS_DIR = BASE_DIR / "data" / "annotations"

BIOMART_URL = "https://plants.ensembl.org/biomart/martservice"
KEGG_BASE = "https://rest.kegg.jp"
OBO_URL = "http://purl.obolibrary.org/obo/go/go-basic.obo"


def ensure_dir():
    ANNOTATIONS_DIR.mkdir(parents=True, exist_ok=True)


def download_obo():
    """下载 GO 本体 OBO 文件。"""
    dest = ANNOTATIONS_DIR / "go-basic.obo"
    if dest.exists():
        print(f"[skip] {dest} already exists")
        return
    print("[download] go-basic.obo ...")
    resp = httpx.get(OBO_URL, timeout=120, follow_redirects=True)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    print(f"[done] saved {dest} ({len(resp.content)} bytes)")


def download_go_annotation():
    """通过 Ensembl Plants BioMart 下载 MH63 gene → GO 映射。"""
    dest = ANNOTATIONS_DIR / "mh63_go_annotation.tsv"
    if dest.exists():
        print(f"[skip] {dest} already exists")
        return

    print("[download] MH63 GO annotation from Ensembl BioMart ...")

    # BioMart XML query for MH63 GO annotation
    xml_query = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="1" uniqueRows="1">
  <Dataset name="osativa_mh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="go_id"/>
    <Attribute name="name_1006"/>
    <Attribute name="namespace_1003"/>
  </Dataset>
</Query>"""

    resp = httpx.get(
        BIOMART_URL,
        params={"query": xml_query.strip()},
        timeout=300,
        follow_redirects=True,
    )
    resp.raise_for_status()

    # Parse TSV response, filter empty GO IDs, write clean TSV
    lines = resp.text.strip().split("\n")
    if len(lines) < 2:
        raise RuntimeError(f"BioMart returned too few lines: {len(lines)}")

    with open(dest, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["gene_id", "go_id", "go_name", "go_namespace"])
        count = 0
        for line in lines[1:]:  # skip header
            parts = line.split("\t")
            if len(parts) >= 4 and parts[1].startswith("GO:"):
                writer.writerow([parts[0], parts[1], parts[2], parts[3]])
                count += 1

    print(f"[done] saved {dest} ({count} gene-GO pairs)")


def download_kegg_annotation():
    """通过 KEGG REST API 下载水稻 KEGG 通路注释，并映射到 MH63 gene ID。"""
    dest = ANNOTATIONS_DIR / "mh63_kegg_annotation.tsv"
    if dest.exists():
        print(f"[skip] {dest} already exists")
        return

    # Step 1: 从 BioMart 获取 MH63 gene ID → Entrez/external gene name 映射
    print("[download] MH63 gene ID mapping from BioMart ...")
    xml_query = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Query>
<Query virtualSchemaName="plants_mart" formatter="TSV" header="1" uniqueRows="1">
  <Dataset name="osativa_mh63_eg_gene" interface="default">
    <Attribute name="ensembl_gene_id"/>
    <Attribute name="entrezgene_id"/>
  </Dataset>
</Query>"""

    resp = httpx.get(
        BIOMART_URL,
        params={"query": xml_query.strip()},
        timeout=300,
        follow_redirects=True,
    )
    resp.raise_for_status()

    # Build entrez → mh63_gene_id mapping
    entrez_to_mh63: dict[str, str] = {}
    lines = resp.text.strip().split("\n")
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) >= 2 and parts[1].strip():
            entrez_to_mh63[parts[1].strip()] = parts[0].strip()

    print(f"  found {len(entrez_to_mh63)} entrez → MH63 mappings")

    # Step 2: 获取水稻 KEGG 通路列表
    print("[download] rice KEGG pathway list ...")
    resp = httpx.get(f"{KEGG_BASE}/list/pathway/osa", timeout=60)
    resp.raise_for_status()

    pathways: list[tuple[str, str]] = []
    for line in resp.text.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) >= 2:
            pathway_id = parts[0].replace("path:", "")
            pathway_name = parts[1].split(" - ")[0].strip()
            pathways.append((pathway_id, pathway_name))

    print(f"  found {len(pathways)} pathways")

    # Step 3: 获取每个通路的基因，映射到 MH63 ID
    print("[download] pathway → gene links (this may take a few minutes) ...")
    results: list[tuple[str, str, str]] = []

    client = httpx.Client(timeout=30)
    for i, (pw_id, pw_name) in enumerate(pathways):
        try:
            resp = client.get(f"{KEGG_BASE}/link/genes/{pw_id}")
            if resp.status_code != 200:
                continue
            for line in resp.text.strip().split("\n"):
                parts = line.split("\t")
                if len(parts) >= 2:
                    # KEGG gene format: osa:4324567 (entrez ID)
                    kegg_gene = parts[1].replace("osa:", "")
                    mh63_id = entrez_to_mh63.get(kegg_gene)
                    if mh63_id:
                        results.append((mh63_id, pw_id, pw_name))
        except Exception as e:
            print(f"  [warn] failed for {pw_id}: {e}")

        # Rate limiting: KEGG allows ~3 req/s
        if (i + 1) % 3 == 0:
            time.sleep(1)
        if (i + 1) % 50 == 0:
            print(f"  processed {i + 1}/{len(pathways)} pathways ...")

    client.close()

    with open(dest, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter="\t")
        writer.writerow(["gene_id", "kegg_pathway_id", "kegg_pathway_name"])
        for row in results:
            writer.writerow(row)

    print(f"[done] saved {dest} ({len(results)} gene-pathway pairs)")


def main():
    ensure_dir()
    download_obo()
    download_go_annotation()
    download_kegg_annotation()
    print("\n=== All annotation files ready ===")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行脚本生成注释文件**

Run: `cd backend && python -m scripts.prepare_annotations`

Expected: 三个文件生成到 `backend/data/annotations/` 目录：
- `go-basic.obo` (~35MB)
- `mh63_go_annotation.tsv` (gene-GO pairs)
- `mh63_kegg_annotation.tsv` (gene-pathway pairs)

- [ ] **Step 3: 检查生成的文件**

Run: `head -5 backend/data/annotations/mh63_go_annotation.tsv && echo "---" && head -5 backend/data/annotations/mh63_kegg_annotation.tsv`

Expected: 每个文件有 header 行和数据行。

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/prepare_annotations.py backend/data/annotations/
git commit -m "feat: add annotation download script and MH63 GO/KEGG annotation files"
```

Note: `go-basic.obo` 文件较大（~35MB），如果 git 仓库有大小限制，可以在 `.gitignore` 中排除并在 README 中说明如何下载。

---

### Task 3: 重写 enrichment.py — 注释加载模块

**Files:**
- Rewrite: `backend/app/tools/enrichment.py`

- [ ] **Step 1: 编写注释加载函数**

将 `backend/app/tools/enrichment.py` 完全重写为以下内容（第一部分：注释加载）：

```python
"""水稻 MH63 本地 GO/KEGG 富集分析工具。

使用本地注释文件 + Fisher's exact test，替代 Enrichr API。
"""

import csv
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from goatools.obo_parser import GODag
from goatools.go_enrichment import GOEnrichmentStudy
from scipy.stats import fisher_exact
from statsmodels.stats.multitest import multipletests

# ── 注释文件路径 ─────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "annotations"
_OBO_PATH = _DATA_DIR / "go-basic.obo"
_GO_ANNO_PATH = _DATA_DIR / "mh63_go_annotation.tsv"
_KEGG_ANNO_PATH = _DATA_DIR / "mh63_kegg_annotation.tsv"

# ── 全局缓存（启动时加载一次） ──────────────────────────────────────────
_go_dag: GODag | None = None
_gene2go: Dict[str, Set[str]] = {}
_go_background_genes: Set[str] = set()
_kegg2genes: Dict[str, Tuple[str, Set[str]]] = {}  # pathway_id → (name, gene_set)
_gene2kegg: Dict[str, Set[str]] = {}
_kegg_background_genes: Set[str] = set()
_loaded = False


def _load_annotations():
    """加载注释文件到内存。仅在首次调用时执行。"""
    global _go_dag, _gene2go, _go_background_genes
    global _kegg2genes, _gene2kegg, _kegg_background_genes, _loaded

    if _loaded:
        return

    # 1. 加载 GO DAG
    if _OBO_PATH.exists():
        _go_dag = GODag(str(_OBO_PATH))

    # 2. 加载 GO 注释: gene_id → set of GO IDs
    if _GO_ANNO_PATH.exists():
        with open(_GO_ANNO_PATH, encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                gene_id = row["gene_id"]
                go_id = row["go_id"]
                _gene2go.setdefault(gene_id, set()).add(go_id)
        _go_background_genes = set(_gene2go.keys())

    # 3. 加载 KEGG 注释: pathway_id → (name, set of genes)
    if _KEGG_ANNO_PATH.exists():
        with open(_KEGG_ANNO_PATH, encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                gene_id = row["gene_id"]
                pw_id = row["kegg_pathway_id"]
                pw_name = row["kegg_pathway_name"]
                if pw_id not in _kegg2genes:
                    _kegg2genes[pw_id] = (pw_name, set())
                _kegg2genes[pw_id][1].add(gene_id)
                _gene2kegg.setdefault(gene_id, set()).add(pw_id)
        _kegg_background_genes = set(_gene2kegg.keys())

    _loaded = True
```

- [ ] **Step 2: 验证文件语法**

Run: `cd backend && python -c "import ast; ast.parse(open('app/tools/enrichment.py').read()); print('syntax ok')"`
Expected: `syntax ok`

---

### Task 4: 重写 enrichment.py — GO 富集函数

**Files:**
- Modify: `backend/app/tools/enrichment.py`

- [ ] **Step 1: 添加 GO 富集函数**

在 `_load_annotations()` 函数之后追加：

```python
def _run_go_enrichment(
    genes: List[str], pvalue_cutoff: float
) -> List[Dict[str, Any]]:
    """使用 goatools 进行 GO 富集分析。"""
    _load_annotations()

    if not _go_dag or not _gene2go:
        return []

    # 过滤出有 GO 注释的基因
    study_genes = set(genes) & _go_background_genes
    if not study_genes:
        return []

    goe = GOEnrichmentStudy(
        pop=_go_background_genes,
        ns2assoc=_gene2go,
        godag=_go_dag,
        propagate_counts=True,
        alpha=pvalue_cutoff,
        methods=["fdr_bh"],
    )

    results = goe.run_study(study_genes)

    go_results: List[Dict[str, Any]] = []
    for rec in sorted(results, key=lambda r: r.p_uncorrected):
        if rec.p_fdr_bh is not None and rec.p_fdr_bh > pvalue_cutoff:
            continue
        if rec.enrichment != "e":  # only enriched, not purified
            continue

        # 找出命中的基因
        hit_genes = list(study_genes & rec.study_items) if hasattr(rec, "study_items") else []

        go_results.append({
            "pathway": f"{rec.name} ({rec.NS})",
            "pathway_id": rec.GO,
            "gene_count": rec.study_count,
            "total_genes": rec.pop_count,
            "pvalue": rec.p_uncorrected,
            "adjusted_pvalue": rec.p_fdr_bh if rec.p_fdr_bh is not None else rec.p_uncorrected,
            "enrichment_score": -math.log10(max(rec.p_uncorrected, 1e-300)) * (rec.study_count / max(rec.pop_count, 1)) * len(_go_background_genes),
            "genes": hit_genes[:50],  # 限制基因数量
        })

        if len(go_results) >= 20:
            break

    return go_results
```

- [ ] **Step 2: 验证语法**

Run: `cd backend && python -c "import ast; ast.parse(open('app/tools/enrichment.py').read()); print('syntax ok')"`
Expected: `syntax ok`

---

### Task 5: 重写 enrichment.py — KEGG 富集函数

**Files:**
- Modify: `backend/app/tools/enrichment.py`

- [ ] **Step 1: 添加 KEGG 富集函数**

在 `_run_go_enrichment()` 函数之后追加：

```python
def _run_kegg_enrichment(
    genes: List[str], pvalue_cutoff: float
) -> List[Dict[str, Any]]:
    """使用 Fisher's exact test 进行 KEGG 通路富集分析。"""
    _load_annotations()

    if not _kegg2genes:
        return []

    study_genes = set(genes) & _kegg_background_genes
    if not study_genes:
        return []

    n_study = len(study_genes)
    n_background = len(_kegg_background_genes)

    raw_results: List[Dict[str, Any]] = []

    for pw_id, (pw_name, pw_genes) in _kegg2genes.items():
        # 2x2 contingency table
        a = len(study_genes & pw_genes)  # study genes in pathway
        if a == 0:
            continue
        b = n_study - a                   # study genes not in pathway
        c = len(pw_genes) - a             # background in pathway, not in study
        d = n_background - n_study - c    # background not in pathway, not in study

        _, pvalue = fisher_exact([[a, b], [c, d]], alternative="greater")

        raw_results.append({
            "pathway": pw_name,
            "pathway_id": pw_id,
            "gene_count": a,
            "total_genes": len(pw_genes),
            "pvalue": pvalue,
            "genes": list(study_genes & pw_genes),
        })

    if not raw_results:
        return []

    # BH 多重检验校正
    pvalues = [r["pvalue"] for r in raw_results]
    _, adj_pvalues, _, _ = multipletests(pvalues, method="fdr_bh")

    kegg_results: List[Dict[str, Any]] = []
    for r, adj_p in zip(raw_results, adj_pvalues):
        if adj_p > pvalue_cutoff:
            continue
        expected = r["total_genes"] * len(set(genes)) / n_background
        r["adjusted_pvalue"] = float(adj_p)
        r["enrichment_score"] = -math.log10(max(r["pvalue"], 1e-300)) * (r["gene_count"] / max(expected, 0.01))
        kegg_results.append(r)

    kegg_results.sort(key=lambda x: x["pvalue"])
    return kegg_results[:20]
```

- [ ] **Step 2: 验证语法**

Run: `cd backend && python -c "import ast; ast.parse(open('app/tools/enrichment.py').read()); print('syntax ok')"`
Expected: `syntax ok`

---

### Task 6: 重写 enrichment.py — 主函数和 Schema

**Files:**
- Modify: `backend/app/tools/enrichment.py`

- [ ] **Step 1: 添加主函数 enrichment_analysis 和 Schema**

在 `_run_kegg_enrichment()` 函数之后追加：

```python
def enrichment_analysis(
    gene_list: str,
    analysis_type: str = "both",
    organism: str = "oryza sativa",
    pvalue_cutoff: float = 0.05,
    gene_sets: str = "GO_Biological_Process_2023",
) -> str:
    """对基因列表进行本地 KEGG 和/或 GO 富集分析（MH63 水稻专用）。

    Args:
        gene_list: 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
        analysis_type: "GO" | "KEGG" | "both"，默认 "both"
        organism: 物种名称，默认 "oryza sativa"
        pvalue_cutoff: p 值阈值，默认 0.05
        gene_sets: 保留参数，兼容旧接口

    Returns:
        JSON 字符串，包含 kegg_results、go_results 和 summary。
    """
    if not gene_list or not gene_list.strip():
        return json.dumps({"error": "gene_list is empty"})

    genes: List[str] = [g.strip() for g in gene_list.split(",") if g.strip()]
    if not genes:
        return json.dumps({"error": "gene_list is empty"})

    kegg_results: List[Dict[str, Any]] = []
    go_results: List[Dict[str, Any]] = []

    try:
        if analysis_type in ("KEGG", "both"):
            kegg_results = _run_kegg_enrichment(genes, pvalue_cutoff)

        if analysis_type in ("GO", "both"):
            go_results = _run_go_enrichment(genes, pvalue_cutoff)

    except Exception as e:
        return json.dumps({"error": f"Enrichment analysis failed: {str(e)}"})

    result = {
        "kegg_results": kegg_results,
        "go_results": go_results,
        "summary": {
            "input_gene_count": len(genes),
            "kegg_significant": len(kegg_results),
            "go_significant": len(go_results),
            "top_kegg_pathway": kegg_results[0]["pathway"] if kegg_results else "",
            "top_go_term": go_results[0]["pathway"] if go_results else "",
            "organism": "oryza sativa (MH63)",
            "pvalue_cutoff": pvalue_cutoff,
        },
    }

    return json.dumps(result, ensure_ascii=False)


ENRICHMENT_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "enrichment_analysis",
        "description": (
            "对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析。"
            "使用本地 MH63 水稻注释文件，支持 OsMH_ 格式基因 ID。"
            "可接受差异分析结果中的显著基因，或用户直接提供的基因 ID 列表。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "gene_list": {
                    "type": "string",
                    "description": "逗号分隔的基因 ID 列表，如 'OsMH_01G0000400,OsMH_02G0001200'",
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["GO", "KEGG", "both"],
                    "description": "分析类型：GO、KEGG 或两者都做，默认 both",
                    "default": "both",
                },
                "organism": {
                    "type": "string",
                    "description": "物种名称，默认 'oryza sativa'（MH63 水稻）",
                    "default": "oryza sativa",
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p 值阈值，默认 0.05",
                    "default": 0.05,
                },
            },
            "required": ["gene_list"],
        },
    },
}
```

- [ ] **Step 2: 验证完整文件语法**

Run: `cd backend && python -c "import ast; ast.parse(open('app/tools/enrichment.py').read()); print('syntax ok')"`
Expected: `syntax ok`

- [ ] **Step 3: 验证导入正常**

Run: `cd backend && python -c "from app.tools.enrichment import enrichment_analysis, ENRICHMENT_ANALYSIS_SCHEMA; print('import ok')"`
Expected: `import ok`（注释文件会在首次调用时加载）

- [ ] **Step 4: Commit**

```bash
git add backend/app/tools/enrichment.py
git commit -m "feat: rewrite enrichment.py to use local MH63 GO/KEGG annotations"
```

---

### Task 7: 编写单元测试

**Files:**
- Create: `backend/tests/test_enrichment.py`

- [ ] **Step 1: 创建测试文件**

```python
"""enrichment_analysis 单元测试。"""

import json
from unittest.mock import patch

import pytest

from app.tools.enrichment import (
    enrichment_analysis,
    _load_annotations,
    _run_kegg_enrichment,
    _run_go_enrichment,
)


class TestEnrichmentAnalysis:
    """测试主函数 enrichment_analysis。"""

    def test_empty_gene_list_returns_error(self):
        result = json.loads(enrichment_analysis(""))
        assert "error" in result
        assert "empty" in result["error"]

    def test_whitespace_gene_list_returns_error(self):
        result = json.loads(enrichment_analysis("  ,  , "))
        assert "error" in result

    def test_returns_valid_json_structure(self):
        result = json.loads(enrichment_analysis("OsMH_01G0000400,OsMH_02G0001200"))
        assert "kegg_results" in result
        assert "go_results" in result
        assert "summary" in result
        assert isinstance(result["kegg_results"], list)
        assert isinstance(result["go_results"], list)

    def test_summary_fields(self):
        result = json.loads(enrichment_analysis("OsMH_01G0000400"))
        summary = result["summary"]
        assert summary["input_gene_count"] == 1
        assert "organism" in summary
        assert "MH63" in summary["organism"]
        assert summary["pvalue_cutoff"] == 0.05

    def test_analysis_type_go_only(self):
        result = json.loads(enrichment_analysis(
            "OsMH_01G0000400,OsMH_02G0001200",
            analysis_type="GO",
        ))
        assert "go_results" in result
        assert "kegg_results" in result
        # KEGG should be empty when only GO requested
        assert result["kegg_results"] == []

    def test_analysis_type_kegg_only(self):
        result = json.loads(enrichment_analysis(
            "OsMH_01G0000400,OsMH_02G0001200",
            analysis_type="KEGG",
        ))
        assert result["go_results"] == []

    def test_result_pathway_fields(self):
        """如果有富集结果，验证每条记录的字段完整性。"""
        result = json.loads(enrichment_analysis(
            "OsMH_01G0000400,OsMH_02G0001200,OsMH_03G0001000",
            analysis_type="both",
        ))
        for item in result["kegg_results"] + result["go_results"]:
            assert "pathway" in item
            assert "pathway_id" in item
            assert "gene_count" in item
            assert "total_genes" in item
            assert "pvalue" in item
            assert "adjusted_pvalue" in item
            assert "enrichment_score" in item
            assert "genes" in item
            assert isinstance(item["genes"], list)
```

- [ ] **Step 2: 运行测试**

Run: `cd backend && PYTHONPATH=. python -m pytest tests/test_enrichment.py -v`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_enrichment.py
git commit -m "test: add unit tests for local MH63 enrichment analysis"
```

---

### Task 8: 端到端验证

**Files:** (no new files)

- [ ] **Step 1: 验证注释文件加载**

Run:
```bash
cd backend && python -c "
from app.tools.enrichment import _load_annotations, _gene2go, _kegg2genes, _go_background_genes, _kegg_background_genes
_load_annotations()
print(f'GO annotations: {len(_gene2go)} genes, {len(_go_background_genes)} background')
print(f'KEGG pathways: {len(_kegg2genes)} pathways, {len(_kegg_background_genes)} background genes')
"
```
Expected: 非零数量的基因和通路。

- [ ] **Step 2: 验证完整富集分析**

Run:
```bash
cd backend && python -c "
import json
from app.tools.enrichment import enrichment_analysis
# 使用几个 MH63 基因 ID 测试
result = json.loads(enrichment_analysis('OsMH_01G0000400,OsMH_01G0001000,OsMH_02G0001200,OsMH_03G0001000,OsMH_04G0001200'))
print(f'KEGG: {result[\"summary\"][\"kegg_significant\"]} significant pathways')
print(f'GO: {result[\"summary\"][\"go_significant\"]} significant terms')
if result['kegg_results']:
    print(f'Top KEGG: {result[\"kegg_results\"][0][\"pathway\"]}')
if result['go_results']:
    print(f'Top GO: {result[\"go_results\"][0][\"pathway\"]}')
print('organism:', result['summary']['organism'])
"
```
Expected: 输出富集结果摘要，organism 显示 `oryza sativa (MH63)`。

- [ ] **Step 3: 验证 Agent Loop 集成**

Run:
```bash
cd backend && python -c "
from app.agent.analysis_agent import TOOLS, TOOL_HANDLERS
print('Tools:', [t['function']['name'] for t in TOOLS])
print('Handlers:', list(TOOL_HANDLERS.keys()))
assert 'enrichment_analysis' in TOOL_HANDLERS
print('Agent integration OK')
"
```
Expected: `Agent integration OK`

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete MH63 local enrichment analysis with GO + KEGG support"
```
