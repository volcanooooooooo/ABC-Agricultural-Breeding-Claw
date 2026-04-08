import { useState } from 'react'
import { Card, Radio, Table, Tag, Input, Space, Typography } from 'antd'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const { Text } = Typography

export interface PathwayResult {
  pathway: string
  pathway_id: string
  gene_count: number
  total_genes: number
  pvalue: number
  adjusted_pvalue: number
  enrichment_score: number
  genes: string[]
}

export interface EnrichmentResult {
  kegg_results: PathwayResult[]
  go_results: PathwayResult[]
  summary: {
    input_gene_count: number
    kegg_significant: number
    go_significant: number
    top_kegg_pathway: string
    top_go_term: string
    organism: string
    pvalue_cutoff: number
  }
}

interface EnrichmentResultCardProps {
  result: EnrichmentResult
}

const getBubbleColor = (adjP: number): string => {
  if (adjP <= 0.001) return '#cf1322'
  if (adjP <= 0.01) return '#fa541c'
  if (adjP <= 0.05) return '#fa8c16'
  return '#1677ff'
}

const getBubbleSize = (geneCount: number, maxCount: number): number => {
  if (maxCount === 0) return 10
  return 10 + (geneCount / maxCount) * 30
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d: PathwayResult = payload[0].payload
  return (
    <div style={{
      background: 'var(--color-bg-card, #1e1e2e)',
      border: '1px solid var(--color-border, #333)',
      borderRadius: 8,
      padding: '10px 14px',
      maxWidth: 280,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{d.pathway}</div>
      <div style={{ fontSize: 12, color: '#aaa' }}>ID: {d.pathway_id}</div>
      <div style={{ fontSize: 12 }}>富集倍数: <b>{d.enrichment_score.toFixed(2)}</b></div>
      <div style={{ fontSize: 12 }}>基因数: <b>{d.gene_count}</b></div>
      <div style={{ fontSize: 12 }}>adj.P: <b>{d.adjusted_pvalue.toExponential(2)}</b></div>
      <div style={{ fontSize: 11, marginTop: 4, color: '#aaa' }}>
        {d.genes.slice(0, 6).join(', ')}{d.genes.length > 6 ? ` ...+${d.genes.length - 6}` : ''}
      </div>
    </div>
  )
}

export const EnrichmentResultCard = ({ result }: EnrichmentResultCardProps) => {
  const [dbType, setDbType] = useState<'KEGG' | 'GO'>('KEGG')
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [searchText, setSearchText] = useState('')

  const data = dbType === 'KEGG' ? result.kegg_results : result.go_results
  const top15 = data.slice(0, 15)
  const maxCount = Math.max(...top15.map(d => d.gene_count), 1)

  const filtered = data.filter(d =>
    d.pathway.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    {
      title: '通路/Term',
      dataIndex: 'pathway',
      key: 'pathway',
      ellipsis: true,
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: '基因数',
      dataIndex: 'gene_count',
      key: 'gene_count',
      width: 80,
      sorter: (a: PathwayResult, b: PathwayResult) => a.gene_count - b.gene_count,
    },
    {
      title: '富集倍数',
      dataIndex: 'enrichment_score',
      key: 'enrichment_score',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.enrichment_score - b.enrichment_score,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'P值',
      dataIndex: 'pvalue',
      key: 'pvalue',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.pvalue - b.pvalue,
      render: (v: number) => v.toExponential(2),
    },
    {
      title: 'adj.P值',
      dataIndex: 'adjusted_pvalue',
      key: 'adjusted_pvalue',
      width: 100,
      sorter: (a: PathwayResult, b: PathwayResult) => a.adjusted_pvalue - b.adjusted_pvalue,
      render: (v: number) => v.toExponential(2),
    },
  ]

  const expandedRowRender = (record: PathwayResult) => (
    <div style={{ padding: '4px 0' }}>
      {record.genes.map(g => (
        <Tag key={g} color="blue" style={{ marginBottom: 4 }}>{g}</Tag>
      ))}
    </div>
  )

  return (
    <Card
      style={{ marginTop: 12, background: 'var(--color-bg-card, #1e1e2e)', border: '1px solid var(--color-border, #333)' }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <Radio.Group value={dbType} onChange={e => setDbType(e.target.value)} buttonStyle="solid" size="small">
          <Radio.Button value="KEGG">KEGG ({result.summary.kegg_significant})</Radio.Button>
          <Radio.Button value="GO">GO ({result.summary.go_significant})</Radio.Button>
        </Radio.Group>
        <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} buttonStyle="solid" size="small">
          <Radio.Button value="chart">气泡图</Radio.Button>
          <Radio.Button value="table">表格</Radio.Button>
        </Radio.Group>
        <Text style={{ fontSize: 12, color: '#888' }}>
          输入基因数: {result.summary.input_gene_count} | 物种: {result.summary.organism}
        </Text>
      </Space>

      {viewMode === 'chart' && (
        top15.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>
            无显著富集结果（adj.P ≤ {result.summary.pvalue_cutoff}）
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, top15.length * 28)}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 200 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis
                type="number"
                dataKey="enrichment_score"
                name="富集倍数"
                label={{ value: '富集倍数 (Combined Score)', position: 'insideBottom', offset: -15, fill: '#aaa', fontSize: 12 }}
                tick={{ fill: '#aaa', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="pathway"
                name="通路"
                width={190}
                tick={{ fill: '#ccc', fontSize: 11 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={top15}>
                {top15.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={getBubbleColor(entry.adjusted_pvalue)}
                    r={getBubbleSize(entry.gene_count, maxCount)}
                    fillOpacity={0.85}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )
      )}

      {viewMode === 'table' && (
        <>
          <Input.Search
            placeholder="搜索通路名称..."
            size="small"
            style={{ marginBottom: 8, maxWidth: 300 }}
            onChange={e => setSearchText(e.target.value)}
          />
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="pathway_id"
            size="small"
            expandable={{ expandedRowRender }}
            pagination={{ pageSize: 10, size: 'small' }}
            scroll={{ x: 600 }}
          />
        </>
      )}
    </Card>
  )
}
