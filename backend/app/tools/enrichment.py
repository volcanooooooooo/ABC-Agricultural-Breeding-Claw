"""KEGG/GO enrichment analysis tool - local MH63 annotations + Fisher's exact test."""

import csv
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

from goatools.obo_parser import GODag
from goatools.go_enrichment import GOEnrichmentStudy
from scipy.stats import fisher_exact
from statsmodels.stats.multitest import multipletests

# ---------------------------------------------------------------------------
# Annotation file paths
# ---------------------------------------------------------------------------
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "annotations"
_OBO_PATH = _DATA_DIR / "go-basic.obo"
_GO_ANNO_PATH = _DATA_DIR / "mh63_go_annotation.tsv"
_KEGG_ANNO_PATH = _DATA_DIR / "mh63_kegg_annotation.tsv"

# ---------------------------------------------------------------------------
# Global cache
# ---------------------------------------------------------------------------
_go_dag: "GODag | None" = None
_gene2go: Dict[str, Set[str]] = {}
_go_background_genes: Set[str] = set()
_kegg2genes: Dict[str, Tuple[str, Set[str]]] = {}
_gene2kegg: Dict[str, Set[str]] = {}
_kegg_background_genes: Set[str] = set()
_loaded: bool = False


def _load_annotations() -> None:
    """Load GO and KEGG annotation files into global caches (once)."""
    global _go_dag, _gene2go, _go_background_genes
    global _kegg2genes, _gene2kegg, _kegg_background_genes, _loaded

    if _loaded:
        return
    _loaded = True

    # Load GO OBO
    if _OBO_PATH.exists():
        try:
            _go_dag = GODag(str(_OBO_PATH), optional_attrs={"relationship"})
        except Exception:
            _go_dag = None

    # Load GO annotations
    if _GO_ANNO_PATH.exists():
        try:
            with open(_GO_ANNO_PATH, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh, delimiter="\t")
                for row in reader:
                    gene_id = row.get("gene_id", "").strip()
                    go_id = row.get("go_id", "").strip()
                    if gene_id and go_id:
                        _gene2go.setdefault(gene_id, set()).add(go_id)
                        _go_background_genes.add(gene_id)
        except Exception:
            pass

    # Load KEGG annotations
    if _KEGG_ANNO_PATH.exists():
        try:
            with open(_KEGG_ANNO_PATH, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh, delimiter="\t")
                for row in reader:
                    gene_id = row.get("gene_id", "").strip()
                    pathway_id = row.get("kegg_pathway_id", "").strip()
                    pathway_name = row.get("kegg_pathway_name", "").strip()
                    if gene_id and pathway_id:
                        if pathway_id not in _kegg2genes:
                            _kegg2genes[pathway_id] = (pathway_name, set())
                        _kegg2genes[pathway_id][1].add(gene_id)
                        _gene2kegg.setdefault(gene_id, set()).add(pathway_id)
                        _kegg_background_genes.add(gene_id)
        except Exception:
            pass


def _normalize_gene_id(gene_id: str) -> str:
    """将 OsMH_ 格式转换为 OsMH63_ 格式（去掉末尾一位数字）。"""
    if gene_id.startswith("OsMH_") and not gene_id.startswith("OsMH63_"):
        suffix = gene_id[5:]  # e.g. "01G0000100"
        return "OsMH63_" + suffix[:-1]  # e.g. "OsMH63_01G000010"
    return gene_id


# ---------------------------------------------------------------------------
# GO enrichment
# ---------------------------------------------------------------------------

def _run_go_enrichment(genes: List[str], pvalue_cutoff: float) -> List[Dict[str, Any]]:
    """Run GO enrichment using goatools GOEnrichmentStudy."""
    if not _go_dag or not _gene2go or not _go_background_genes:
        return []

    study_genes = set(genes) & _go_background_genes
    if not study_genes:
        return []

    background_size = len(_go_background_genes)

    try:
        goeaobj = GOEnrichmentStudy(
            _go_background_genes,
            _gene2go,
            _go_dag,
            propagate_counts=True,
            alpha=pvalue_cutoff,
            methods=["fdr_bh"],
        )
        results = goeaobj.run_study(study_genes)
    except Exception:
        return []

    filtered = [
        r for r in results
        if r.enrichment in ("e", "p") and r.p_fdr_bh <= pvalue_cutoff
    ]
    filtered.sort(key=lambda r: r.p_uncorrected)
    filtered = filtered[:20]

    out = []
    for rec in filtered:
        p = rec.p_uncorrected if rec.p_uncorrected > 0 else 1e-300
        pop_count = rec.pop_count if rec.pop_count > 0 else 1
        score = -math.log10(p) * rec.study_count / pop_count * background_size
        out.append({
            "pathway": f"{rec.name} ({rec.NS})",
            "pathway_id": rec.GO,
            "gene_count": rec.study_count,
            "total_genes": rec.pop_count,
            "pvalue": rec.p_uncorrected,
            "adjusted_pvalue": rec.p_fdr_bh,
            "enrichment_score": score,
            "enrichment_type": "enriched" if rec.enrichment == "e" else "purified",
            "genes": list(rec.study_items)[:10],
        })
    return out


# ---------------------------------------------------------------------------
# KEGG enrichment
# ---------------------------------------------------------------------------

def _run_kegg_enrichment(genes: List[str], pvalue_cutoff: float) -> List[Dict[str, Any]]:
    """Run KEGG enrichment using Fisher's exact test + BH correction."""
    if not _kegg2genes or not _kegg_background_genes:
        return []

    study = set(genes) & _kegg_background_genes
    if not study:
        return []

    background_size = len(_kegg_background_genes)
    n_study = len(study)

    pathway_ids: List[str] = []
    pvalues: List[float] = []
    pathway_data: List[Dict[str, Any]] = []

    for pathway_id, (pathway_name, pathway_genes) in _kegg2genes.items():
        a = len(study & pathway_genes)
        if a == 0:
            continue
        b = n_study - a
        c = len(pathway_genes) - a
        d = background_size - n_study - c
        if d < 0:
            d = 0
        _, pval = fisher_exact([[a, b], [c, d]], alternative="greater")
        pathway_ids.append(pathway_id)
        pvalues.append(pval)
        pathway_data.append({
            "pathway": pathway_name,
            "pathway_id": pathway_id,
            "gene_count": a,
            "total_genes": len(pathway_genes),
            "pvalue": pval,
            "hit_genes": list(study & pathway_genes)[:10],
        })

    if not pvalues:
        return []

    _, adj_pvalues, _, _ = multipletests(pvalues, method="fdr_bh")

    results = []
    for i, entry in enumerate(pathway_data):
        adj_p = float(adj_pvalues[i])
        pval = entry["pvalue"]
        gene_count = entry["gene_count"]
        total_genes = entry["total_genes"]
        expected = total_genes * n_study / background_size if background_size > 0 else 1
        p_safe = pval if pval > 0 else 1e-300
        score = -math.log10(p_safe) * (gene_count / expected) if expected > 0 else 0.0
        results.append({
            "pathway": entry["pathway"],
            "pathway_id": entry["pathway_id"],
            "gene_count": gene_count,
            "total_genes": total_genes,
            "pvalue": pval,
            "adjusted_pvalue": adj_p,
            "enrichment_score": score,
            "genes": entry["hit_genes"],
        })

    results.sort(key=lambda r: r["pvalue"])

    # 严格过滤：仅保留 adjusted p-value 显著的通路
    strict = [r for r in results if r["adjusted_pvalue"] <= pvalue_cutoff]
    if strict:
        return strict[:20]

    # 当 BH 校正后无显著结果时（常见于大规模研究集），
    # 返回 raw p-value 最小的前 10 个通路供参考
    fallback = [r for r in results if r["pvalue"] <= pvalue_cutoff]
    return fallback[:10]


# ---------------------------------------------------------------------------
# Helper functions for alternative gene input methods
# ---------------------------------------------------------------------------

def _extract_genes_from_file(file_path: str) -> List[str]:
    """从文件中提取基因ID列表。

    支持两种格式：
    1. 纯基因ID文件：每行一个基因ID，或逗号/制表符分隔
    2. 差异分析结果 CSV：自动检测含 gene_id + pvalue/log2fc 列，按阈值筛选
    """
    import csv as csv_module
    p = Path(file_path)
    if not p.exists():
        return []

    content = p.read_text(encoding="utf-8").strip()
    if not content:
        return []

    # 尝试结构化 CSV/TSV 解析
    sep = "\t" if p.suffix in (".tsv", ".txt") and "\t" in content.split("\n")[0] else ","
    try:
        lines = content.split("\n")
        header = lines[0].lower()
        if "gene_id" in header and ("pvalue" in header or "log2fc" in header):
            # 差异分析结果格式
            genes = []
            reader = csv_module.DictReader(lines, delimiter=sep)
            for row in reader:
                gene_id = row.get("gene_id", "").strip()
                if not gene_id:
                    continue
                try:
                    pval = float(row.get("pvalue", row.get("p_value", "1")))
                    l2fc = abs(float(row.get("log2fc", row.get("log2_fc", "0"))))
                except (ValueError, TypeError):
                    continue
                if pval <= 0.05 and l2fc >= 1.0:
                    genes.append(gene_id)
            if genes:
                return genes
    except Exception:
        pass

    # 纯文本格式：每行一个基因ID 或 逗号分隔
    genes = []
    for line in content.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # 多列 TSV（表达矩阵），跳过
        if "\t" in line and len(line.split("\t")) > 3:
            continue
        # 逗号分隔
        if "," in line:
            genes.extend(g.strip() for g in line.split(",") if g.strip() and not g.strip().replace(".", "").replace("-", "").isdigit())
        else:
            # 单行一个基因ID（忽略纯数字行）
            if not line.replace(".", "").replace("-", "").isdigit():
                genes.append(line)
    return genes


def _extract_genes_from_result(result_id: str) -> List[str]:
    """从差异分析结果 JSON 文件中提取显著基因ID列表。"""
    results_dir = Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "analysis_results"
    result_file = results_dir / f"{result_id}.json"
    if not result_file.exists():
        # 也尝试不带 backend 前缀的路径
        results_dir_alt = Path(__file__).resolve().parent.parent.parent / "data" / "analysis_results"
        result_file = results_dir_alt / f"{result_id}.json"
        if not result_file.exists():
            return []

    try:
        data = json.loads(result_file.read_text(encoding="utf-8"))
        tool_result = data.get("tool_result", {})
        sig_genes = tool_result.get("all_significant_genes") or tool_result.get("significant_genes", [])
        return [g["gene_id"] for g in sig_genes if g.get("gene_id")]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Main enrichment_analysis function
# ---------------------------------------------------------------------------

def enrichment_analysis(
    gene_list: str = "",
    gene_file_path: str = "",
    analysis_result_id: str = "",
    analysis_type: str = "both",
    organism: str = "oryza sativa",
    pvalue_cutoff: float = 0.05,
    gene_sets: str = "GO_Biological_Process_2023",
) -> str:
    """对基因列表进行 KEGG 和/或 GO 富集分析（本地 MH63 注释文件）。

    三种输入方式（互斥，按优先级取第一个非空的）：
    1. gene_list: 逗号分隔的基因 ID
    2. gene_file_path: 基因列表文件路径
    3. analysis_result_id: 差异分析结果 ID

    Args:
        gene_list: 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
        gene_file_path: 基因列表文件路径（.txt 每行一个基因ID，或差异分析结果 CSV）
        analysis_result_id: 差异分析结果 ID（如 job_xxxxxxxx）
        analysis_type: "GO" | "KEGG" | "both"，默认 "both"
        organism: 物种名称，默认 "oryza sativa"
        pvalue_cutoff: p 值阈值，默认 0.05
        gene_sets: 保留参数（向后兼容），不再使用

    Returns:
        JSON 字符串，包含 kegg_results、go_results 和 summary。
    """
    # 按优先级提取基因列表
    genes: List[str] = []

    if gene_list and gene_list.strip():
        genes = [g.strip() for g in gene_list.split(",") if g.strip()]
    elif gene_file_path and gene_file_path.strip():
        genes = _extract_genes_from_file(gene_file_path.strip())
        if not genes:
            return json.dumps({"error": f"无法从文件 {gene_file_path} 中提取基因ID"})
    elif analysis_result_id and analysis_result_id.strip():
        genes = _extract_genes_from_result(analysis_result_id.strip())
        if not genes:
            return json.dumps({"error": f"无法从分析结果 {analysis_result_id} 中提取显著基因"})

    if not genes:
        return json.dumps({"error": "请提供基因列表、基因文件路径或差异分析结果ID"})

    # ID 转换: OsMH_ → OsMH63_ (保留原始 ID 映射用于结果回显)
    converted_to_original: Dict[str, str] = {}
    converted_genes: List[str] = []
    for g in genes:
        c = _normalize_gene_id(g)
        converted_to_original[c] = g
        converted_genes.append(c)

    _load_annotations()

    kegg_results: List[Dict[str, Any]] = []
    go_results: List[Dict[str, Any]] = []

    try:
        if analysis_type in ("KEGG", "both"):
            kegg_results = _run_kegg_enrichment(converted_genes, pvalue_cutoff)

        if analysis_type in ("GO", "both"):
            go_results = _run_go_enrichment(converted_genes, pvalue_cutoff)
    except Exception as e:
        return json.dumps({"error": f"Enrichment analysis error: {str(e)}"})

    # 将结果中的基因 ID 转回原始格式
    for item in kegg_results + go_results:
        item["genes"] = [converted_to_original.get(g, g) for g in item["genes"]]

    result: Dict[str, Any] = {
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


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

ENRICHMENT_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "enrichment_analysis",
        "description": (
            "对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析，"
            "使用本地 MH63 水稻注释文件（Fisher 精确检验 + BH 校正）。"
            "支持三种输入方式：1) 直接提供基因ID列表 2) 基因列表文件路径 3) 差异分析结果ID。"
            "返回富集通路列表、统计数据和摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "gene_list": {
                    "type": "string",
                    "description": "逗号分隔的基因 ID 列表，如 'OsMH_01G0000400,OsMH_02G0001200'",
                },
                "gene_file_path": {
                    "type": "string",
                    "description": "基因列表文件路径（.txt 每行一个基因ID，或差异分析结果 CSV）",
                },
                "analysis_result_id": {
                    "type": "string",
                    "description": "差异分析结果 ID（如 job_xxxxxxxx），从中提取显著基因进行富集分析",
                },
                "analysis_type": {
                    "type": "string",
                    "enum": ["GO", "KEGG", "both"],
                    "description": "分析类型：GO、KEGG 或两者都做，默认 both",
                    "default": "both",
                },
                "organism": {
                    "type": "string",
                    "description": "物种名称，默认 'oryza sativa'（水稻 MH63）",
                    "default": "oryza sativa",
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p 值阈值，默认 0.05",
                    "default": 0.05,
                },
            },
            "required": [],
        },
    },
}
