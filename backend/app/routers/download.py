"""Download router for analysis results."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import io
import numpy as np
import pandas as pd
from scipy import stats

from app.services.analysis_service import analysis_service, ANALYSIS_RESULTS_DIR
from app.services.dataset_service import dataset_service

router = APIRouter()


@router.get("/volcano/{job_id}")
async def get_volcano_data(job_id: str):
    """获取火山图全量数据（含不显著基因），按需重新计算"""
    result_data = analysis_service.get_result(job_id)
    if not result_data:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    dataset_id = result_data.get("dataset_id")
    group_control = result_data.get("group_control")
    group_treatment = result_data.get("group_treatment")

    dataset = dataset_service.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = pd.read_csv(dataset.file_path, sep='\t')
        gene_col = df.columns[0]
        gene_ids = df[gene_col].astype(str).values

        control_cols = [c for c in dataset.groups.get(group_control, []) if c in df.columns]
        treatment_cols = [c for c in dataset.groups.get(group_treatment, []) if c in df.columns]

        if not control_cols or not treatment_cols:
            raise HTTPException(status_code=400, detail="Sample columns not found in dataset")

        control_data = df[control_cols].values.astype(float)
        treatment_data = df[treatment_cols].values.astype(float)

        control_means = np.mean(control_data, axis=1)
        treatment_means = np.mean(treatment_data, axis=1)

        with np.errstate(divide='ignore', invalid='ignore'):
            log2fc = np.where(
                (control_means > 0) & (treatment_means > 0),
                np.log2(treatment_means / control_means),
                0
            )

        _, p_values = stats.ttest_ind(control_data, treatment_data, axis=1)

        pvalue_threshold = 0.05
        log2fc_threshold = 1.0

        points = []
        for i in range(len(gene_ids)):
            pval = float(p_values[i])
            fc = float(log2fc[i])
            if np.isnan(pval) or np.isnan(fc):
                continue
            significant = pval < pvalue_threshold and abs(fc) >= log2fc_threshold
            change = ("up" if fc > 0 else "down") if significant else "none"
            points.append({
                "gene_id": gene_ids[i],
                "log2fc": round(fc, 4),
                "neg_log10_pvalue": round(-np.log10(pval) if pval > 0 else 0, 4),
                "pvalue": round(pval, 6),
                "expression_change": change,
            })

        return {"status": "success", "data": points, "total": len(points)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute volcano data: {str(e)}")


@router.get("/result-file/{job_id}")
async def download_result_file(job_id: str):
    """下载原始分析结果 JSON 文件"""
    file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Analysis result file not found")
    return FileResponse(
        path=str(file_path),
        media_type="application/json",
        filename=f"analysis_result_{job_id}.json"
    )


@router.get("/analysis/{job_id}")
async def download_analysis_csv(job_id: str):
    """下载完整的差异表达基因列表（CSV格式）"""
    result_data = analysis_service.get_result(job_id)
    if not result_data:
        raise HTTPException(status_code=404, detail="Analysis result not found")

    tool_result = result_data.get("tool_result", {})
    all_genes = tool_result.get("all_significant_genes") or tool_result.get("significant_genes", [])

    if not all_genes:
        raise HTTPException(status_code=404, detail="No significant genes found in this analysis")

    lines = ["Gene ID,Expression Change,log2FC,P-value"]
    for gene in all_genes:
        gene_id = gene.get("gene_id", "")
        change = gene.get("expression_change", "")
        log2fc = gene.get("log2fc", 0)
        pvalue = gene.get("pvalue", 1)
        lines.append(f"{gene_id},{change},{log2fc:.6f},{pvalue:.6e}")

    csv_content = "\n".join(lines) + "\n"
    output = io.BytesIO()
    output.write(csv_content.encode("utf-8-sig"))
    output.seek(0)

    dataset_name = result_data.get("dataset_name", "analysis")
    safe_name = "".join(c if c.isascii() and c not in r'\/:*?"<>|' else "_" for c in dataset_name)
    filename = f"differential_genes_{safe_name}_{job_id}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )
