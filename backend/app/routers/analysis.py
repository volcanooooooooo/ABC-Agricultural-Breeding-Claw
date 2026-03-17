from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.analysis_service import analysis_service

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
