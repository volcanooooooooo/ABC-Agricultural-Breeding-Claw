import { useState, useCallback, useEffect } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Node, Edge, Connection, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Button, Modal, Form, Input, Select, Space, Table, message, Tag } from 'antd'
import { PlusOutlined, SaveOutlined, SearchOutlined, ApiOutlined, ReloadOutlined } from '@ant-design/icons'
import { ontologyApi, Ontology, OntologyNode } from '../api/client'

// Custom node component - 温暖奶油风格
function CustomNode({ data }: { data: { label: string; nodeType: string } }) {
  const colors: Record<string, string> = {
    genotype: '#8b6914',   // 深驼色
    phenotype: '#558b2f', // 深绿
    environment: '#e65100', // 深橙
    trait: '#c62828',    // 深红
    metabolome: '#6a1b9a', // 深紫
    method: '#00695c',   // 深青
    default: '#5d4037',  // 深棕
  }
  const color = colors[data.nodeType] || colors.default

  return (
    <div style={{
      padding: '10px 18px',
      border: `2px solid ${color}`,
      borderRadius: 8,
      background: 'var(--color-bg-card)',
      minWidth: 120,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        fontWeight: 600,
        color: color,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: 4,
      }}>
        {data.nodeType}
      </div>
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{data.label}</div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

export default function OntologyPage() {
  const [ontologies, setOntologies] = useState<Ontology[]>([])
  const [selectedOntology, setSelectedOntology] = useState<Ontology | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [nodeModalVisible, setNodeModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [nodeForm] = Form.useForm()

  // Fetch ontologies
  const fetchOntologies = useCallback(async () => {
    try {
      setLoading(true)
      const response = await ontologyApi.getAll()
      const data = response.data.data || []
      setOntologies(data)
      if (data.length > 0) {
        setSelectedOntology(data[0])
      }
    } catch (error) {
      message.error('获取本体列表失败')
      // 使用空数组避免崩溃
      setOntologies([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Load ontology graph
  const loadGraph = useCallback(async () => {
    if (!selectedOntology?.id) return

    try {
      const response = await ontologyApi.getById(selectedOntology.id)
      const data = response.data.data || {}

      const flowNodes: Node[] = (data.nodes || []).map((node: OntologyNode, index: number) => ({
        id: node.id,
        type: 'custom',
        position: {
          x: (index % 4) * 250 + 100,
          y: Math.floor(index / 4) * 150 + 100,
        },
        data: { label: node.label, nodeType: node.node_type },
      }))

      const flowEdges: Edge[] = (data.edges || []).map((edge: any, i: number) => ({
        id: `e${i}`,
        source: edge.source,
        target: edge.target,
        label: edge.relation_type,
        type: 'smoothstep',
        style: { stroke: 'var(--color-accent)', strokeWidth: 2 },
        labelStyle: { fill: 'var(--color-text-secondary)', fontSize: 10 },
      }))

      setNodes(flowNodes)
      setEdges(flowEdges)
    } catch (error) {
      message.error('加载图谱失败')
    }
  }, [selectedOntology, setNodes, setEdges])

  useEffect(() => {
    fetchOntologies()
  }, [fetchOntologies])

  useEffect(() => {
    if (selectedOntology) {
      loadGraph()
    }
  }, [selectedOntology, loadGraph])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleCreateOntology = async (values: any) => {
    try {
      await ontologyApi.create(values)
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      fetchOntologies()
    } catch (error) {
      message.error('创建失败')
    }
  }

  return (
    <div style={{ height: '100%' }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <ApiOutlined style={{ color: 'var(--color-accent)' }} />
            知识本体
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            可视化育种知识图谱
          </p>
        </div>
        <Space>
          <Input
            placeholder="搜索节点..."
            prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 180, background: 'var(--color-bg-input)', border: '1px solid var(--color-border)' }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadGraph}
            style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            style={{
              background: 'var(--gradient-accent)',
              border: 'none',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
            }}
          >
            新建本体
          </Button>
        </Space>
      </div>

      {/* 本体选择和图谱 */}
      <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 100px)' }}>
        {/* 本体列表 */}
        <Card
          title="本体库"
          size="small"
          style={{
            width: 260,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
          }}
          styles={{ header: { borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }, body: { padding: 0 } }}
        >
          <div style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
            {(ontologies || []).map((onto) => (
              <div
                key={onto.id}
                onClick={() => setSelectedOntology(onto)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedOntology?.id === onto.id ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                  borderLeft: selectedOntology?.id === onto.id ? '3px solid var(--color-accent)' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{onto.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {onto.nodes?.length || 0} 个节点
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 图谱展示 */}
        <div style={{
          flex: 1,
          background: 'var(--color-bg-dark)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: 'var(--color-bg-dark)' }}
          >
            <Background color="var(--color-border)" gap={40} />
            <Controls
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
              }}
            />
            <MiniMap
              nodeColor={(node) => {
                const colors: Record<string, string> = {
                  genotype: 'var(--color-accent)',
                  phenotype: '#00e676',
                  environment: '#ffab00',
                  trait: '#ff5252',
                }
                return colors[node.data?.nodeType as keyof typeof colors] || 'var(--color-text-secondary)'
              }}
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
              }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* 新建本体弹窗 */}
      <Modal
        title="新建本体"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreateOntology} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="输入本体名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="输入描述" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
