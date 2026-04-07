import { Card, Row, Col, Tag, Table, Button, Collapse, Divider, Typography, Input } from 'antd'
import { useState } from 'react'
import { AnalysisResult, GeneInfo } from '../api/client'
import { FeedbackWidget } from './FeedbackWidget'
import {
  ThunderboltOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'

const { Paragraph, Text } = Typography

interface DualTrackResultCardProps {
  result: AnalysisResult
  onFollowUp?: (question: string) => void
  onGeneClick?: (geneId: string) => void
}

// 通用基因表格列定义
const createGeneColumns = (onGeneClick?: (geneId: string) => void) => [
  {
    title: '基因',
    dataIndex: 'gene_id',
    key: 'gene_id',
    width: 100,
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
    title: '变化',
    dataIndex: 'expression_change',
    key: 'expression_change',
    width: 80,
    render: (val: string) => {
      if (val === 'up') {
        return <Tag color="red" icon={<ArrowUpOutlined />}>上调</Tag>
      } else if (val === 'down') {
        return <Tag color="blue" icon={<ArrowDownOutlined />}>下调</Tag>
      }
      return <Tag>无变化</Tag>
    }
  },
  {
    title: 'log2FC',
    dataIndex: 'log2fc',
    key: 'log2fc',
    width: 80,
    render: (v: number) => v != null ? (
      <span style={{ fontFamily: 'monospace' }}>{v.toFixed(3)}</span>
    ) : '-'
  },
  {
    title: 'p值',
    dataIndex: 'pvalue',
    key: 'pvalue',
    width: 80,
    render: (v: number) => v != null ? (
      <span style={{ fontFamily: 'monospace' }}>{v < 0.001 ? '<0.001' : v.toFixed(4)}</span>
    ) : '-'
  },
]

export function DualTrackResultCard({ result, onFollowUp, onGeneClick }: DualTrackResultCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [followUpInput, setFollowUpInput] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)

  // 统计上调/下调基因
  const toolUp = result.tool_result.significant_genes.filter(g => g.expression_change === 'up').length
  const toolDown = result.tool_result.significant_genes.filter(g => g.expression_change === 'down').length
  const llmUp = result.llm_result.significant_genes.filter(g => g.expression_change === 'up').length
  const llmDown = result.llm_result.significant_genes.filter(g => g.expression_change === 'down').length

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>双轨分析结果</span>
          <Tag color="blue" style={{ margin: 0 }}>{result.dataset_name}</Tag>
        </div>
      }
      extra={
        <Button
          size="small"
          type="text"
          onClick={() => setExpanded(!expanded)}
          icon={expanded ? <ExclamationCircleOutlined rotate={180} /> : <ExclamationCircleOutlined />}
        >
          {expanded ? '收起详情' : '展开详情'}
        </Button>
      }
      style={{ marginTop: 16, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      styles={{ body: expanded ? { padding: 16 } : { padding: 0 } }}
    >
      {/* 一致性概览 - 始终显示 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(24,144,255,0.1) 100%)',
        borderRadius: 12,
        padding: 16,
        marginBottom: expanded ? 16 : 0
      }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            双轨一致性
          </div>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            color: result.consistency.overlap_rate >= 0.6 ? '#52c41a' : result.consistency.overlap_rate >= 0.3 ? '#fa8c16' : '#f5222d',
            lineHeight: 1
          }}>
            {(result.consistency.overlap_rate * 100).toFixed(0)}%
          </div>
        </div>

        <Row gutter={16}>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 4
            }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontWeight: 600, color: '#52c41a' }}>{result.consistency.overlap.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>共同检出</div>
            {result.consistency.overlap.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2, wordBreak: 'break-all' }}>
                {result.consistency.overlap.slice(0, 3).join(', ')}
                {result.consistency.overlap.length > 3 && '...'}
              </div>
            )}
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 4
            }}>
              <ThunderboltOutlined style={{ color: '#fa8c16' }} />
              <span style={{ fontWeight: 600, color: '#fa8c16' }}>{result.consistency.tool_only.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>仅工具</div>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 4
            }}>
              <RobotOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 600, color: '#1890ff' }}>{result.consistency.llm_only.length}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>仅LLM</div>
          </Col>
        </Row>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <>
          <Divider style={{ margin: '16px 0' }} />

          <Row gutter={16}>
            {/* 工具轨 */}
            <Col span={12}>
              <div style={{
                background: '#fafff0',
                border: '1px solid #b7eb8f',
                borderRadius: 12,
                padding: 16,
                height: '100%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                    <span style={{ fontWeight: 600, color: '#389e0d' }}>工具轨 (scipy)</span>
                  </div>
                  <Tag color="green">
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {result.tool_result.execution_time.toFixed(2)}s
                  </Tag>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <Tag color="red" style={{ margin: 0 }}>
                    <ArrowUpOutlined /> 上调 {toolUp}
                  </Tag>
                  <Tag color="blue" style={{ margin: 0 }}>
                    <ArrowDownOutlined /> 下调 {toolDown}
                  </Tag>
                  <Tag style={{ margin: 0 }}>
                    共 {result.tool_result.significant_genes.length} 个
                  </Tag>
                </div>

                <Table
                  size="small"
                  dataSource={result.tool_result.significant_genes}
                  columns={createGeneColumns(onGeneClick)}
                  rowKey="gene_id"
                  pagination={{ pageSize: 5, size: 'small' }}
                  scroll={{ y: 200 }}
                  style={{ background: '#fff', borderRadius: 8 }}
                />
              </div>
            </Col>

            {/* 大模型轨 */}
            <Col span={12}>
              <div style={{
                background: '#f0f7ff',
                border: '1px solid #91caff',
                borderRadius: 12,
                padding: 16,
                height: '100%'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RobotOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <span style={{ fontWeight: 600, color: '#1677ff' }}>大模型轨 (千问)</span>
                  </div>
                  <Tag color="blue">
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {result.llm_result.execution_time.toFixed(2)}s
                  </Tag>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <Tag color="red" style={{ margin: 0 }}>
                    <ArrowUpOutlined /> 上调 {llmUp}
                  </Tag>
                  <Tag color="blue" style={{ margin: 0 }}>
                    <ArrowDownOutlined /> 下调 {llmDown}
                  </Tag>
                  <Tag style={{ margin: 0 }}>
                    共 {result.llm_result.significant_genes.length} 个
                  </Tag>
                </div>

                <Table
                  size="small"
                  dataSource={result.llm_result.significant_genes}
                  columns={createGeneColumns(onGeneClick)}
                  rowKey="gene_id"
                  pagination={{ pageSize: 5, size: 'small' }}
                  scroll={{ y: 200 }}
                  style={{ background: '#fff', borderRadius: 8 }}
                />

                {/* LLM 推理解读 - 冒号分隔格式 */}
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid #e6e6e6'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 500 }}>
                    📖 模型解读
                  </div>
                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.8,
                    color: 'var(--color-text-secondary)',
                    maxHeight: 300,
                    overflowY: 'auto'
                  }}>
                    {result.llm_result.reasoning.split('\n').map((line, idx) => {
                      const colonIndex = line.indexOf(':')
                      if (colonIndex > 0) {
                        const title = line.substring(0, colonIndex).trim()
                        const content = line.substring(colonIndex + 1).trim()
                        return (
                          <div key={idx} style={{ marginBottom: 6 }}>
                            <strong style={{ color: '#1890ff', fontWeight: 600 }}>{title}:</strong>
                            <span style={{ color: 'var(--color-text-secondary)' }}> {content}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={idx} style={{ marginBottom: 4, color: 'var(--color-text-secondary)' }}>
                          {line}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* 反馈组件 */}
          <div style={{ marginTop: 16 }}>
            <FeedbackWidget analysisId={result.id} />
          </div>

          {/* 追问区域 */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            {!showFollowUp ? (
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="default"
                  onClick={() => setShowFollowUp(true)}
                  style={{ borderRadius: 20 }}
                >
                  还有其他问题？去追问
                </Button>
              </div>
            ) : (
              <div style={{ background: 'var(--color-bg-input)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  您可以追问关于分析结果的任何问题，例如：「为什么 Gene7 只被工具检出？」
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder="输入您的追问..."
                    onPressEnter={() => {
                      if (followUpInput.trim() && onFollowUp && !followUpLoading) {
                        setFollowUpLoading(true)
                        onFollowUp(followUpInput.trim())
                        setFollowUpInput('')
                        setShowFollowUp(false)
                        setFollowUpLoading(false)
                      }
                    }}
                    style={{ flex: 1, borderRadius: 8 }}
                  />
                  <Button
                    type="primary"
                    loading={followUpLoading}
                    onClick={() => {
                      if (followUpInput.trim() && onFollowUp && !followUpLoading) {
                        setFollowUpLoading(true)
                        onFollowUp(followUpInput.trim())
                        setFollowUpInput('')
                        setShowFollowUp(false)
                        setFollowUpLoading(false)
                      }
                    }}
                    style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
                  >
                    发送
                  </Button>
                </div>
                <Button
                  type="text"
                  size="small"
                  onClick={() => {
                    setShowFollowUp(false)
                    setFollowUpInput('')
                  }}
                  style={{ marginTop: 8, color: 'var(--color-text-muted)' }}
                >
                  收起
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
