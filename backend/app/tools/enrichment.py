"""KEGG/GO enrichment analysis tool - plain function + JSON schema for Agent Loop."""

import json
from typing import Any, Dict, List


def enrichment_analysis(
    gene_list: str,
    analysis_type: str = "both",
    organism: str = "oryza sativa",
    pvalue_cutoff: float = 0.05,
    gene_sets: str = "GO_Biological_Process_2023",
) -> str:
    """对基因列表进行 KEGG 和/或 GO 富集分析。

    Args:
        gene_list: 逗号分隔的基因 ID，如 "OsMH_01G0000400,OsMH_02G0001200"
        analysis_type: "GO" | "KEGG" | "both"，默认 "both"
        organism: 物种名称，默认 "oryza sativa"（水稻）
        pvalue_cutoff: p 值阈值，默认 0.05
        gene_sets: GO 数据库类型，默认 "GO_Biological_Process_2023"

    Returns:
        JSON 字符串，包含 kegg_results、go_results 和 summary。
    """
    result: Dict[str, Any] = {
        "kegg_results": [],
        "go_results": [],
        "summary": {},
    }

    if not gene_list or not gene_list.strip():
        return json.dumps({"error": "gene_list is empty"})

    genes: List[str] = [g.strip() for g in gene_list.split(",") if g.strip()]
    if not genes:
        return json.dumps({"error": "gene_list is empty"})

    try:
        import gseapy as gp

        kegg_results: List[Dict[str, Any]] = []
        go_results: List[Dict[str, Any]] = []

        def _parse_enr(df: Any) -> List[Dict[str, Any]]:
            rows = []
            df = df[df["Adjusted P-value"] <= pvalue_cutoff].head(20)
            for _, row in df.iterrows():
                overlap = str(row.get("Overlap", "0/0"))
                parts = overlap.split("/")
                hit_genes = [g.strip() for g in str(row.get("Genes", "")).split(";") if g.strip()]
                rows.append({
                    "pathway": str(row["Term"]),
                    "pathway_id": str(row.get("Gene_set", "")),
                    "gene_count": int(parts[0]) if parts[0].isdigit() else 0,
                    "total_genes": int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0,
                    "pvalue": float(row["P-value"]),
                    "adjusted_pvalue": float(row["Adjusted P-value"]),
                    "enrichment_score": float(row.get("Combined Score", 0)),
                    "genes": hit_genes,
                })
            return rows

        if analysis_type in ("KEGG", "both"):
            try:
                enr = gp.enrichr(
                    gene_list=genes,
                    gene_sets="KEGG_2021_Human",
                    organism=organism,
                    cutoff=pvalue_cutoff,
                )
                kegg_results = _parse_enr(enr.results)
            except Exception:
                kegg_results = []

        if analysis_type in ("GO", "both"):
            try:
                enr = gp.enrichr(
                    gene_list=genes,
                    gene_sets=gene_sets,
                    organism=organism,
                    cutoff=pvalue_cutoff,
                )
                go_results = _parse_enr(enr.results)
            except Exception:
                go_results = []

        result["kegg_results"] = kegg_results
        result["go_results"] = go_results
        result["summary"] = {
            "input_gene_count": len(genes),
            "kegg_significant": len(kegg_results),
            "go_significant": len(go_results),
            "top_kegg_pathway": kegg_results[0]["pathway"] if kegg_results else "",
            "top_go_term": go_results[0]["pathway"] if go_results else "",
            "organism": organism,
            "pvalue_cutoff": pvalue_cutoff,
        }

    except ImportError:
        return json.dumps({"error": "gseapy not installed. Run: pip install gseapy>=1.0.0"})
    except Exception as e:
        return json.dumps({"error": f"Enrichr API error: {str(e)}"})

    return json.dumps(result, ensure_ascii=False)


ENRICHMENT_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "enrichment_analysis",
        "description": (
            "对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析。"
            "可接受差异分析结果中的显著基因，或用户直接提供的基因 ID 列表。"
            "返回富集通路列表、统计数据和摘要。"
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
                    "description": "物种名称，默认 'oryza sativa'（水稻）",
                    "default": "oryza sativa",
                },
                "pvalue_cutoff": {
                    "type": "number",
                    "description": "p 值阈值，默认 0.05",
                    "default": 0.05,
                },
                "gene_sets": {
                    "type": "string",
                    "description": "GO 数据库类型，默认 GO_Biological_Process_2023",
                    "default": "GO_Biological_Process_2023",
                },
            },
            "required": ["gene_list"],
        },
    },
}
