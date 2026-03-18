import { Card, Button, Input, message } from 'antd';
import { LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { feedbackApi } from '../api/client';

interface FeedbackPanelProps {
  analysisId: string;
  track: 'tool' | 'llm';
}

export function FeedbackPanel({ analysisId, track }: FeedbackPanelProps) {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) {
      message.warning('请先选择评价');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackApi.create({
        analysis_id: analysisId,
        track,
        rating,
        comment: comment || undefined,
      });
      message.success('反馈已提交');
      setRating(null);
      setComment('');
    } catch (error) {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card size="small" title="评价此结果" style={{ marginTop: 16 }}>
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
      <Input.TextArea
        rows={2}
        placeholder="添加评论（可选）"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Button type="primary" onClick={handleSubmit} loading={submitting}>
        提交反馈
      </Button>
    </Card>
  );
}
