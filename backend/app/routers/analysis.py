from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import uuid
import pandas as pd
from typing import Dict, List, Any, Optional
from datetime import datetime

from app.services.analysis_service import analysis_service
from app.services.dataset_service import dataset_service
from app.services.feedback_service import feedback_service
from app.services.ontology_service import ontology_service
from app.services.analysis_service import (
    run_tool_analysis, run_llm_analysis, calculate_consistency
)
from app.models.analysis import (
    CompareRequest, CompareResponse, AnalysisResult, LLMResult
)
from app.tools.enrichment import enrichment_analysis

router = APIRouter()


class DescriptiveStatsRequest(BaseModel):
    """描述性统计请求"""
    data: List[float]


class CorrelationRequest(BaseModel):
    """相关性分析请求"""
    x_data: List[float]
    y_data: List[float]


class TTestRequest(BaseModel):
    """t检验请求"""
    group1: List[float]
    group2: List[float]


class AnovaRequest(BaseModel):
    """方差分析请求"""
    groups: List[List[float]]


class RegressionRequest(BaseModel):
    """回归分析请求"""
    x_data: List[float]
    y_data: List[float]


class PhenotypicCorrelationRequest(BaseModel):
    """表型相关性请求"""
    data: Dict[str, List[float]]


class HeritabilityRequest(BaseModel):
    """遗传力估计请求"""
    progeny_values: List[float]
    mid_parent_values: List[float]


class TopPerformersRequest(BaseModel):
    """最优个体选择请求"""
    data: List[Dict[str, Any]]
    trait: str
    top_n: int = 10
    ascending: bool = False


class EnrichmentRequest(BaseModel):
    """富集分析请求"""
    gene_list: List[str]
    analysis_type: str = "both"
    pvalue_cutoff: float = 0.05


@router.post("/descriptive")
async def descriptive_stats(request: DescriptiveStatsRequest):
    """描述性统计"""
    try:
        result = analysis_service.calculate_descriptive_stats(request.data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correlation")
async def correlation_analysis(request: CorrelationRequest):
    """相关性分析"""
    try:
        result = analysis_service.correlation_analysis(
            request.x_data,
            request.y_data
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ttest")
async def ttest_analysis(request: TTestRequest):
    """t检验"""
    try:
        result = analysis_service.ttest_two_samples(
            request.group1,
            request.group2
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anova")
async def anova_analysis(request: AnovaRequest):
    """方差分析"""
    try:
        result = analysis_service.anova_analysis(request.groups)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regression")
async def regression_analysis(request: RegressionRequest):
    """回归分析"""
    try:
        result = analysis_service.regression_analysis(
            request.x_data,
            request.y_data
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/phenotypic-correlation")
async def phenotypic_correlation(request: PhenotypicCorrelationRequest):
    """表型相关性分析"""
    try:
        result = analysis_service.phenotypic_correlation(request.data)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/heritability")
async def heritability(request: HeritabilityRequest):
    """遗传力估计"""
    try:
        result = analysis_service.heritability_estimate(
            request.progeny_values,
            request.mid_parent_values
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/top-performers")
async def select_top_performers(request: TopPerformersRequest):
    """选择最优个体"""
    try:
        result = analysis_service.select_top_performers(
            request.data,
            request.trait,
            request.top_n,
            request.ascending
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result)
        return {"top_performers": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/methods")
async def get_analysis_methods():
    """获取可用的分析方法"""
    return {
        "methods": [
            {"name": "descriptive", "description": "描述性统计"},
            {"name": "correlation", "description": "相关性分析"},
            {"name": "ttest", "description": "独立样本t检验"},
            {"name": "anova", "description": "单因素方差分析"},
            {"name": "regression", "description": "线性回归分析"},
            {"name": "phenotypic-correlation", "description": "多性状表型相关性"},
            {"name": "heritability", "description": "遗传力估计"},
            {"name": "top-performers", "description": "最优个体选择"}
        ]
    }


@router.post("/enrichment")
async def run_enrichment(request: EnrichmentRequest):
    """直接调用富集分析（不经过 Agent 循环）"""
    if not request.gene_list:
        raise HTTPException(status_code=400, detail="gene_list is empty")

    gene_list_str = ",".join(request.gene_list)
    raw = enrichment_analysis(
        gene_list=gene_list_str,
        analysis_type=request.analysis_type,
        pvalue_cutoff=request.pvalue_cutoff,
    )
    result = json.loads(raw)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return {"status": "success", "data": result}


# ============ 双轨分析 API 和 SSE ============

# 存储正在进行的任务（带超时清理）
analysis_tasks: Dict[str, CompareRequest] = {}

# 存储已取消的任务
cancelled_jobs: set = set()


async def cleanup_task(job_id: str):
    """清理超时任务"""
    if job_id in analysis_tasks:
        del analysis_tasks[job_id]
    if job_id in cancelled_jobs:
        cancelled_jobs.discard(job_id)


def schedule_cleanup(job_id: str, delay: int = 3600):
    """安排任务清理（1小时后）"""
    try:
        loop = asyncio.get_running_loop()
        loop.call_later(delay, lambda: asyncio.create_task(cleanup_task(job_id)))
    except Exception:
        pass


@router.post("/compare", response_model=CompareResponse)
async def start_comparison(request: CompareRequest):
    """发起双轨对比分析"""
    # 验证数据集存在
    dataset = dataset_service.get_by_id(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 验证分组存在
    if request.group_control not in dataset.groups:
        raise HTTPException(status_code=400, detail=f"Group '{request.group_control}' not found")
    if request.group_treatment not in dataset.groups:
        raise HTTPException(status_code=400, detail=f"Group '{request.group_treatment}' not found")

    # 创建任务 ID
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    analysis_tasks[job_id] = request

    # 安排任务清理（1小时后自动删除）
    schedule_cleanup(job_id)

    return CompareResponse(job_id=job_id, status="started")


@router.post("/cancel/{job_id}")
async def cancel_analysis(job_id: str):
    """取消正在进行的分析任务"""
    if job_id not in analysis_tasks:
        raise HTTPException(status_code=404, detail="Job not found or already completed")

    cancelled_jobs.add(job_id)
    return {"status": "success", "message": "Analysis cancellation requested"}


@router.get("/results")
async def get_analysis_results(gene_id: Optional[str] = None):
    """获取分析结果列表，支持按基因筛选"""
    results = analysis_service.get_results(gene_id)

    # 计算每个结果的反馈统计
    all_feedbacks = feedback_service.get_all()

    summary_results = []
    for result in results:
        job_id = result.get('id')
        job_feedbacks = [fb for fb in all_feedbacks if fb.analysis_id == job_id]

        positive_count = sum(1 for fb in job_feedbacks if fb.rating == 'positive')
        total_count = len(job_feedbacks)
        avg_rating = positive_count / total_count if total_count > 0 else 0.0

        summary_results.append({
            "id": result.get('id'),
            "dataset_id": result.get('dataset_id'),
            "dataset_name": result.get('dataset_name'),
            "created_at": result.get('created_at'),
            "feedback_count": total_count,
            "avg_rating": round(avg_rating, 2)
        })

    return {"status": "success", "data": summary_results}


@router.get("/results/{job_id}")
async def get_analysis_result(job_id: str):
    """获取单个分析结果详情"""
    result = analysis_service.get_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    return {"status": "success", "data": result}


@router.get("/stream/{job_id}")
async def stream_analysis(job_id: str):
    """SSE 流式接收分析进度和结果"""
    if job_id not in analysis_tasks:
        raise HTTPException(status_code=404, detail="Job not found")

    request = analysis_tasks[job_id]

    async def event_generator():
        # 获取数据集
        dataset = dataset_service.get_by_id(request.dataset_id)
        control_samples = dataset.groups[request.group_control]
        treatment_samples = dataset.groups[request.group_treatment]

        # 读取数据 (可能是 TSV 或 CSV 格式)
        df = pd.read_csv(dataset.file_path, sep='\t')

        async def delay(seconds: float):
            """异步延迟，可检查取消状态"""
            for _ in range(int(seconds * 10)):
                if job_id in cancelled_jobs:
                    return True  # 表示已取消
                await asyncio.sleep(0.1)
            return False  # 表示未取消

        async def delay_no_cancel(seconds: float):
            """异步延迟，不检查取消状态"""
            await asyncio.sleep(seconds)

        async def check_cancellation():
            """检查是否已取消"""
            return job_id in cancelled_jobs

        def is_cancelled() -> bool:
            return job_id in cancelled_jobs

        try:
            # 步骤0: 开始 (0%)
            yield "data: {\"job_id\": \"%s\", \"track\": \"init\", \"status\": \"正在初始化分析任务...\", \"progress\": 5, \"currentStep\": \"读取数据集\"}\n\n" % job_id
            await delay_no_cancel(0.5)

            yield "data: {\"job_id\": \"%s\", \"track\": \"init\", \"status\": \"正在加载数据...\", \"progress\": 10, \"currentStep\": \"数据加载\"}\n\n" % job_id
            await delay_no_cancel(0.5)

            yield "data: {\"job_id\": \"%s\", \"track\": \"init\", \"status\": \"数据加载完成，正在准备分析...\", \"progress\": 15, \"currentStep\": \"数据预处理\"}\n\n" % job_id
            await delay_no_cancel(0.4)

            # 检查取消状态
            if await check_cancellation():
                return

            # 步骤1: 工具轨分析 (15% -> 50%)
            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在进行t检验分析...\", \"progress\": 20, \"currentStep\": \"工具轨 - 统计检验\"}\n\n" % job_id
            await delay_no_cancel(0.6)

            # 启动工具轨任务
            tool_result = await run_tool_analysis(
                df, control_samples, treatment_samples,
                request.pvalue_threshold, request.log2fc_threshold
            )

            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在计算差异表达...\", \"progress\": 30, \"currentStep\": \"工具轨 - 差异分析\"}\n\n" % job_id
            await delay_no_cancel(0.5)

            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在进行p值校正...\", \"progress\": 38, \"currentStep\": \"工具轨 - p值校正\"}\n\n" % job_id
            await delay_no_cancel(0.5)

            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"工具轨分析完成\", \"progress\": 50, \"currentStep\": \"工具轨 - 完成\"}\n\n" % job_id

            # 检查取消状态 - 如果取消，跳过LLM轨
            if await check_cancellation():
                yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"已跳过LLM轨\", \"progress\": 55, \"currentStep\": \"LLM轨 - 已取消\"}\n\n" % job_id
                llm_result = LLMResult(
                    model="qwen-turbo",
                    significant_genes=[],
                    reasoning="用户取消了LLM轨分析",
                    execution_time=0
                )
            else:
                # 步骤2: LLM轨分析 (50% -> 75%)
                yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"正在调用大模型进行分析...\", \"progress\": 55, \"currentStep\": \"LLM轨 - 模型调用\"}\n\n" % job_id
                await delay_no_cancel(0.4)

                llm_result = await run_llm_analysis(
                    df, control_samples, treatment_samples
                )

                yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"大模型正在解读数据...\", \"progress\": 60, \"currentStep\": \"LLM轨 - 数据解读\"}\n\n" % job_id
                await delay_no_cancel(0.5)

                yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"大模型正在推理差异基因...\", \"progress\": 68, \"currentStep\": \"LLM轨 - 基因推理\"}\n\n" % job_id
                await delay_no_cancel(0.4)

                yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"大模型轨分析完成\", \"progress\": 75, \"currentStep\": \"LLM轨 - 完成\"}\n\n" % job_id
                await delay_no_cancel(0.3)

            # 步骤3: 一致性分析 (75% -> 90%)
            yield "data: {\"job_id\": \"%s\", \"track\": \"consistency\", \"status\": \"正在计算双轨一致性...\", \"progress\": 82, \"currentStep\": \"一致性分析\"}\n\n" % job_id
            await delay_no_cancel(0.4)

            consistency = calculate_consistency(tool_result, llm_result)

            yield "data: {\"job_id\": \"%s\", \"track\": \"consistency\", \"status\": \"一致性分析完成，正在生成报告...\", \"progress\": 88, \"currentStep\": \"报告生成\"}\n\n" % job_id
            await delay_no_cancel(0.3)

            # 构建结果
            result = AnalysisResult(
                id=job_id,
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                group_control=request.group_control,
                group_treatment=request.group_treatment,
                tool_result=tool_result,
                llm_result=llm_result,
                consistency=consistency,
                created_at=datetime.utcnow().isoformat() + "Z"
            )

            # 保存结果到 JSON 文件
            analysis_service.save_result(job_id, result)

            # 跳过同步基因到本体库步骤
            # yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在同步基因到本体库...\", \"progress\": 92, \"currentStep\": \"本体库同步\"}\n\n" % job_id
            # await delay_no_cancel(0.2)

            # # 收集显著基因并同步到本体库
            # all_significant_genes = []
            # for g in tool_result.significant_genes:
            #     all_significant_genes.append({
            #         "gene_id": g.gene_id,
            #         "expression_change": g.expression_change,
            #         "log2fc": g.log2fc,
            #         "pvalue": g.pvalue,
            #     })

            # if all_significant_genes:
            #     try:
            #         # 使用 ontology_service 同步基因
            #         for g in all_significant_genes:
            #             ontology_service.get_or_create_gene_node(
            #                 gene_id=g["gene_id"],
            #                 properties={
            #                     "expression_change": g["expression_change"],
            #                     "log2fc": g.get("log2fc"),
            #                     "pvalue": g.get("pvalue"),
            #                     "source_analysis": job_id,
            #                     "source_dataset": dataset.id,
            #                     "source_dataset_name": dataset.name,
            #                 }
            #             )
            #             ontology_service.add_analysis_result_edge(
            #                 gene_id=g["gene_id"],
            #                 analysis_id=job_id,
            #                 expression_change=g["expression_change"]
            #             )
            #     except Exception as e:
            #         print(f"Failed to sync genes to ontology: {e}")

            # 步骤4: 完成 (90% -> 100%)
            yield "data: {\"job_id\": \"%s\", \"status\": \"completed\", \"progress\": 95, \"currentStep\": \"完成\"}\n\n" % job_id
            await delay_no_cancel(0.3)

            # 发送结果
            yield "data: {\"job_id\": \"%s\", \"result\": %s}\n\n" % (
                job_id,
                json.dumps(result.model_dump(), ensure_ascii=False)
            )

            yield "data: {\"job_id\": \"%s\", \"status\": \"completed\", \"progress\": 100, \"currentStep\": \"完成\"}\n\n" % job_id

        except Exception as e:
            yield "data: {\"job_id\": \"%s\", \"status\": \"error\", \"message\": \"%s\"}\n\n" % (
                job_id,
                str(e).replace('"', '\\"')
            )
        finally:
            # 清理任务
            if job_id in analysis_tasks:
                del analysis_tasks[job_id]
            if job_id in cancelled_jobs:
                cancelled_jobs.discard(job_id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
