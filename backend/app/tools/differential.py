"""Differential expression analysis tool using LangChain @tool decorator."""

import json
from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
from scipy import stats
from langchain.tools import tool


DEFAULT_DATASET_PATH = "backend/data/real_datasets/GSE242459_Count_matrix.txt"


@tool
def differential_expression_analysis(
    dataset_path: str = DEFAULT_DATASET_PATH,
    control_group: str = "WT",
    treatment_group: str = "osbzip23",
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0
) -> str:
    """Perform differential expression analysis on gene expression data.

    Analyzes gene expression data to identify differentially expressed genes
    between treatment and control groups using t-test statistics.

    Args:
        dataset_path: Path to the tab-separated gene expression matrix file.
            First column should be gene_id, subsequent columns are sample data.
            Defaults to backend/data/real_datasets/GSE242459_Count_matrix.txt
        control_group: Pattern to identify control sample columns (default: "WT").
            Columns containing this string will be used as control samples.
        treatment_group: Pattern to identify treatment sample columns (default: "osbzip23").
            Columns containing this string will be used as treatment samples.
        pvalue_threshold: Maximum p-value for a gene to be considered significant (default: 0.05).
        log2fc_threshold: Minimum absolute log2 fold change for significance (default: 1.0).

    Returns:
        JSON string containing:
        - significant_genes: List of up to 50 significantly changed genes with gene_id,
          expression_change (up/down), log2fc, and pvalue
        - volcano_data: All genes with log2fc and -log10(pvalue) for volcano plotting
        - summary: Statistics about the analysis including total genes tested,
          number of upregulated genes, number of downregulated genes, etc.
    """
    result = {
        "significant_genes": [],
        "volcano_data": [],
        "summary": {}
    }

    try:
        # Resolve dataset path relative to project root
        if not Path(dataset_path).is_absolute():
            project_root = Path(__file__).parent.parent.parent.parent
            dataset_path = project_root / dataset_path

        if not Path(dataset_path).exists():
            return json.dumps({
                "error": f"Dataset file not found: {dataset_path}"
            }, ensure_ascii=False, indent=2)

        # Read tab-separated gene expression matrix
        df = pd.read_csv(dataset_path, sep="\t", index_col=0)

        if df.empty:
            return json.dumps({"error": "Dataset is empty"}, ensure_ascii=False, indent=2)

        # Identify control and treatment sample columns by pattern matching
        control_samples = [col for col in df.columns if control_group in col]
        treatment_samples = [col for col in df.columns if treatment_group in col]

        if not control_samples:
            return json.dumps({
                "error": f"No control samples found matching pattern: {control_group}"
            }, ensure_ascii=False, indent=2)

        if not treatment_samples:
            return json.dumps({
                "error": f"No treatment samples found matching pattern: {treatment_group}"
            }, ensure_ascii=False, indent=2)

        # Perform t-test for each gene
        gene_results = []
        significant_genes = []

        for gene_id, row in df.iterrows():
            control_values = [row[s] for s in control_samples if s in df.columns]
            treatment_values = [row[s] for s in treatment_samples if s in df.columns]

            # Skip genes with insufficient data
            if len(control_values) < 2 or len(treatment_values) < 2:
                continue

            # Skip genes with zero or negative values in either group
            control_mean = np.mean(control_values)
            treatment_mean = np.mean(treatment_values)

            if control_mean <= 0 or treatment_mean <= 0:
                continue

            # Calculate log2 fold change
            log2fc = np.log2(treatment_mean / control_mean)

            # Perform independent t-test
            t_stat, pvalue = stats.ttest_ind(control_values, treatment_values)

            # Determine expression change
            if pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold:
                expression_change = "up" if log2fc > 0 else "down"
                significant_genes.append({
                    "gene_id": str(gene_id),
                    "expression_change": expression_change,
                    "log2fc": float(log2fc),
                    "pvalue": float(pvalue)
                })

            # Store for volcano plot data
            gene_results.append({
                "gene_id": str(gene_id),
                "log2fc": float(log2fc),
                "neg_log10_pvalue": float(-np.log10(pvalue)) if pvalue > 0 else 0,
                "pvalue": float(pvalue),
                "significant": pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold
            })

        # Sort significant genes by absolute log2fc (descending) and take top 50
        significant_genes.sort(key=lambda x: abs(x["log2fc"]), reverse=True)
        significant_genes = significant_genes[:50]

        # Sort volcano data by absolute log2fc for better visualization
        gene_results.sort(key=lambda x: abs(x["log2fc"]), reverse=True)

        # Calculate summary statistics
        upregulated = len([g for g in significant_genes if g["expression_change"] == "up"])
        downregulated = len([g for g in significant_genes if g["expression_change"] == "down"])

        result["significant_genes"] = significant_genes
        result["volcano_data"] = gene_results
        result["summary"] = {
            "total_genes_tested": len(gene_results),
            "significant_genes_count": len(significant_genes),
            "upregulated_count": upregulated,
            "downregulated_count": downregulated,
            "control_samples": control_samples,
            "treatment_samples": treatment_samples,
            "pvalue_threshold": pvalue_threshold,
            "log2fc_threshold": log2fc_threshold
        }

        return json.dumps(result, ensure_ascii=False, indent=2)

    except Exception as e:
        return json.dumps({
            "error": f"Analysis failed: {str(e)}"
        }, ensure_ascii=False, indent=2)
