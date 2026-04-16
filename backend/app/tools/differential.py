"""Differential expression analysis tool - plain function + JSON schema for Agent Loop."""

import io
import json
import tempfile
import warnings
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from scipy import stats


DEFAULT_DATASET_PATH = "backend/data/datasets/GSE242459_Count_matrix.txt"


def differential_expression_analysis(
    dataset_path: str = DEFAULT_DATASET_PATH,
    control_group: str = "WT",
    treatment_group: str = "osbzip23",
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0,
    inline_data: Optional[str] = None,
) -> str:
    """Perform differential expression analysis on gene expression data.

    Returns JSON string with significant_genes, volcano_data, and summary.
    """
    result: Dict[str, Any] = {"significant_genes": [], "volcano_data": [], "summary": {}}

    try:
        # 优先使用内联数据
        if inline_data:
            try:
                df = pd.read_csv(io.StringIO(inline_data), sep="\t", index_col=0)
            except Exception:
                try:
                    df = pd.read_csv(io.StringIO(inline_data), sep=",", index_col=0)
                except Exception as e:
                    return json.dumps({"error": f"无法解析内联数据: {str(e)}"}, ensure_ascii=False)
        else:
            # Resolve path relative to project root
            path = Path(dataset_path)
            if not path.is_absolute():
                project_root = Path(__file__).parent.parent.parent.parent
                path = project_root / dataset_path

            if not path.exists():
                return json.dumps({"error": f"Dataset file not found: {path}"}, ensure_ascii=False)

            df = pd.read_csv(path, sep="\t", index_col=0)
        if df.empty:
            return json.dumps({"error": "Dataset is empty"}, ensure_ascii=False)

        control_samples = [col for col in df.columns if control_group in col]
        treatment_samples = [col for col in df.columns if treatment_group in col]

        if not control_samples:
            return json.dumps(
                {"error": f"No control samples found matching: {control_group}"},
                ensure_ascii=False,
            )
        if not treatment_samples:
            return json.dumps(
                {"error": f"No treatment samples found matching: {treatment_group}"},
                ensure_ascii=False,
            )

        gene_results = []
        significant_genes = []
        skipped_zero = 0
        skipped_variance = 0

        for gene_id, row in df.iterrows():
            ctrl_vals = [row[s] for s in control_samples]
            trt_vals = [row[s] for s in treatment_samples]

            if len(ctrl_vals) < 2 or len(trt_vals) < 2:
                continue

            ctrl_mean = np.mean(ctrl_vals)
            trt_mean = np.mean(trt_vals)

            if ctrl_mean <= 0 or trt_mean <= 0:
                skipped_zero += 1
                continue

            log2fc = float(np.log2(trt_mean / ctrl_mean))
            _, pvalue = stats.ttest_ind(ctrl_vals, trt_vals)
            pvalue = float(pvalue)
            if np.isnan(pvalue):
                skipped_variance += 1
                continue

            is_sig = pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold
            if is_sig:
                significant_genes.append({
                    "gene_id": str(gene_id),
                    "expression_change": "up" if log2fc > 0 else "down",
                    "log2fc": round(log2fc, 4),
                    "pvalue": round(pvalue, 6),
                })

            gene_results.append({
                "gene_id": str(gene_id),
                "log2fc": round(log2fc, 4),
                "neg_log10_pvalue": round(float(-np.log10(max(pvalue, 1e-300))), 4),
                "pvalue": round(pvalue, 6),
                "significant": bool(is_sig),
            })

        up = [g for g in significant_genes if g["expression_change"] == "up"]
        down = [g for g in significant_genes if g["expression_change"] == "down"]
        up.sort(key=lambda x: x["log2fc"], reverse=True)
        down.sort(key=lambda x: x["log2fc"])

        result["significant_genes"] = up[:10] + down[:10]
        result["all_significant_genes"] = significant_genes
        result["volcano_data"] = sorted(gene_results, key=lambda x: abs(x["log2fc"]), reverse=True)
        result["summary"] = {
            "total_genes_tested": len(gene_results),
            "significant_genes_count": len(significant_genes),
            "upregulated_count": len(up),
            "downregulated_count": len(down),
            "skipped_zero_expression": skipped_zero,
            "skipped_no_variance": skipped_variance,
            "control_group": control_group,
            "treatment_group": treatment_group,
            "control_samples": control_samples,
            "treatment_samples": treatment_samples,
            "pvalue_threshold": pvalue_threshold,
            "log2fc_threshold": log2fc_threshold,
        }

        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({"error": f"Analysis failed: {str(e)}"}, ensure_ascii=False)


# JSON schema for LLM function calling
DIFFERENTIAL_ANALYSIS_SCHEMA = {
    "type": "function",
    "function": {
        "name": "differential_expression_analysis",
        "description": (
            "对基因表达数据进行差异表达分析，比较处理组和对照组，找出显著差异基因。"
            "适用于 RNA-seq 计数数据。"
            "返回：显著差异基因列表、火山图数据、统计摘要。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "dataset_path": {
                    "type": "string",
                    "description": "数据文件路径，默认使用 GSE242459",
                    "default": DEFAULT_DATASET_PATH,
                },
                "control_group": {
                    "type": "string",
                    "description": "对照组名称，用于匹配样本列名，如 'WT'",
                    "default": "WT",
                },
                "treatment_group": {
                    "type": "string",
                    "description": "处理组名称，用于匹配样本列名，如 'osbzip23'",
                    "default": "osbzip23",
                },
                "pvalue_threshold": {
                    "type": "number",
                    "description": "P值阈值，默认 0.05",
                    "default": 0.05,
                },
                "log2fc_threshold": {
                    "type": "number",
                    "description": "log2 Fold Change 阈值，默认 1.0",
                    "default": 1.0,
                },
                "inline_data": {
                    "type": "string",
                    "description": "用户直接粘贴的表达数据（TSV/CSV格式），优先于 dataset_path 使用",
                },
            },
            "required": [],
        },
    },
}
