import { useState, useEffect } from 'react'
import { Modal, Tag, Divider, Input, Button, message, Spin } from 'antd'
import {
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons'
import { AnalysisResult, GeneInfo, feedbackApi, api } from '../api/client'

interface FeedbackHint {
  id: number
  keyword: string
  track: 'tool' | 'llm'
  hint_type: 'warning' | 'praise'
  summary: string
  frequency: number
}

interface GeneDetailModalProps {
  geneId: string
  result: AnalysisResult
  open: boolean
  onClose: () => void
  showFeedback?: boolean  // 新增：是否显示反馈区域（默认 true）
}

interface GeneData {
  gene_id: string
  expression_change: 'up' | 'down' | 'none'
  log2fc?: number
  pvalue?: number
  control_values?: number[]
  treatment_values?: number[]
}

export function GeneDetailModal({ geneId, result, open, onClose, showFeedback = true }: GeneDetailModalProps) {
  const [annotation, setAnnotation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedbackWarnings, setFeedbackWarnings] = useState<FeedbackHint[]>([])
  const [loadingFeedback, setLoadingFeedback] = useState(false)

  // 从结果中提取基因数据
  const extractGeneData = (geneId: string, source: 'tool' | 'llm'): GeneData | null => {
    const genes = source === 'tool'
      ? result.tool_result.significant_genes
      : result.llm_result.significant_genes
    return genes.find(g => g.gene_id === geneId) || null
  }

  const toolGene = extractGeneData(geneId, 'tool')
  const llmGene = extractGeneData(geneId, 'llm')
  const isInTool = !!toolGene
  const isInLlm = !!llmGene

  // 确定基因的差异方向（优先使用工具轨数据）
  const expressionChange = toolGene?.expression_change || llmGene?.expression_change || 'none'

  const fetchGeneFeedback = async (geneId: string, retryCount = 0) => {
    let isRetrying = false
    setLoadingFeedback(true)
    try {
      // 1. 精确匹配：获取包含该基因ID的原始反馈
      const allFeedbacksRes = await feedbackApi.getAll()
      const allFeedbacks = allFeedbacksRes.data?.data || []
      const geneFeedbacks = allFeedbacks.filter(
        (fb: any) => fb.gene_ids?.includes(geneId)
      )

      // 2. 关键词匹配：调用 hints API
      const hintRes = await api.get<{ data: FeedbackHint[] }>('/feedbacks/hints', {
        params: { keyword: geneId, limit: 10 }
      })
      const hints = hintRes.data?.data || []
      const warningsFromHints = hints.filter((h: FeedbackHint) => h.hint_type === 'warning')

      // 3. 合并去重：warning hints + 负面原始反馈
      const negativeGeneFeedbacks = geneFeedbacks
        .filter((f: any) => f.rating === 'negative')
        .map((f: any) => ({
          id: f.id,
          keyword: geneId,
          track: f.track,
          hint_type: 'warning' as const,
          summary: f.comment || `对 ${geneId} 的负面评价`,
          frequency: 1
        }))

      // 4. 合并 + 去重 + 排序（warning优先，再按frequency）+ 限制数量
      const combined = [...warningsFromHints, ...negativeGeneFeedbacks]
      const unique = combined.filter((item: FeedbackHint, idx: number, arr: FeedbackHint[]) =>
        arr.findIndex(t => t.id === item.id) === idx
      )
      const sorted = unique.sort((a: FeedbackHint, b: FeedbackHint) => {
        if (a.hint_type === 'warning' && b.hint_type !== 'warning') return -1
        if (a.hint_type !== 'warning' && b.hint_type === 'warning') return 1
        return (b.frequency || 0) - (a.frequency || 0)
      })
      setFeedbackWarnings(sorted.slice(0, 3))
    } catch (e) {
      console.error('Failed to fetch gene feedback:', e)
      // 网络超时或其他错误，5秒后重试一次
      if (retryCount < 1) {
        isRetrying = true
        setTimeout(() => {
          fetchGeneFeedback(geneId, retryCount + 1)
        }, 5000)
        return // 等待重试，不关闭loading
      }
    } finally {
      if (!isRetrying) {
        setLoadingFeedback(false)
      }
    }
  }

  useEffect(() => {
    if (open && geneId) {
      fetchGeneFeedback(geneId)
    } else {
      setFeedbackWarnings([])
    }
  }, [open, geneId])

  const handleSubmitAnnotation = async () => {
    if (!annotation.trim()) return
    setSubmitting(true)
    // TODO: 调用后端API保存注释
    setTimeout(() => {
      message.success('注释已记录')
      setAnnotation('')
      setSubmitting(false)
    }, 500)
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{geneId}</span>
          <span style={{ fontSize: 12, color: '#666' }}>详情</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      bodyStyle={{ padding: '16px 24px' }}
    >
      {/* 历史反馈区域 */}
      {showFeedback && (feedbackWarnings.length > 0 || loadingFeedback) && (
        <div style={{
          background: 'rgba(250, 204, 21, 0.1)',
          border: '1px solid rgba(250, 204, 21, 0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: feedbackWarnings.length > 0 ? 8 : 0
          }}>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#d48806' }}>
              历史反馈标注
            </span>
            {loadingFeedback && <Spin size="small" />}
          </div>
          {feedbackWarnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feedbackWarnings.map((warning, idx) => (
                <div key={warning.id || idx} style={{ fontSize: 12, color: '#d48806', lineHeight: 1.5 }}>
                  • {warning.summary}
                  {warning.track && <span style={{ color: '#999', marginLeft: 8 }}>({warning.track === 'tool' ? '工具轨' : '大模型轨'})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* 基本信息 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>基本信息</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: 'var(--color-bg-input)', padding: '8px 12px', borderRadius: 8, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>基因ID</div>
            <div style={{ fontWeight: 600, color: 'var(--color-accent)' }}>{geneId}</div>
          </div>
          <div style={{ background: 'var(--color-bg-input)', padding: '8px 12px', borderRadius: 8, flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>差异方向</div>
            <div style={{ fontWeight: 600 }}>
              {expressionChange === 'up' && <Tag color="red" icon={<ArrowUpOutlined />}>上调</Tag>}
              {expressionChange === 'down' && <Tag color="blue" icon={<ArrowDownOutlined />}>下调</Tag>}
              {expressionChange === 'none' && <Tag>无变化</Tag>}
            </div>
          </div>
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 工具轨数据 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ThunderboltOutlined style={{ color: '#52c41a' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>工具轨 (scipy)</span>
          {isInTool ? (
            <Tag color="green" style={{ margin: 0 }}>已检出</Tag>
          ) : (
            <Tag color="default" style={{ margin: 0 }}>未检出</Tag>
          )}
        </div>
        {isInTool ? (
          <div style={{ background: '#fafff0', border: '1px solid #b7eb8f', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>log2FC</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{toolGene?.log2fc?.toFixed(3) || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>p值</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{toolGene?.pvalue !== undefined ? (toolGene.pvalue < 0.001 ? '<0.001' : toolGene.pvalue.toFixed(4)) : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>对照组表达</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {toolGene?.control_values?.join(', ') || '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>处理组表达</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {toolGene?.treatment_values?.join(', ') || '-'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--color-bg-input)', borderRadius: 8, padding: 12, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <ExclamationCircleOutlined style={{ marginRight: 4 }} />
            该基因未达到显著差异阈值
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 大模型轨数据 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <RobotOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>大模型轨 (千问)</span>
          {isInLlm ? (
            <Tag color="blue" style={{ margin: 0 }}>已检出</Tag>
          ) : (
            <Tag color="default" style={{ margin: 0 }}>未检出</Tag>
          )}
        </div>
        {isInLlm ? (
          <div style={{ background: '#f0f7ff', border: '1px solid #91caff', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>log2FC</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{llmGene?.log2fc?.toFixed(3) || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>p值</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{llmGene?.pvalue !== undefined ? (llmGene.pvalue < 0.001 ? '<0.001' : llmGene.pvalue.toFixed(4)) : '-'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--color-bg-input)', borderRadius: 8, padding: 12, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <ExclamationCircleOutlined style={{ marginRight: 4 }} />
            模型未能检测到显著差异
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 添加注释 */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>添加注释</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            placeholder="输入关于该基因的注释..."
            onPressEnter={handleSubmitAnnotation}
            style={{ flex: 1, borderRadius: 8 }}
          />
          <Button
            type="primary"
            onClick={handleSubmitAnnotation}
            loading={submitting}
            disabled={!annotation.trim()}
            style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
          >
            提交
          </Button>
        </div>
      </div>
    </Modal>
  )
}
