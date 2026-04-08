import { Card, Row, Col, Tag, Table, Button, Space, Typography, Alert, Collapse } from 'antd';
import { AnalysisResult, GeneInfo } from '../api/client';
import { DownloadOutlined, FileExcelOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ComparisonCardProps {
  result: AnalysisResult;
}

export function ComparisonCard({ result }: ComparisonCardProps) {
  const toolColumns = [
    { title: '基因', dataIndex: 'gene_id', key: 'gene_id' },
    {
      title: '变化',
      dataIndex: 'expression_change',
      key: 'expression_change',
      render: (val: string) => (
        <Tag color={val === 'up' ? 'red' : val === 'down' ? 'blue' : 'default'}>
          {val === 'up' ? '上调' : val === 'down' ? '下调' : '无变化'}
        </Tag>
      )
    },
    { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', render: (v: number) => v?.toFixed(2) },
    { title: 'p值', dataIndex: 'pvalue', key: 'pvalue', render: (v: number) => v?.toFixed(4) },
  ];

  // 判断是否是旧数据（无 total_significant 字段）
  const isLegacyData = result.tool_result.total_significant == null;
  const totalSignificant = result.tool_result.total_significant ?? result.tool_result.significant_genes.length;

  // 旧数据：significant_genes 是全量，前端截取 TOP10；新数据：后端已截好
  const allGenesForDisplay = result.tool_result.significant_genes;
  const upGenes = isLegacyData
    ? allGenesForDisplay.filter(g => g.expression_change === 'up').sort((a, b) => (b.log2fc ?? 0) - (a.log2fc ?? 0)).slice(0, 10)
    : allGenesForDisplay.filter(g => g.expression_change === 'up');
  const downGenes = isLegacyData
    ? allGenesForDisplay.filter(g => g.expression_change === 'down').sort((a, b) => (a.log2fc ?? 0) - (b.log2fc ?? 0)).slice(0, 10)
    : allGenesForDisplay.filter(g => g.expression_change === 'down');

  // 下载完整 CSV
  // 旧数据：significant_genes 就是全量，直接在前端生成 CSV
  // 新数据：调用后端接口
  const handleDownloadCSV = () => {
    if (isLegacyData) {
      const allGenes = result.tool_result.significant_genes;
      const lines = ['Gene ID,Expression Change,log2FC,P-value'];
      allGenes.forEach(g => {
        lines.push(`${g.gene_id},${g.expression_change},${(g.log2fc ?? 0).toFixed(6)},${(g.pvalue ?? 1).toExponential(6)}`);
      });
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `differential_genes_${result.id}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const link = document.createElement('a');
      link.href = `/api/download/analysis/${result.id}`;
      link.download = `differential_genes_${result.id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 下载原始分析结果 JSON 文件（直接从后端获取文件）
  const handleDownloadResultFile = () => {
    const link = document.createElement('a');
    link.href = `/api/download/result-file/${result.id}`;
    link.download = `analysis_result_${result.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TOP10 注释提示
  const top10Notice = (
    <Alert
      type="info"
      icon={<InfoCircleOutlined />}
      showIcon
      style={{ marginBottom: 8, fontSize: 12, padding: '4px 8px' }}
      message={
        <span>
          仅展示上调 TOP10 / 下调 TOP10，共检出显著差异基因 <Text strong>{totalSignificant}</Text> 个。
          详细结果请{' '}
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={handleDownloadCSV}>
            下载完整分析结果 CSV
          </Button>
        </span>
      }
    />
  );

  // 一致性基因列表（全量展示，折叠）
  const { overlap, tool_only, llm_only } = result.consistency;

  const geneTagList = (genes: string[], color: string) => (
    <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 4 }}>
      {genes.length > 0
        ? genes.map(g => <Tag key={g} color={color} style={{ marginBottom: 4 }}>{g}</Tag>)
        : <Text type="secondary" style={{ fontSize: 12 }}>无</Text>
      }
    </div>
  );

  return (
    <Card
      title={`双轨分析结果（仅显示Top10）- ${result.dataset_name}`}
      style={{ marginTop: 16 }}
      extra={
        <Space>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleDownloadCSV}
            type="primary"
            ghost
          >
            下载完整差异基因 CSV
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadResultFile}>
            下载分析结果文件
          </Button>
        </Space>
      }
    >
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="工具轨 (scipy)" style={{ background: '#f5f5f5' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="green">显著基因总数: {totalSignificant}</Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                耗时: {result.tool_result.execution_time.toFixed(2)}s
              </Text>
            </div>

            {top10Notice}

            <div style={{ marginBottom: 8 }}>
              <Tag color="red">上调 TOP 10 ({upGenes.length})</Tag>
            </div>
            <Table
              size="small"
              dataSource={upGenes}
              columns={toolColumns}
              rowKey="gene_id"
              pagination={false}
              scroll={{ y: 200 }}
            />

            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <Tag color="blue">下调 TOP 10 ({downGenes.length})</Tag>
            </div>
            <Table
              size="small"
              dataSource={downGenes}
              columns={toolColumns}
              rowKey="gene_id"
              pagination={false}
              scroll={{ y: 200 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="大模型轨 (千问)" style={{ background: '#f0f5ff' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="blue">识别基因数: {result.llm_result.significant_genes.length}</Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                耗时: {result.llm_result.execution_time.toFixed(2)}s
              </Text>
            </div>

            <Alert
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
              style={{ marginBottom: 8, fontSize: 12, padding: '4px 8px' }}
              message="大模型仅基于前20条样本数据推断，结果供参考，精确差异分析请参考工具轨结果"
            />

            <div style={{ marginBottom: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
              {result.llm_result.reasoning.substring(0, 300)}
              {result.llm_result.reasoning.length > 300 ? '...' : ''}
            </div>
            <div>
              {result.llm_result.significant_genes.map((g: GeneInfo) => (
                <Tag key={g.gene_id} color={g.expression_change === 'up' ? 'red' : 'blue'} style={{ marginBottom: 4 }}>
                  {g.gene_id} ({g.expression_change === 'up' ? '上调' : '下调'})
                </Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 一致性分析 - 显示全量基因 */}
      <Card size="small" title="双轨一致性分析" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <Text strong>重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
            （基于工具轨全量 {totalSignificant} 个显著基因计算）
          </Text>
        </div>
        <Collapse
          size="small"
          items={[
            {
              key: 'overlap',
              label: <><Tag color="green">共同检出</Tag><Text strong>{overlap.length}</Text> 个基因</>,
              children: geneTagList(overlap, 'green'),
            },
            {
              key: 'tool_only',
              label: <><Tag color="orange">仅工具轨检出</Tag><Text strong>{tool_only.length}</Text> 个基因</>,
              children: geneTagList(tool_only, 'orange'),
            },
            {
              key: 'llm_only',
              label: <><Tag color="blue">仅大模型检出</Tag><Text strong>{llm_only.length}</Text> 个基因</>,
              children: geneTagList(llm_only, 'blue'),
            },
          ]}
        />
      </Card>
    </Card>
  );
}


