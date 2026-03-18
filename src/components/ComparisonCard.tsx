import { Card, Row, Col, Tag, Table } from 'antd';
import { AnalysisResult, GeneInfo } from '../api/client';

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

  return (
    <Card title={`双轨分析结果 - ${result.dataset_name}`} style={{ marginTop: 16 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title="工具轨 (scipy)" style={{ background: '#f5f5f5' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="green">显著基因: {result.tool_result.significant_genes.length}</Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                耗时: {result.tool_result.execution_time.toFixed(2)}s
              </span>
            </div>
            <Table
              size="small"
              dataSource={result.tool_result.significant_genes}
              columns={toolColumns}
              rowKey="gene_id"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="大模型轨 (千问)" style={{ background: '#f0f5ff' }}>
            <div style={{ marginBottom: 8 }}>
              <Tag color="blue">显著基因: {result.llm_result.significant_genes.length}</Tag>
              <span style={{ fontSize: 12, color: '#666' }}>
                耗时: {result.llm_result.execution_time.toFixed(2)}s
              </span>
            </div>
            <div style={{ marginBottom: 8, fontSize: 12 }}>
              {result.llm_result.reasoning.substring(0, 200)}...
            </div>
            {result.llm_result.significant_genes.map((g: GeneInfo) => (
              <Tag key={g.gene_id} color={g.expression_change === 'up' ? 'red' : 'blue'}>
                {g.gene_id} ({g.expression_change === 'up' ? '上调' : '下调'})
              </Tag>
            ))}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="一致性分析" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Tag color="green">共同检出: {result.consistency.overlap.length}</Tag>
            <div>{result.consistency.overlap.join(', ') || '-'}</div>
          </Col>
          <Col span={8}>
            <Tag color="orange">仅工具轨: {result.consistency.tool_only.length}</Tag>
            <div>{result.consistency.tool_only.join(', ') || '-'}</div>
          </Col>
          <Col span={8}>
            <Tag color="blue">仅LLM: {result.consistency.llm_only.length}</Tag>
            <div>{result.consistency.llm_only.join(', ') || '-'}</div>
          </Col>
        </Row>
        <div style={{ marginTop: 8 }}>
          <strong>重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%</strong>
        </div>
      </Card>
    </Card>
  );
}
