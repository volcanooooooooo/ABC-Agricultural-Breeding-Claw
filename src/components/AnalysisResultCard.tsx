import { Card, Table, Tag, Row, Col, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

const { Text } = Typography

// Analysis result format as described in the task
export interface SimpleAnalysisResult {
  significant_genes: Array<{
    gene_id: string
    log2fc: number
    pvalue: number
    control_mean?: number
    treatment_mean?: number
  }>
  volcano_data: Array<{
    gene_id: string
    log2fc: number
    neg_log10_pvalue: number
    significant: boolean
  }>
  summary: {
    total_genes: number
    significant_count: number
    upregulated: number
    downregulated: number
    control_group: string
    treatment_group: string
  }
}

interface AnalysisResultCardProps {
  result: SimpleAnalysisResult
  onGeneClick?: (geneId: string) => void
}

export function AnalysisResultCard({ result, onGeneClick }: AnalysisResultCardProps) {
  const { summary, significant_genes } = result

  // Determine change direction based on log2fc
  const getChangeType = (log2fc: number): 'up' | 'down' | 'none' => {
    if (log2fc > 0) return 'up'
    if (log2fc < 0) return 'down'
    return 'none'
  }

  const columns = [
    {
      title: 'Gene ID',
      dataIndex: 'gene_id',
      key: 'gene_id',
      width: 120,
      render: (id: string) => (
        <span
          style={{
            fontWeight: 600,
            color: 'var(--color-accent)',
            cursor: onGeneClick ? 'pointer' : 'default'
          }}
          onClick={() => onGeneClick?.(id)}
        >
          {id}
        </span>
      )
    },
    {
      title: 'log2FC',
      dataIndex: 'log2fc',
      key: 'log2fc',
      width: 100,
      render: (v: number) => (
        <Text style={{ fontFamily: 'monospace' }}>
          {v != null ? v.toFixed(3) : '-'}
        </Text>
      )
    },
    {
      title: 'P-value',
      dataIndex: 'pvalue',
      key: 'pvalue',
      width: 100,
      render: (v: number) => (
        <Text style={{ fontFamily: 'monospace' }}>
          {v != null ? (v < 0.001 ? '<0.001' : v.toFixed(4)) : '-'}
        </Text>
      )
    },
    {
      title: 'Change',
      key: 'change',
      width: 100,
      render: (_: any, record: { log2fc: number }) => {
        const change = getChangeType(record.log2fc)
        if (change === 'up') {
          return <Tag color="red" icon={<ArrowUpOutlined />}>Up</Tag>
        } else if (change === 'down') {
          return <Tag color="blue" icon={<ArrowDownOutlined />}>Down</Tag>
        }
        return <Tag>No Change</Tag>
      }
    }
  ]

  return (
    <Card
      size="small"
      title="Analysis Result"
      style={{
        marginTop: 16,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)'
      }}
    >
      {/* Summary Tags */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]}>
          <Col>
            <Tag color="blue">
              Control: {summary.control_group}
            </Tag>
          </Col>
          <Col>
            <Tag color="purple">
              Treatment: {summary.treatment_group}
            </Tag>
          </Col>
          <Col>
            <Tag color="green">
              Total Genes: {summary.total_genes}
            </Tag>
          </Col>
          <Col>
            <Tag color="orange">
              Significant: {summary.significant_count}
            </Tag>
          </Col>
        </Row>
        <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
          <Col>
            <Tag color="red" icon={<ArrowUpOutlined />}>
              Up-regulated: {summary.upregulated}
            </Tag>
          </Col>
          <Col>
            <Tag color="blue" icon={<ArrowDownOutlined />}>
              Down-regulated: {summary.downregulated}
            </Tag>
          </Col>
        </Row>
      </div>

      {/* Significant Genes Table */}
      <Table
        size="small"
        dataSource={significant_genes}
        columns={columns}
        rowKey="gene_id"
        pagination={{ pageSize: 10, size: 'small' }}
        scroll={{ y: 300 }}
        style={{ background: '#fff', borderRadius: 8 }}
      />
    </Card>
  )
}
