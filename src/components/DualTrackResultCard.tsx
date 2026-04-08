import { Card, Row, Col, Tag, Table, Button, Collapse, Divider, Typography, Input, Space, Alert, Modal, Spin } from 'antd'
import { useState } from 'react'
import { AnalysisResult, GeneInfo } from '../api/client'
import { FeedbackWidget } from './FeedbackWidget'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell
} from 'recharts'
import {
  ThunderboltOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  InfoCircleOutlined,
  DotChartOutlined,
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
  const [showVolcano, setShowVolcano] = useState(false)
  const [volcanoLoading, setVolcanoLoading] = useState(false)
  const [volcanoData, setVolcanoData] = useState<Array<{
    gene_id: string; log2fc: number; neg_log10_pvalue: number; pvalue: number; expression_change: string
  }> | null>(null)

  const handleOpenVolcano = async () => {
    setShowVolcano(true)
    if (volcanoData) return
    setVolcanoLoading(true)
    try {
      const res = await fetch(`/api/download/volcano/${result.id}`)
      const json = await res.json()
      const all: Array<{ gene_id: string; log2fc: number; neg_log10_pvalue: number; pvalue: number; expression_change: string }> = json.data ?? []

      // 按区间各取 30% 随机采样
      const sample = (arr: typeof all) => {
        const n = Math.max(1, Math.round(arr.length * 0.3))
        const shuffled = [...arr].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, n)
      }
      const up   = sample(all.filter(p => p.expression_change === 'up'))
      const down = sample(all.filter(p => p.expression_change === 'down'))
      const none = sample(all.filter(p => p.expression_change === 'none'))
      setVolcanoData([...up, ...down, ...none])
    } catch {
      setVolcanoData([])
    } finally {
      setVolcanoLoading(false)
    }
  }

  // 判断旧数据兼容（无 total_significant 字段时 significant_genes 是全量）
  const isLegacyData = result.tool_result.total_significant == null
  const totalSignificant = result.tool_result.total_significant ?? result.tool_result.significant_genes.length

  // 统计上调/下调（显示用，已是 TOP10）
  const toolUp = result.tool_result.significant_genes.filter(g => g.expression_change === 'up').length
  const toolDown = result.tool_result.significant_genes.filter(g => g.expression_change === 'down').length
  const llmUp = result.llm_result.significant_genes.filter(g => g.expression_change === 'up').length
  const llmDown = result.llm_result.significant_genes.filter(g => g.expression_change === 'down').length

  // 下载完整差异基因 CSV
  const handleDownloadCSV = () => {
    if (isLegacyData) {
      // 旧数据：significant_genes 就是全量，前端直接生成
      const allGenes = result.tool_result.significant_genes
      const lines = ['Gene ID,Expression Change,log2FC,P-value']
      allGenes.forEach(g => {
        lines.push(`${g.gene_id},${g.expression_change},${(g.log2fc ?? 0).toFixed(6)},${(g.pvalue ?? 1).toExponential(6)}`)
      })
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `differential_genes_${result.id}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else {
      const link = document.createElement('a')
      link.href = `/api/download/analysis/${result.id}`
      link.download = `differential_genes_${result.id}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // 下载原始分析结果文件
  const handleDownloadResultFile = () => {
    const link = document.createElement('a')
    link.href = `/api/download/result-file/${result.id}`
    link.download = `analysis_result_${result.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>双轨分析结果</span>
          <Tag color="blue" style={{ margin: 0 }}>{result.dataset_name}</Tag>
          <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>仅显示 TOP10</Tag>
        </div>
      }
      extra={
        <Space size="small">
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={handleDownloadCSV}
            type="primary"
            ghost
          >
            下载完整差异基因 CSV
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownloadResultFile}
          >
            下载分析结果文件
          </Button>
          <Button
            size="small"
            type="text"
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? <ExclamationCircleOutlined rotate={180} /> : <ExclamationCircleOutlined />}
          >
            {expanded ? '收起详情' : '展开详情'}
          </Button>
        </Space>
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

                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <Tag color="red" style={{ margin: 0 }}>
                    <ArrowUpOutlined /> 上调 {toolUp}
                  </Tag>
                  <Tag color="blue" style={{ margin: 0 }}>
                    <ArrowDownOutlined /> 下调 {toolDown}
                  </Tag>
                  <Tag style={{ margin: 0 }}>
                    显著基因总数 {totalSignificant}
                  </Tag>
                </div>

                <Alert
                  type="info"
                  icon={<InfoCircleOutlined />}
                  showIcon
                  style={{ marginBottom: 8, padding: '3px 8px', fontSize: 11 }}
                  message={
                    <span>
                      仅展示上调/下调各 TOP10，共 <Text strong>{totalSignificant}</Text> 个显著差异基因。
                      <Button type="link" size="small" style={{ padding: '0 4px', fontSize: 11 }} onClick={handleDownloadCSV}>
                        下载完整列表
                      </Button>
                    </span>
                  }
                />

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

          {/* 火山图按钮 */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button
              icon={<DotChartOutlined />}
              onClick={handleOpenVolcano}
              style={{ borderRadius: 20, minWidth: 160 }}
            >
              查看火山图可视化
            </Button>
          </div>

          {/* 火山图 Modal */}
          <Modal
            title={`火山图 - ${result.dataset_name}（${result.group_control} vs ${result.group_treatment}）`}
            open={showVolcano}
            onCancel={() => setShowVolcano(false)}
            footer={null}
            width={1100}
            styles={{ body: { padding: '16px 0' } }}
          >
            {volcanoLoading ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Spin size="large" tip="正在计算全量基因数据..." />
              </div>
            ) : volcanoData && volcanoData.length > 0 ? (
              <>
                <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 8 }}>
                  X轴: log2FC &nbsp;|&nbsp; Y轴: -log10(p-value) &nbsp;|&nbsp;
                  <span style={{ color: '#f5222d' }}>■ 上调</span> &nbsp;
                  <span style={{ color: '#1890ff' }}>■ 下调</span> &nbsp;
                  <span style={{ color: '#d9d9d9', textShadow: '0 0 1px #999' }}>■ 不显著</span>
                </div>
                <ResponsiveContainer width="100%" height={580}>
                  <ScatterChart margin={{ top: 20, right: 40, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="log2fc"
                      type="number"
                      name="log2FC"
                      label={{ value: 'log2FC', position: 'insideBottom', offset: -10, fontSize: 12 }}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <YAxis
                      dataKey="neg_log10_pvalue"
                      type="number"
                      name="-log10(p)"
                      label={{ value: '-log10(p)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                      tickFormatter={(v: number) => v.toFixed(1)}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.gene_id}</div>
                            <div>log2FC: <b>{d.log2fc.toFixed(3)}</b></div>
                            <div>-log10(p): <b>{d.neg_log10_pvalue.toFixed(3)}</b></div>
                            <div>变化: <b>{d.expression_change === 'up' ? '上调' : d.expression_change === 'down' ? '下调' : '不显著'}</b></div>
                          </div>
                        )
                      }}
                    />
                    <ReferenceLine x={1} stroke="#f5222d" strokeDasharray="4 2" strokeOpacity={0.5} />
                    <ReferenceLine x={-1} stroke="#1890ff" strokeDasharray="4 2" strokeOpacity={0.5} />
                    <ReferenceLine y={-Math.log10(0.05)} stroke="#faad14" strokeDasharray="4 2" strokeOpacity={0.6} />
                    <Scatter data={volcanoData} isAnimationActive={false}>
                      {volcanoData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.expression_change === 'up' ? '#f5222d' : entry.expression_change === 'down' ? '#1890ff' : '#d9d9d9'}
                          fillOpacity={entry.expression_change === 'none' ? 0.3 : 0.6}
                          r={entry.expression_change === 'none' ? 1.5 : 2.5}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 }}>
                  虚线: |log2FC| = 1（红/蓝）&nbsp;|&nbsp; p = 0.05（黄）&nbsp;|&nbsp; 共 {volcanoData.length} 个基因
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#aaa' }}>暂无数据</div>
            )}
          </Modal>

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
