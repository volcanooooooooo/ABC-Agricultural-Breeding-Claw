import { Card, Progress } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface ProgressData {
  job_id: string;
  track?: 'tool' | 'llm';
  status: string;
  progress: number;
}

interface ProgressPanelProps {
  progress: ProgressData | null;
  isAnalyzing: boolean;
}

export function ProgressPanel({ progress, isAnalyzing }: ProgressPanelProps) {
  if (!isAnalyzing && !progress) {
    return null;
  }

  const toolProgress = progress?.track === 'tool' ? progress.progress : 0;
  const llmProgress = progress?.track === 'llm' ? progress.progress : (isAnalyzing ? 50 : 100);

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <LoadingOutlined spin style={{ marginRight: 8 }} />
        {progress?.status || '准备分析...'}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>工具轨</div>
          <Progress percent={toolProgress} status={toolProgress >= 100 ? 'success' : 'active'} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>大模型轨</div>
          <Progress percent={llmProgress} status={llmProgress >= 100 ? 'success' : 'active'} size="small" />
        </div>
      </div>
    </Card>
  );
}
