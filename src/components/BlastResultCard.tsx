import { useState } from 'react'
import { Card, Table, Tag, Input, Space, Typography } from 'antd'

const { Text } = Typography

export interface BlastHit {
  query_id: string
  subject_id: string
  identity: number
  alignment_length: number
  mismatches: number
  gap_opens: number
  query_start: number
  query_end: number
  subject_start: number
  subject_end: number
  evalue: number
  bit_score: number
  query_coverage: number
  subject_title: string
}

export interface BlastResult {
  hits: BlastHit[]
  summary: {
    program: string
    database: string
    total_hits: number
    best_hit?: string
    best_identity?: number
    best_evalue?: number
  }
}

interface BlastResultCardProps {
  result: BlastResult
}

const getIdentityColor = (identity: number): string => {
  if (identity >= 95) return '#52c41a'
  if (identity >= 80) return '#1677ff'
  if (identity >= 60) return '#fa8c16'
  return '#ff4d4f'
}

export const BlastResultCard = ({ result }: BlastResultCardProps) => {
  const [searchText, setSearchText] = useState('')

  const filtered = result.hits.filter(h =>
    h.subject_id.toLowerCase().includes(searchText.toLowerCase()) ||
    (h.subject_title || '').toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    {
      title: 'Subject ID',
      dataIndex: 'subject_id',
      key: 'subject_id',
      ellipsis: true,
      width: 180,
      render: (text: string) => <Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{text}</Text>,
    },
    {
      title: 'Identity%',
      dataIndex: 'identity',
      key: 'identity',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.identity - b.identity,
      render: (v: number) => (
        <Tag color={getIdentityColor(v)} style={{ fontWeight: 600 }}>{v.toFixed(1)}%</Tag>
      ),
    },
    {
      title: 'E-value',
      dataIndex: 'evalue',
      key: 'evalue',
      width: 100,
      sorter: (a: BlastHit, b: BlastHit) => a.evalue - b.evalue,
      render: (v: number) => v === 0 ? '0.0' : v.toExponential(1),
    },
    {
      title: 'Bit Score',
      dataIndex: 'bit_score',
      key: 'bit_score',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.bit_score - b.bit_score,
      render: (v: number) => v.toFixed(0),
    },
    {
      title: 'Coverage%',
      dataIndex: 'query_coverage',
      key: 'query_coverage',
      width: 90,
      sorter: (a: BlastHit, b: BlastHit) => a.query_coverage - b.query_coverage,
      render: (v: number) => `${v}%`,
    },
    {
      title: '比对长度',
      dataIndex: 'alignment_length',
      key: 'alignment_length',
      width: 80,
      sorter: (a: BlastHit, b: BlastHit) => a.alignment_length - b.alignment_length,
    },
  ]

  const expandedRowRender = (record: BlastHit) => (
    <div style={{ padding: '4px 0', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
      <span>Query: {record.query_start}-{record.query_end}</span>
      <span>Subject: {record.subject_start}-{record.subject_end}</span>
      <span>Mismatches: {record.mismatches}</span>
      <span>Gaps: {record.gap_opens}</span>
      {record.subject_title && <span>Description: {record.subject_title}</span>}
    </div>
  )

  return (
    <Card
      style={{ marginTop: 12, background: 'var(--color-bg-card, #1e1e2e)', border: '1px solid var(--color-border, #333)' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Tag color="cyan">{result.summary.program.toUpperCase()}</Tag>
        <Tag color="purple">DB: {result.summary.database}</Tag>
        <Text style={{ fontSize: 12, color: '#888' }}>
          命中: {result.summary.total_hits}
          {result.summary.best_identity != null && ` | Top Identity: ${result.summary.best_identity.toFixed(1)}%`}
        </Text>
      </Space>

      <Input.Search
        placeholder="搜索 Subject ID 或描述..."
        size="small"
        style={{ marginBottom: 8, maxWidth: 300 }}
        onChange={e => setSearchText(e.target.value)}
      />

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey={(record, index) => `${record.subject_id}-${index}`}
        size="small"
        expandable={{ expandedRowRender }}
        pagination={{ pageSize: 10, size: 'small' }}
        scroll={{ x: 700 }}
      />
    </Card>
  )
}
