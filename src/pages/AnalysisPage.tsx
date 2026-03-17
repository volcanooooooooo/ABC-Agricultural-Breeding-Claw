import { useState, useEffect, useCallback } from 'react'
import { Card, Row, Col, Select, Button, Table, Tag, Space, Spin, Empty, Modal, Form, Input, message } from 'antd'
import { PlayCircleOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts'
import { DataSource, AnalysisResult } from '../api/client'

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

// Mock data for demonstration
const mockDataSources: DataSource[] = [
  { id: '1', name: '水稻产量数据', type: 'csv', description: '2020-2024年水稻产量统计数据' },
  { id: '2', name: '小麦基因型数据', type: 'excel', description: '小麦品种基因型分析数据' },
  { id: '3', name: '玉米环境数据', type: 'json', description: '玉米种植环境监测数据' },
]

const mockAnalysisResults: AnalysisResult[] = [
  {
    id: '1',
    name: '产量趋势分析',
    type: 'trend',
    created_at: '2024-01-15T10:30:00Z',
    data: {
      years: ['2020', '2021', '2022', '2023', '2024'],
      values: [4500, 4800, 5200, 5100, 5500],
    },
  },
  {
    id: '2',
    name: '品种分布',
    type: 'distribution',
    created_at: '2024-01-14T15:20:00Z',
    data: {
      categories: ['品种A', '品种B', '品种C', '品种D'],
      values: [35, 28, 22, 15],
    },
  },
  {
    id: '3',
    name: '月度产量对比',
    type: 'comparison',
    created_at: '2024-01-13T09:00:00Z',
    data: {
      months: ['1月', '2月', '3月', '4月', '5月', '6月'],
      current: [320, 380, 420, 450, 480, 520],
      previous: [300, 350, 390, 410, 440, 470],
    },
  },
]

export default function AnalysisPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [runModalVisible, setRunModalVisible] = useState(false)
  const [form] = Form.useForm()

  // Fetch data sources and results
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Use mock data for now
      setDataSources(mockDataSources)
      setResults(mockAnalysisResults)
    } catch (error) {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Run analysis
  const handleRunAnalysis = async (values: { name: string; analysis_type: string }) => {
    if (!selectedSource) {
      message.warning('请选择数据源')
      return
    }

    setLoading(true)
    try {
      // Simulate analysis execution
      await new Promise(resolve => setTimeout(resolve, 1500))

      const newResult: AnalysisResult = {
        id: `result-${Date.now()}`,
        name: values.name,
        type: values.analysis_type,
        created_at: new Date().toISOString(),
        data: generateMockData(values.analysis_type),
      }

      setResults(prev => [newResult, ...prev])
      setSelectedResult(newResult)
      setRunModalVisible(false)
      form.resetFields()
      message.success('分析完成')
    } catch (error) {
      message.error('分析失败')
    } finally {
      setLoading(false)
    }
  }

  // Generate mock data based on analysis type
  const generateMockData = (type: string) => {
    switch (type) {
      case 'trend':
        return {
          years: ['2020', '2021', '2022', '2023', '2024'],
          values: [4500 + Math.random() * 1000, 4800 + Math.random() * 1000, 5200 + Math.random() * 1000, 5100 + Math.random() * 1000, 5500 + Math.random() * 1000],
        }
      case 'distribution':
        return {
          categories: ['品种A', '品种B', '品种C', '品种D', '品种E'],
          values: [30 + Math.random() * 20, 25 + Math.random() * 15, 20 + Math.random() * 10, 15 + Math.random() * 10, 10 + Math.random() * 5],
        }
      case 'comparison':
        return {
          months: ['1月', '2月', '3月', '4月', '5月', '6月'],
          current: Array.from({ length: 6 }, () => 300 + Math.random() * 300),
          previous: Array.from({ length: 6 }, () => 280 + Math.random() * 250),
        }
      default:
        return {}
    }
  }

  // Render chart based on analysis type
  const renderChart = (result: AnalysisResult) => {
    const { data } = result

    switch (result.type) {
      case 'trend':
        const trendData = data.years.map((year: string, i: number) => ({
          year,
          value: data.values[i],
        }))
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#1890ff" name="产量" />
            </LineChart>
          </ResponsiveContainer>
        )

      case 'distribution':
        const pieData = data.categories.map((cat: string, i: number) => ({
          name: cat,
          value: data.values[i],
        }))
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'comparison':
        const compData = data.months.map((month: string, i: number) => ({
          month,
          当前: data.current[i],
          去年: data.previous[i],
        }))
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={compData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="当前" fill="#1890ff" />
              <Bar dataKey="去年" fill="#52c41a" />
            </BarChart>
          </ResponsiveContainer>
        )

      default:
        return <Empty description="不支持的分析类型" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <LineChartOutlined />
      case 'distribution':
        return <PieChartOutlined />
      case 'comparison':
        return <BarChartOutlined />
      default:
        return <BarChartOutlined />
    }
  }

  const sourceColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => <Tag>{t.toUpperCase()}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  ]

  const resultColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AnalysisResult) => (
        <a onClick={() => setSelectedResult(record)}>{name}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag icon={getTypeIcon(type)}>
          {type === 'trend' ? '趋势' : type === 'distribution' ? '分布' : '对比'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (d: string) => new Date(d).toLocaleString('zh-CN'),
    },
  ]

  return (
    <div style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>数据分析</h2>
        <Space>
          <Select
            placeholder="选择数据源"
            style={{ width: 200 }}
            value={selectedSource}
            onChange={setSelectedSource}
            options={dataSources.map(ds => ({ label: ds.name, value: ds.id }))}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => setRunModalVisible(true)}
            disabled={!selectedSource}
          >
            运行分析
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card title="数据源" size="small" style={{ marginBottom: 16 }}>
            <Table
              dataSource={dataSources}
              columns={sourceColumns}
              rowKey="id"
              size="small"
              pagination={false}
              onRow={(record) => ({
                onClick: () => setSelectedSource(record.id),
                style: { cursor: 'pointer', background: selectedSource === record.id ? '#e6f7ff' : undefined },
              })}
            />
          </Card>
          <Card title="分析结果" size="small">
            <Table
              dataSource={results}
              columns={resultColumns}
              rowKey="id"
              size="small"
              pagination={false}
              onRow={(record) => ({
                onClick: () => setSelectedResult(record),
                style: { cursor: 'pointer', background: selectedResult?.id === record.id ? '#e6f7ff' : undefined },
              })}
            />
          </Card>
        </Col>
        <Col span={18}>
          <Card title={selectedResult ? selectedResult.name : '分析结果'}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 100 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>分析中...</div>
              </div>
            ) : selectedResult ? (
              renderChart(selectedResult)
            ) : (
              <Empty description="请选择分析结果或运行新分析" />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="运行分析"
        open={runModalVisible}
        onCancel={() => setRunModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleRunAnalysis} layout="vertical">
          <Form.Item name="name" label="分析名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="analysis_type" label="分析类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="trend">趋势分析</Select.Option>
              <Select.Option value="distribution">分布分析</Select.Option>
              <Select.Option value="comparison">对比分析</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
