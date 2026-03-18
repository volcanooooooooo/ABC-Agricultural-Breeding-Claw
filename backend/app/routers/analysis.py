from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
import uuid
import pandas as pd
from typing import Dict, List, Any
from datetime import datetime

from app.services.analysis_service import analysis_service
from app.services.dataset_service import dataset_service
from app.services.analysis_service import (
    run_tool_analysis, run_llm_analysis, calculate_consistency
)
from app.models.analysis import (
    CompareRequest, CompareResponse, AnalysisResult
)

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


# ============ 双轨分析 API 和 SSE ============

# 存储正在进行的任务（带超时清理）
analysis_tasks: Dict[str, CompareRequest] = {}


async def cleanup_task(job_id: str):
    """清理超时任务"""
    if job_id in analysis_tasks:
        del analysis_tasks[job_id]


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

        # 读取数据
        df = pd.read_csv(dataset.file_path)

        try:
            # 发送开始消息
            yield "data: {\"job_id\": \"%s\", \"status\": \"started\", \"progress\": 0}\n\n" % job_id

            # 并行执行双轨分析
            tool_task = run_tool_analysis(
                df, control_samples, treatment_samples,
                request.pvalue_threshold, request.log2fc_threshold
            )
            llm_task = run_llm_analysis(
                df, control_samples, treatment_samples
            )

            # 工具轨进度
            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"正在进行t检验分析...\", \"progress\": 30}\n\n" % job_id

            # 等待结果
            tool_result, llm_result = await asyncio.gather(tool_task, llm_task)

            yield "data: {\"job_id\": \"%s\", \"track\": \"tool\", \"status\": \"工具轨分析完成\", \"progress\": 60}\n\n" % job_id
            yield "data: {\"job_id\": \"%s\", \"track\": \"llm\", \"status\": \"大模型分析完成\", \"progress\": 90}\n\n" % job_id

            # 计算一致性
            consistency = calculate_consistency(tool_result, llm_result)

            # 构建结果
            result = AnalysisResult(
                id=job_id,
                dataset_id=dataset.id,
                dataset_name=dataset.name,
                tool_result=tool_result,
                llm_result=llm_result,
                consistency=consistency,
                created_at=datetime.utcnow().isoformat() + "Z"
            )

            # 发送结果
            yield "data: {\"job_id\": \"%s\", \"status\": \"completed\", \"progress\": 100}\n\n" % job_id
            yield "data: {\"job_id\": \"%s\", \"result\": %s}\n\n" % (
                job_id,
                json.dumps(result.model_dump(), ensure_ascii=False)
            )

        except Exception as e:
            yield "data: {\"job_id\": \"%s\", \"status\": \"error\", \"message\": \"%s\"}\n\n" % (
                job_id,
                str(e).replace('"', '\\"')
            )
        finally:
            # 清理任务
            if job_id in analysis_tasks:
                del analysis_tasks[job_id]

    return StreamingResponse(event_generator(), media_type="text/event-stream")
