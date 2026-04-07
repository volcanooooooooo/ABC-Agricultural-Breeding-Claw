#!/usr/bin/env python3
"""
RNA-seq 差异表达分析
Step 1: 使用 PyDESeq2 进行差异分析

比较:
1. DS_osbzip23 vs DS_WT (干旱胁迫下突变体 vs 野生型)
2. DS_WT vs N_WT (干旱胁迫 vs 正常条件)

筛选标准: padj < 0.05 & |log2FC| > 1
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pydeseq2.dds import DeseqDataSet
from pydeseq2.ds import DeseqStats
import warnings
warnings.filterwarnings('ignore')

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# 路径配置
DATA_DIR = 'data'
RESULTS_DIR = 'results'
FIGURES_DIR = 'figures'


def load_count_matrix(filepath):
    """加载计数矩阵"""
    df = pd.read_csv(filepath, sep='\t', index_col=0)
    print(f"加载数据: {df.shape[0]} 基因, {df.shape[1]} 样本")
    print(f"样本列表: {list(df.columns)}")
    return df


def prepare_deseq_dataset(count_df, design_factor, reference_level, comparison_level):
    """
    准备 DESeq2 数据集

    Parameters:
    -----------
    count_df : pd.DataFrame
        计数矩阵
    design_factor : str
        设计因子名称
    reference_level : str
        对照组
    comparison_level : str
        实验组
    """
    # 创建样本元数据
    samples = count_df.columns.tolist()
    # 从样本名提取条件 (DS_osbzip23, DS_WT, N_WT, RE_WT)
    conditions = [s.split('_rep')[0] for s in samples]

    col_data = pd.DataFrame({
        'sample': samples,
        'condition': conditions
    })
    col_data.set_index('sample', inplace=True)

    # 设置条件类别 (包含所有条件)
    col_data['condition'] = pd.Categorical(col_data['condition'])

    # 创建 DeseqDataSet
    # 注意: anndata 期望 samples 为 rows (obs), genes 为 columns (var)
    # 所以需要转置计数矩阵
    dds = DeseqDataSet(
        counts=count_df.T,
        metadata=col_data,
        design='~condition',
        design_factors=design_factor,
        n_cpus=1  # Windows multiprocessing 兼容
    )

    return dds


def run_deseq_analysis(dds, contrast, comparison_name):
    """
    运行 DESeq2 差异分析

    Parameters:
    -----------
    dds : DeseqDataSet
    contrast : list
        [factor, numerator, denominator]
    comparison_name : str

    Returns:
    --------
    pd.DataFrame: 差异分析结果
    """
    # 运行 DESeq2
    dds.deseq2()

    # 统计检验
    stat_res = DeseqStats(dds, contrast=contrast)
    stat_res.summary()

    # 获取结果
    results_df = stat_res.results_df

    # 添加比较名称
    results_df['comparison'] = comparison_name

    # 重命名列使其更直观
    results_df.rename(columns={
        'stat': 'W_stat',
        'pvalue': 'pvalue',
        'padj': 'padj'
    }, inplace=True)

    return results_df


def filter_significant_genes(df, padj_thresh=0.05, lfc_thresh=1):
    """
    筛选显著差异基因

    Parameters:
    -----------
    df : pd.DataFrame
        差异分析结果
    padj_thresh : float
        padj 阈值
    lfc_thresh : float
        log2FC 阈值

    Returns:
    --------
    pd.DataFrame: 筛选后的显著基因
    """
    sig = df[(df['padj'] < padj_thresh) & (df['log2FoldChange'].abs() > lfc_thresh)].copy()
    sig['direction'] = sig['log2FoldChange'].apply(lambda x: 'up' if x > 0 else 'down')
    return sig


def save_results(results_df, sig_genes, comparison_name):
    """保存差异分析结果"""
    # 保存完整结果
    full_path = os.path.join(RESULTS_DIR, f'{comparison_name}_all_results.csv')
    results_df.to_csv(full_path)
    print(f"完整结果已保存: {full_path}")

    # 保存显著基因
    if len(sig_genes) > 0:
        sig_path = os.path.join(RESULTS_DIR, f'{comparison_name}_significant.csv')
        sig_genes.to_csv(sig_path)
        print(f"显著基因已保存: {sig_path}")

    return full_path, sig_path


def plot_pca(dds, output_path):
    """
    绘制 PCA 图

    Parameters:
    -----------
    dds : DeseqDataSet
    output_path : str
    """
    # 获取标准化后的数据
    # DeseqDataSet extends AnnData, so dds IS the AnnData object
    # 只估计 size factors，不运行完整的 DESeq2 分析
    dds.fit_size_factors()

    # 从 AnnData 获取 normalized counts
    # size factors are in obs, raw counts are in X (samples x genes)
    size_factors = dds.obs['size_factors'].values
    raw_counts = dds.X  # shape: (samples, genes)

    # 计算 normalized counts
    # Handle sparse matrix if present
    if hasattr(raw_counts, 'toarray'):
        raw_counts = raw_counts.toarray()

    norm_counts = raw_counts / size_factors[:, None]

    # 转换为 DataFrame，基因名为列，样本名为索引
    gene_names = dds.var_names
    sample_names = dds.obs_names
    norm_counts_df = pd.DataFrame(norm_counts, index=sample_names, columns=gene_names)

    # 转置使样本为行
    norm_counts_T = norm_counts_df.T

    # PCA 变换 (使用前 500 个高变异基因)
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    # 过滤低表达基因 (至少在一个样本中 > 10)
    gene_means = norm_counts_T.mean(axis=1)  # 每个基因在所有样本中的平均表达
    high_expr_mask = gene_means > 10
    norm_counts_filtered = norm_counts_T[high_expr_mask]

    # 选择高变异基因
    gene_vars = norm_counts_filtered.var(axis=1).sort_values(ascending=False)
    top_genes = gene_vars.head(500).index
    X = norm_counts_filtered.loc[top_genes].values

    # 转置: X应该是 (n_samples, n_features) = (8, 500)
    X_T = norm_counts_filtered.loc[top_genes].T
    sample_names = X_T.index  # 8个样本名

    # 标准化
    X_scaled = StandardScaler().fit_transform(X_T)

    # PCA
    pca = PCA(n_components=2)
    X_pca = pca.fit_transform(X_scaled)

    # 绘图
    fig, ax = plt.subplots(figsize=(8, 6))

    # 获取样本条件
    conditions = [s.split('_rep')[0] for s in sample_names]
    unique_conditions = list(set(conditions))
    colors = plt.cm.Set1(np.linspace(0, 1, len(unique_conditions)))

    for i, sample in enumerate(sample_names):
        cond_name = sample.split('_rep')[0]
        color = colors[unique_conditions.index(cond_name)]
        ax.scatter(X_pca[i, 0], X_pca[i, 1],
                   c=[color], s=100, label=cond_name)
        ax.annotate(sample, (X_pca[i, 0], X_pca[i, 1]),
                   xytext=(5, 5), textcoords='offset points')

    ax.set_xlabel(f'PC1 ({pca.explained_variance_ratio_[0]*100:.1f}%)')
    ax.set_ylabel(f'PC2 ({pca.explained_variance_ratio_[1]*100:.1f}%)')
    ax.set_title('PCA - Sample Similarity')
    ax.legend()
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"PCA 图已保存: {output_path}")


def plot_volcano(results_df, output_path, padj_thresh=0.05, lfc_thresh=1):
    """
    绘制火山图

    Parameters:
    -----------
    results_df : pd.DataFrame
        差异分析结果，需包含 log2FoldChange 和 padj 列
    output_path : str
        输出路径
    padj_thresh : float
        padj 阈值
    lfc_thresh : float
        log2FC 阈值
    """
    # 过滤有效数据
    df = results_df.dropna(subset=['log2FoldChange', 'padj']).copy()

    # 计算 -log10(padj)
    df['neg_log10_padj'] = -np.log10(df['padj'])

    # 分类: 上调、下调、不显著
    df['color'] = 'grey'
    df.loc[(df['padj'] < padj_thresh) & (df['log2FoldChange'] > lfc_thresh), 'color'] = 'red'
    df.loc[(df['padj'] < padj_thresh) & (df['log2FoldChange'] < -lfc_thresh), 'color'] = 'blue'

    # 绘图
    fig, ax = plt.subplots(figsize=(10, 8))

    # 绘制不显著基因
    not_sig = df[df['color'] == 'grey']
    ax.scatter(not_sig['log2FoldChange'], not_sig['neg_log10_padj'],
               c='grey', alpha=0.3, s=10, label='Not significant')

    # 绘制下调基因
    down = df[df['color'] == 'blue']
    ax.scatter(down['log2FoldChange'], down['neg_log10_padj'],
               c='steelblue', alpha=0.6, s=15, label=f'Down ({len(down)})')

    # 绘制上调基因
    up = df[df['color'] == 'red']
    ax.scatter(up['log2FoldChange'], up['neg_log10_padj'],
               c='firebrick', alpha=0.6, s=15, label=f'Up ({len(up)})')

    # 阈值线
    ax.axhline(-np.log10(padj_thresh), color='grey', linestyle='--', linewidth=0.8)
    ax.axvline(-lfc_thresh, color='grey', linestyle='--', linewidth=0.8)
    ax.axvline(lfc_thresh, color='grey', linestyle='--', linewidth=0.8)

    # 标注 top 基因
    top_genes = df[df['padj'] < padj_thresh].nsmallest(10, 'padj')
    for _, row in top_genes.iterrows():
        ax.annotate(row.name, (row['log2FoldChange'], row['neg_log10_padj']),
                   xytext=(5, 5), textcoords='offset points', fontsize=7, alpha=0.8)

    ax.set_xlabel('log2 Fold Change')
    ax.set_ylabel('-log10(adjusted p-value)')
    ax.set_title(f'Volcano Plot - {results_df["comparison"].iloc[0] if "comparison" in results_df.columns else ""}')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()
    print(f"火山图已保存: {output_path}")


def main():
    # 路径
    count_file = os.path.join(DATA_DIR, 'GSE242459_Count_matrix.txt')

    # 加载数据
    print("=" * 50)
    print("Step 1: 加载数据")
    print("=" * 50)
    count_matrix = load_count_matrix(count_file)

    # 定义比较
    comparisons = [
        {'name': 'DS_mutant_vs_WT', 'ref': 'DS_WT', 'comp': 'DS_osbzip23'},
        {'name': 'DS_WT_vs_N_WT', 'ref': 'N_WT', 'comp': 'DS_WT'},
    ]

    all_results = []
    significant_results = {}

    for comp in comparisons:
        print(f"\n{'=' * 50}")
        print(f"分析: {comp['name']}")
        print(f"{'=' * 50}")

        # 准备数据
        dds = prepare_deseq_dataset(
            count_matrix,
            design_factor='condition',
            reference_level=comp['ref'],
            comparison_level=comp['comp']
        )

        # 运行分析
        contrast = ['condition', comp['comp'], comp['ref']]
        results_df = run_deseq_analysis(dds, contrast, comp['name'])

        # 保存完整结果
        all_results.append(results_df)

        # 筛选显著基因
        sig_genes = filter_significant_genes(results_df)
        significant_results[comp['name']] = sig_genes

        print(f"\n显著差异基因: {len(sig_genes)}")
        print(f"  上调: {(sig_genes['direction'] == 'up').sum()}")
        print(f"  下调: {(sig_genes['direction'] == 'down').sum()}")

    # 保存结果
    print(f"\n{'=' * 50}")
    print("保存结果")
    print(f"{'=' * 50}")

    for comp in comparisons:
        comp_name = comp['name']
        sig_genes = significant_results[comp_name]
        # 从 all_results 中获取对应的完整结果
        idx = comparisons.index(comp)
        full_results = all_results[idx]
        save_results(full_results, sig_genes, comp_name)

    # 绘制火山图
    print(f"\n{'=' * 50}")
    print("绘制火山图")
    print(f"{'=' * 50}")

    for i, comp in enumerate(comparisons):
        comp_name = comp['name']
        full_results = all_results[i]
        volcano_path = os.path.join(FIGURES_DIR, f'{comp_name}_volcano.png')
        plot_volcano(full_results, volcano_path)

    # 绘制 PCA
    print(f"\n{'=' * 50}")
    print("绘制 PCA 图")
    print(f"{'=' * 50}")

    # 使用完整数据创建 DDS
    dds_for_pca = prepare_deseq_dataset(
        count_matrix,
        design_factor='condition',
        reference_level='N_WT',
        comparison_level='DS_WT'
    )

    pca_path = os.path.join(FIGURES_DIR, 'pca.png')
    plot_pca(dds_for_pca, pca_path)

if __name__ == '__main__':
    main()
