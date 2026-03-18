import { Button, message } from 'antd'
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { feedbackApi } from '../api/client'

interface FeedbackWidgetProps {
  analysisId: string
}

export function FeedbackWidget({ analysisId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!rating) return

    setLoading(true)
    try {
      // 提交两条反馈：tool和llm各一条
      await feedbackApi.create({
        analysis_id: analysisId,
        track: 'tool',
        rating,
      })
      await feedbackApi.create({
        analysis_id: analysisId,
        track: 'llm',
        rating,
      })
      setSubmitted(true)
      message.success('感谢您的反馈！')
    } catch (e) {
      message.error('提交失败')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 16,
        background: '#f6ffed',
        borderRadius: 8,
        marginTop: 16
      }}>
        感谢您的反馈！
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 8 }}>
      <div style={{ marginBottom: 8, fontSize: 13 }}>评价此分析结果：</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button
          type={rating === 'positive' ? 'primary' : 'default'}
          icon={<LikeOutlined />}
          onClick={() => setRating('positive')}
          style={{ background: rating === 'positive' ? '#52c41a' : undefined }}
        >
          点赞
        </Button>
        <Button
          type={rating === 'negative' ? 'primary' : 'default'}
          icon={<DislikeOutlined />}
          onClick={() => setRating('negative')}
          danger={rating === 'negative'}
        >
          点踩
        </Button>
      </div>
      <Button type="primary" onClick={handleSubmit} loading={loading} disabled={!rating}>
        提交反馈
      </Button>
    </div>
  )
}
