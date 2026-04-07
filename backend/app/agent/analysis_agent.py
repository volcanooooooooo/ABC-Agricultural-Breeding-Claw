"""LangChain ReAct Agent for differential expression analysis."""

import json
import re
from typing import Any, Dict

from app.tools.differential import differential_expression_analysis


def parse_analysis_command(user_input: str) -> Dict[str, Any]:
    """Parse analysis command or natural language into tool parameters.

    Supports formats:
    - /analyze --control WT --treatment osbzip23
    - /diff --control WT --treatment osbzip23 --pvalue 0.01
    - Natural language like "分析 WT 和 osbzip23 的差异"
    """
    params = {
        "dataset_path": "backend/data/datasets/GSE242459_Count_matrix.txt",
        "control_group": "WT",
        "treatment_group": "osbzip23",
        "pvalue_threshold": 0.05,
        "log2fc_threshold": 1.0
    }

    # If it's a command, parse arguments
    if user_input.strip().startswith("/"):
        # Parse --key value patterns
        control_match = re.search(r'--control\s+(\w+)', user_input, re.IGNORECASE)
        treatment_match = re.search(r'--treatment\s+(\w+)', user_input, re.IGNORECASE)
        pvalue_match = re.search(r'--pvalue\s+([\d.]+)', user_input, re.IGNORECASE)
        log2fc_match = re.search(r'--log2fc\s+([\d.]+)', user_input, re.IGNORECASE)

        if control_match:
            params["control_group"] = control_match.group(1)
        if treatment_match:
            params["treatment_group"] = treatment_match.group(1)
        if pvalue_match:
            params["pvalue_threshold"] = float(pvalue_match.group(1))
        if log2fc_match:
            params["log2fc_threshold"] = float(log2fc_match.group(1))
    else:
        # Natural language parsing
        # Extract control/treatment groups
        wt_match = re.search(r'(?:WT|wild.?type|对照)', user_input, re.IGNORECASE)
        treatment_match = re.search(r'(osbzip23|treatment|处理)', user_input, re.IGNORECASE)

        if wt_match and treatment_match:
            # Try to determine which is control and which is treatment
            text_lower = user_input.lower()
            if text_lower.index('wt') < text_lower.index('osbzip23') or \
               text_lower.index('wild') < text_lower.index('osbzip23'):
                params["control_group"] = "WT"
                params["treatment_group"] = "osbzip23"

        # Check for threshold values
        pvalue_match = re.search(r'p[.-]?value\s*[<=]?\s*([\d.]+)', user_input, re.IGNORECASE)
        if pvalue_match:
            params["pvalue_threshold"] = float(pvalue_match.group(1))

    return params


def format_analysis_result(result_json: str) -> str:
    """Format the analysis JSON result into a readable message."""
    try:
        data = json.loads(result_json)

        if "error" in data:
            return f"分析错误: {data['error']}"

        summary = data.get("summary", {})
        genes = data.get("significant_genes", [])

        output = []
        output.append("=" * 60)
        output.append("ABC 差异表达分析结果")
        output.append("=" * 60)
        output.append(f"数据集: GSE242459_Count_matrix.txt")
        output.append(f"对照组 ({summary.get('control_group', 'WT')}): {', '.join(summary.get('control_samples', []))}")
        output.append(f"处理组 ({summary.get('treatment_group', 'treatment')}): {', '.join(summary.get('treatment_samples', []))}")
        output.append(f"P值阈值: {summary.get('pvalue_threshold', 0.05)}")
        output.append(f"log2FC阈值: {summary.get('log2fc_threshold', 1.0)}")
        output.append("")
        output.append(f"总测试基因数: {summary.get('total_genes_tested', 0)}")
        output.append(f"显著差异基因数: {summary.get('significant_genes_count', 0)}")
        output.append(f"  - 上调基因 (Up): {summary.get('upregulated_count', 0)}")
        output.append(f"  - 下调基因 (Down): {summary.get('downregulated_count', 0)}")
        output.append("")
        output.append("=" * 60)
        output.append("显著差异基因列表 (Top 20 by |log2FC|)")
        output.append("=" * 60)
        output.append(f"{'Gene ID':<20} {'log2FC':>10} {'P-value':>12} {'变化':>8}")
        output.append("-" * 60)

        for gene in genes[:20]:
            change = "Up" if gene.get("expression_change") == "up" else "Down"
            output.append(
                f"{gene.get('gene_id', ''):<20} "
                f"{gene.get('log2fc', 0):>10.4f} "
                f"{gene.get('pvalue', 0):>12.6f} "
                f"{change:>8}"
            )

        if len(genes) > 20:
            output.append(f"... 还有 {len(genes) - 20} 个基因")

        # Add the JSON data for frontend parsing
        output.append("")
        output.append(f"<!-- ANALYSIS_DATA: {result_json} -->")

        return "\n".join(output)

    except Exception as e:
        return f"结果格式化失败: {str(e)}\n\n原始结果:\n{result_json}"


async def run_analysis(user_input: str) -> Dict[str, Any]:
    """Run differential expression analysis based on user input.

    Args:
        user_input: Command or natural language request for analysis
            Examples:
            - "/analyze --control WT --treatment osbzip23"
            - "分析处理组osbzip23与对照组WT的差异表达基因"

    Returns:
        Dict with keys:
        - success: bool indicating if analysis completed
        - output: str result from agent (formatted analysis results)
        - error: str error message if failed
    """
    try:
        # Parse command/natural language into parameters
        params = parse_analysis_command(user_input)

        # Call the differential expression tool
        result = differential_expression_analysis.invoke(params)

        # Format the result
        formatted_output = format_analysis_result(result)

        return {
            "success": True,
            "output": formatted_output,
            "error": None
        }

    except Exception as e:
        return {
            "success": False,
            "output": None,
            "error": str(e)
        }
