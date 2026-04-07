// src/components/AnalysisProgress.tsx
import { Card, Progress, Spin, Tag } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, ThunderboltOutlined, RobotOutlined } from '@ant-design/icons'

interface ProgressData {
  track: 'tool' | 'llm' | 'init' | 'consistency'
  status: string
  progress: number
  currentStep?: string
  elapsedTime?: number
}

interface AnalysisProgressProps {
  progress: ProgressData | null
  isAnalyzing: boolean
}

// 轨道状态追踪
const trackStates = {
  tool: { progress: 0, status: '等待中...', currentStep: '' },
  llm: { progress: 0, status: '等待中...', currentStep: '' },
  init: { progress: 0, status: '等待中...', currentStep: '' },
  consistency: { progress: 0, status: '等待中...', currentStep: '' },
}

export function AnalysisProgress({ progress, isAnalyzing }: AnalysisProgressProps) {
  if (!isAnalyzing && !progress) return null

  // 根据当前进度更新轨道状态
  if (progress) {
    const p = progress.progress
    // 0-15%: init
    // 15-45%: tool
    // 45-78%: llm
    // 78-90%: consistency
    // 90-100%: 完成

    if (p <= 15) {
      trackStates.init = { progress: p, status: progress.status, currentStep: progress.currentStep || '' }
      trackStates.tool = { progress: 0, status: '等待中...', currentStep: '' }
      trackStates.llm = { progress: 0, status: '等待中...', currentStep: '' }
      trackStates.consistency = { progress: 0, status: '等待中...', currentStep: '' }
    } else if (p <= 45) {
      trackStates.init = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.tool = { progress: Math.min(100, ((p - 15) / 30) * 100), status: progress.status, currentStep: progress.currentStep || '' }
      trackStates.llm = { progress: 0, status: '等待中...', currentStep: '' }
      trackStates.consistency = { progress: 0, status: '等待中...', currentStep: '' }
    } else if (p <= 78) {
      trackStates.init = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.tool = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.llm = { progress: Math.min(100, ((p - 45) / 33) * 100), status: progress.status, currentStep: progress.currentStep || '' }
      trackStates.consistency = { progress: 0, status: '等待中...', currentStep: '' }
    } else if (p <= 90) {
      trackStates.init = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.tool = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.llm = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.consistency = { progress: Math.min(100, ((p - 78) / 12) * 100), status: progress.status, currentStep: progress.currentStep || '' }
    } else {
      trackStates.init = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.tool = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.llm = { progress: 100, status: '已完成', currentStep: '' }
      trackStates.consistency = { progress: 100, status: '已完成', currentStep: '' }
    }
  }

  // 计算预估剩余时间
  const currentProgress = progress?.progress || 0
  const elapsedTime = progress?.elapsedTime || 0
  const estimatedTotalTime = elapsedTime > 0 && currentProgress > 0 ? (elapsedTime / currentProgress) * 100 : 0
  const remainingTime = Math.max(0, Math.round(estimatedTotalTime - elapsedTime))

  return (
    <Card size="small" style={{ marginBottom: 16, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentProgress >= 100 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          ) : (
            <Spin indicator={<LoadingOutlined spin style={{ color: 'var(--color-accent)' }} />} />
          )}
          <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {progress?.status || '准备分析...'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {elapsedTime > 0 && currentProgress < 100 && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
              已耗时 {Math.round(elapsedTime)}s
            </span>
          )}
          {currentProgress >= 100 ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 11, margin: 0 }}>
              分析完成
            </Tag>
          ) : remainingTime > 0 ? (
            <Tag color="processing" style={{ fontSize: 11, margin: 0 }}>
              预计剩余 {remainingTime}s
            </Tag>
          ) : null}
        </div>
      </div>

      {/* 主进度条 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>整体进度</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>{currentProgress}%</span>
        </div>
        <Progress
          percent={currentProgress}
          status={currentProgress >= 100 ? 'success' : 'active'}
          size="small"
          strokeColor={{ '0%': 'var(--color-accent)', '100%': '#1890ff' }}
          showInfo={false}
        />
        {progress?.currentStep && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center' }}>
            {progress.currentStep}
          </div>
        )}
      </div>

      {/* 分轨道进度 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--color-bg-input)', padding: 10, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 12 }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>工具轨 (scipy)</span>
          </div>
          <Progress
            percent={trackStates.tool.progress}
            status={trackStates.tool.progress >= 100 ? 'success' : 'normal'}
            size="small"
            strokeColor="#52c41a"
            showInfo={false}
          />
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {trackStates.tool.status}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg-input)', padding: 10, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <RobotOutlined style={{ color: '#1890ff', fontSize: 12 }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>大模型轨 (千问)</span>
          </div>
          <Progress
            percent={trackStates.llm.progress}
            status={trackStates.llm.progress >= 100 ? 'success' : 'normal'}
            size="small"
            strokeColor="#1890ff"
            showInfo={false}
          />
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {trackStates.llm.status}
          </div>
        </div>
      </div>
    </Card>
  )
}
