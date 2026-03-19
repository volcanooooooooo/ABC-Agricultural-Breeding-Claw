from typing import List, Dict, Any, Optional
import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats

ANALYSIS_RESULTS_DIR = Path("backend/data/analysis_results")

class AnalysisService:
    """数据分析服务"""

    def __init__(self):
        pass

    def calculate_descriptive_stats(self, data: List[float]) -> Dict[str, float]:
        """计算描述性统计"""
        if not data:
            return {}

        arr = np.array(data)
        return {
            "count": len(data),
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr, ddof=1)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr)),
            "median": float(np.median(arr)),
            "q25": float(np.percentile(arr, 25)),
            "q75": float(np.percentile(arr, 75))
        }

    def correlation_analysis(
        self,
        x_data: List[float],
        y_data: List[float]
    ) -> Dict[str, float]:
        """相关性分析"""
        if len(x_data) != len(y_data) or len(x_data) < 3:
            return {"error": "数据长度不足或不一致"}

        correlation, p_value = stats.pearsonr(x_data, y_data)
        spearman_corr, spearman_p = stats.spearmanr(x_data, y_data)

        return {
            "pearson_correlation": float(correlation),
            "pearson_p_value": float(p_value),
            "spearman_correlation": float(spearman_corr),
            "spearman_p_value": float(spearman_p)
        }

    def ttest_two_samples(
        self,
        group1: List[float],
        group2: List[float]
    ) -> Dict[str, float]:
        """两组样本t检验"""
        if len(group1) < 2 or len(group2) < 2:
            return {"error": "每组至少需要2个样本"}

        t_stat, p_value = stats.ttest_ind(group1, group2)
        return {
            "t_statistic": float(t_stat),
            "p_value": float(p_value),
            "significant": p_value < 0.05
        }

    def anova_analysis(
        self,
        groups: List[List[float]]
    ) -> Dict[str, Any]:
        """单因素方差分析"""
        if len(groups) < 2:
            return {"error": "至少需要两组样本"}

        valid_groups = [g for g in groups if len(g) >= 2]
        if len(valid_groups) < 2:
            return {"error": "有效组数不足"}

        f_stat, p_value = stats.f_oneway(*valid_groups)
        return {
            "f_statistic": float(f_stat),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "num_groups": len(valid_groups)
        }

    def regression_analysis(
        self,
        x_data: List[float],
        y_data: List[float]
    ) -> Dict[str, float]:
        """线性回归分析"""
        if len(x_data) != len(y_data) or len(x_data) < 3:
            return {"error": "数据长度不足或不一致"}

        slope, intercept, r_value, p_value, std_err = stats.linregress(x_data, y_data)

        return {
            "slope": float(slope),
            "intercept": float(intercept),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "std_error": float(std_err)
        }

    def phenotypic_correlation(
        self,
        data: Dict[str, List[float]]
    ) -> Dict[str, Any]:
        """表型相关性分析（多个性状）"""
        if not data or len(data) < 2:
            return {"error": "至少需要两个性状的数据"}

        df = pd.DataFrame(data)

        # 计算相关系数矩阵
        corr_matrix = df.corr()

        return {
            "correlation_matrix": corr_matrix.to_dict(),
            "num_traits": len(data),
            "num_samples": len(list(data.values())[0])
        }

    def heritability_estimate(
        self,
        progeny_values: List[float],
        mid_parent_values: List[float]
    ) -> Dict[str, float]:
        """粗略遗传力估计（子代-中亲回归法）"""
        if len(progeny_values) != len(mid_parent_values) or len(progeny_values) < 3:
            return {"error": "数据长度不足或不一致"}

        slope, intercept, r_value, p_value, std_err = stats.linregress(
            mid_parent_values, progeny_values
        )

        # 遗传力 ≈ 回归系数
        heritability = slope

        return {
            "heritability": float(heritability),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "interpretation": "高" if heritability > 0.6 else "中" if heritability > 0.3 else "低"
        }

    def select_top_performers(
        self,
        data: List[Dict[str, Any]],
        trait: str,
        top_n: int = 10,
        ascending: bool = False
    ) -> List[Dict[str, Any]]:
        """选择最优个体"""
        if not data or trait not in data[0]:
            return []

        df = pd.DataFrame(data)
        top_df = df.nlargest(top_n, trait) if not ascending else df.nsmallest(top_n, trait)

        return top_df.to_dict(orient="records")

    def _ensure_results_dir(self):
        """确保结果目录存在"""
        ANALYSIS_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    def save_result(self, job_id: str, result: "AnalysisResult") -> None:
        """保存分析结果到 JSON 文件"""
        self._ensure_results_dir()
        file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"

        # 原子写入：先写临时文件，再 rename
        temp_path = file_path.with_suffix('.tmp')
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2)
        temp_path.replace(file_path)

    def get_results(self, gene_id: Optional[str] = None) -> List[dict]:
        """获取分析结果列表，支持按基因筛选"""
        self._ensure_results_dir()

        if not gene_id:
            # 返回所有结果（按时间倒序）
            results = []
            for file_path in ANALYSIS_RESULTS_DIR.glob("job_*.json"):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        result = json.load(f)
                        results.append(result)
                except (json.JSONDecodeError, IOError):
                    continue
            return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)
        else:
            # 按基因筛选：需要关联 feedback 表
            from app.services.feedback_service import feedback_service
            feedbacks = feedback_service.get_by_gene(gene_id)
            analysis_ids = list(set(fb.analysis_id for fb in feedbacks))

            results = []
            for job_id in analysis_ids:
                file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"
                if file_path.exists():
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            results.append(json.load(f))
                    except (json.JSONDecodeError, IOError):
                        continue
            return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)

    def get_result(self, job_id: str) -> Optional[dict]:
        """获取单个分析结果"""
        file_path = ANALYSIS_RESULTS_DIR / f"{job_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None


# 全局单例
analysis_service = AnalysisService()


from app.models.analysis import (
    ToolResult, LLMResult, GeneInfo, ConsistencyInfo
)

async def run_tool_analysis(
    df: pd.DataFrame,
    control_samples: List[str],
    treatment_samples: List[str],
    pvalue_threshold: float = 0.05,
    log2fc_threshold: float = 1.0
) -> ToolResult:
    """工具轨分析 - 使用 t-test 进行差异检验"""
    import time
    start_time = time.time()

    results = []
    significant = []

    gene_col = df.columns[0]  # 第一列为基因名

    for _, row in df.iterrows():
        gene_id = str(row[gene_col])

        control_values = [row[s] for s in control_samples if s in df.columns]
        treatment_values = [row[s] for s in treatment_samples if s in df.columns]

        if len(control_values) < 2 or len(treatment_values) < 2:
            continue

        control_mean = np.mean(control_values)
        treatment_mean = np.mean(treatment_values)

        if control_mean > 0 and treatment_mean > 0:
            log2fc = np.log2(treatment_mean / control_mean)
        else:
            log2fc = 0

        t_stat, pvalue = stats.ttest_ind(control_values, treatment_values)

        if pvalue < pvalue_threshold and abs(log2fc) >= log2fc_threshold:
            expression_change = "up" if log2fc > 0 else "down"
            significant.append(GeneInfo(
                gene_id=gene_id,
                expression_change=expression_change,
                log2fc=float(log2fc),
                pvalue=float(pvalue)
            ))
        else:
            expression_change = "none"

        results.append(GeneInfo(
            gene_id=gene_id,
            expression_change=expression_change,
            log2fc=float(log2fc),
            pvalue=float(pvalue)
        ))

    execution_time = time.time() - start_time

    return ToolResult(
        method="ttest_scipy",
        significant_genes=significant,
        all_genes=results,
        execution_time=execution_time
    )


async def run_llm_analysis(
    df: pd.DataFrame,
    control_samples: List[str],
    treatment_samples: List[str],
    model: str = "qwen-turbo"
) -> LLMResult:
    """大模型轨分析 - 调用千问 API"""
    import time
    import re
    start_time = time.time()

    gene_col = df.columns[0]
    summary_data = []

    for _, row in df.head(20).iterrows():
        gene_id = str(row[gene_col])
        control_values = [row[s] for s in control_samples if s in df.columns]
        treatment_values = [row[s] for s in treatment_samples if s in df.columns]

        control_mean = np.mean(control_values) if control_values else 0
        treatment_mean = np.mean(treatment_values) if treatment_values else 0

        summary_data.append({
            "gene": gene_id,
            "control_mean": round(control_mean, 2),
            "treatment_mean": round(treatment_mean, 2)
        })

    prompt = f"""你是一个基因表达差异分析专家。请分析以下基因表达数据，找出可能的上调基因和下调基因。

对照组样本: {', '.join(control_samples)}
处理组样本: {', '.join(treatment_samples)}

基因表达数据(前20个):
{chr(10).join([f"- {g['gene']}: 对照组均值={g['control_mean']}, 处理组均值={g['treatment_mean']}" for g in summary_data])}

请分析并返回:
1. 可能上调的基因(处理组明显高于对照组)
2. 可能下调的基因(处理组明显低于对照组)
3. 你的推理过程

请以JSON格式返回:
{{
  "upregulated_genes": ["gene1", "gene2"],
  "downregulated_genes": ["gene3"],
  "reasoning": "你的分析推理过程"
}}
"""

    from app.services.llm_service import llm_service

    llm_result = await llm_service.chat(
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )

    execution_time = time.time() - start_time

    if "error" in llm_result:
        return LLMResult(
            model=model,
            significant_genes=[],
            reasoning=f"LLM调用失败: {llm_result.get('error')}",
            execution_time=execution_time
        )

    content = llm_result.get("content", "")

    significant_genes = []
    readable_reasoning = ""

    try:
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            result = json.loads(json_match.group())

            up_genes = result.get("upregulated_genes", [])
            down_genes = result.get("downregulated_genes", [])

            for g in up_genes:
                significant_genes.append(GeneInfo(
                    gene_id=g,
                    expression_change="up",
                    reason="LLM判断上调"
                ))
            for g in down_genes:
                significant_genes.append(GeneInfo(
                    gene_id=g,
                    expression_change="down",
                    reason="LLM判断下调"
                ))

            # 生成可读的 Markdown 格式 reasoning
            reasoning_parts = []

            # 分析结论
            if up_genes:
                reasoning_parts.append(f"**上调基因**: {', '.join(up_genes)}")
            if down_genes:
                reasoning_parts.append(f"**下调基因**: {', '.join(down_genes)}")

            # 原始推理过程（如果存在）
            raw_reasoning = result.get("reasoning", "")
            if raw_reasoning:
                reasoning_parts.append(f"\n**分析推理**:\n{raw_reasoning}")

            readable_reasoning = "\n\n".join(reasoning_parts) if reasoning_parts else "未返回有效分析结果"
    except Exception:
        # JSON解析失败，直接用原始内容但清理格式
        readable_reasoning = content[:500] if content else "LLM未返回有效分析"

    return LLMResult(
        model=model,
        significant_genes=significant_genes,
        reasoning=readable_reasoning,
        execution_time=execution_time
    )


def calculate_consistency(
    tool_result: ToolResult,
    llm_result: LLMResult
) -> ConsistencyInfo:
    """计算一致性"""
    tool_genes = {g.gene_id for g in tool_result.significant_genes}
    llm_genes = {g.gene_id for g in llm_result.significant_genes}

    overlap = list(tool_genes & llm_genes)
    tool_only = list(tool_genes - llm_genes)
    llm_only = list(llm_genes - tool_genes)

    total = len(tool_genes)
    overlap_rate = len(overlap) / total if total > 0 else 0

    return ConsistencyInfo(
        overlap=overlap,
        tool_only=tool_only,
        llm_only=llm_only,
        overlap_rate=round(overlap_rate, 2)
    )
