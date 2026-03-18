import { Card, Row, Col, Tag, Table, Button, Collapse } from 'antd'
import { useState } from 'react'
import { AnalysisResult, GeneInfo } from '../api/client'
import { FeedbackPanel } from './FeedbackPanel'

interface DualTrackResultCardProps {
  result: AnalysisResult
}

export function DualTrackResultCard({ result }: DualTrackResultCardProps) {
  const [expanded, setExpanded] = useState(false)

  const toolColumns = [
    { title: '基因', dataIndex: 'gene_id', key: 'gene_id' },
    {
      title: '变化',
      dataIndex: 'expression_change',
      key: 'expression_change',
      render: (val: string) => (
        <Tag color={val === 'up' ? 'red' : val === 'down' ? 'blue' : 'default'}>
          {val === 'up' ? '上调' : val === 'down' ? '下调' : '无'}
        </Tag>
      )
    },
    { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', render: (v: number) => v?.toFixed(2) },
    { title: 'p值', dataIndex: 'pvalue', key: 'pvalue', render: (v: number) => v?.toFixed(4) },
  ]

  return (
    <Card
      size="small"
      title={`双轨分析结果 - ${result.dataset_name}`}
      extra={
        <Button size="small" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : '查看详情'}
        </Button>
      }
      style={{ marginTop: 16, background: 'var(--color-bg-card)' }}
    >
      {/* 一致性概览 - 默认显示 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#52c41a', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.overlap.length}
          </div>
          <div style={{ fontSize: 12 }}>共同检出</div>
        </Col>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#fa8c16', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.tool_only.length}
          </div>
          <div style={{ fontSize: 12 }}>仅工具</div>
        </Col>
        <Col span={8} style={{ textAlign: 'center' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: '#1890ff', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            fontSize: 18, fontWeight: 600
          }}>
            {result.consistency.llm_only.length}
          </div>
          <div style={{ fontSize: 12 }}>仅LLM</div>
        </Col>
      </Row>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
          重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%
        </Tag>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Card size="small" title={`工具轨 (scipy) - ${result.tool_result.execution_time.toFixed(2)}s`} style={{ background: '#fafafa' }}>
                <Tag color="green">{result.tool_result.significant_genes.length} 个显著基因</Tag>
                <Table
                  size="small"
                  dataSource={result.tool_result.significant_genes}
                  columns={toolColumns}
                  rowKey="gene_id"
                  pagination={false}
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={`大模型轨 (千问) - ${result.llm_result.execution_time.toFixed(2)}s`} style={{ background: '#f0f7ff' }}>
                <Tag color="blue">{result.llm_result.significant_genes.length} 个显著基因</Tag>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {result.llm_result.reasoning.substring(0, 200)}...
                </div>
              </Card>
            </Col>
          </Row>

          {/* 反馈组件 */}
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <FeedbackPanel analysisId={result.id} track="tool" />
            </Col>
            <Col span={12}>
              <FeedbackPanel analysisId={result.id} track="llm" />
            </Col>
          </Row>
        </>
      )}
    </Card>
  )
}
