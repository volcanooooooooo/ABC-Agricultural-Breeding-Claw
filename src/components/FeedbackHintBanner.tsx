// src/components/FeedbackHintBanner.tsx
import { Alert } from 'antd'
import { BulbOutlined } from '@ant-design/icons'
import { FeedbackHint, useFeedbackHints } from '../hooks/useFeedbackHints'

interface FeedbackHintBannerProps {
  context?: string
}

export function FeedbackHintBanner({ context }: FeedbackHintBannerProps) {
  const { hints, loading } = useFeedbackHints(context || null)

  if (!context || hints.length === 0 || loading) return null

  const warnings = hints.filter(h => h.hint_type === 'warning')

  if (warnings.length === 0) return null

  return (
    <Alert
      message={
        <div>
          <BulbOutlined style={{ marginRight: 8 }} />
          <span>历史反馈提示</span>
        </div>
      }
      description={
        <div>
          {warnings.slice(0, 2).map(h => (
            <div key={h.id} style={{ marginBottom: 4 }}>
              • {h.summary || `有用户反馈大模型在此类数据中${h.hint_type === 'warning' ? '需注意' : '表现好'}`}
            </div>
          ))}
        </div>
      }
      type="warning"
      style={{ marginBottom: 16 }}
      showIcon
    />
  )
}
