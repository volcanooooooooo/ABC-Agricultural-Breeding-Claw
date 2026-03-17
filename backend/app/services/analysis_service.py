from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from scipy import stats

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


# 全局单例
analysis_service = AnalysisService()
