// src/components/AnalysisProgress.tsx
import { Card, Progress, Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'
import { useMemo } from 'react'

interface ProgressData {
  track: 'tool' | 'llm'
  status: string
  progress: number
  currentStep?: string
  elapsedTime?: number
}

interface AnalysisProgressProps {
  progress: ProgressData | null
  isAnalyzing: boolean
}

export function AnalysisProgress({ progress, isAnalyzing }: AnalysisProgressProps) {
  if (!isAnalyzing && !progress) return null

  const toolProgress = progress?.track === 'tool' ? progress.progress : (isAnalyzing ? 0 : 100)
  const llmProgress = progress?.track === 'llm' ? progress.progress : (isAnalyzing ? 0 : 100)

  const toolStatus = progress?.track === 'tool' ? progress.status : (isAnalyzing ? '等待中...' : '已完成')
  const llmStatus = progress?.track === 'llm' ? progress.status : (isAnalyzing ? '等待中...' : '已完成')

  return (
    <Card size="small" style={{ marginBottom: 16, background: 'var(--color-bg-card)' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Spin indicator={<LoadingOutlined spin />} />
        <span>{progress?.status || '准备分析...'}</span>
        {progress?.elapsedTime && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            已耗时 {Math.round(progress.elapsedTime)}s
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>工具轨 (scipy)</span>
            <span>{toolProgress}%</span>
          </div>
          <Progress
            percent={toolProgress}
            status={toolProgress >= 100 ? 'success' : 'active'}
            size="small"
            strokeColor="#52c41a"
          />
          {progress?.track === 'tool' && progress.currentStep && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {progress.currentStep}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>大模型轨 (千问)</span>
            <span>{llmProgress}%</span>
          </div>
          <Progress
            percent={llmProgress}
            status={llmProgress >= 100 ? 'success' : 'active'}
            size="small"
            strokeColor="#1890ff"
          />
          {progress?.track === 'llm' && progress.currentStep && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {progress.currentStep}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
