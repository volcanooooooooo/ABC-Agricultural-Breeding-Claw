import { Select, Card, Empty } from 'antd';
import { Dataset } from '../api/client';

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedId?: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function DatasetSelector({ datasets, selectedId, onSelect, loading }: DatasetSelectorProps) {
  if (!datasets.length) {
    return (
      <Empty
        description="暂无数据集，请先上传"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Select
      style={{ width: '100%' }}
      placeholder="选择数据集"
      value={selectedId}
      onChange={onSelect}
      loading={loading}
      optionLabelProp="name"
    >
      {datasets.map((ds) => (
        <Select.Option key={ds.id} value={ds.id} name={ds.name}>
          <Card size="small" style={{ margin: 0, background: 'transparent' }}>
            <div style={{ fontWeight: 500 }}>{ds.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>
              基因: {ds.gene_count} | 样本: {ds.sample_count}
            </div>
          </Card>
        </Select.Option>
      ))}
    </Select>
  );
}
