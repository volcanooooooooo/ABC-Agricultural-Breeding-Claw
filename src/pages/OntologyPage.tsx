import { useState, useCallback, useEffect } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Node, Edge, Connection, NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Button, Modal, Form, Input, Select, Space, Table, message } from 'antd'
import { PlusOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { ontologyApi, Ontology, OntologyNode, OntologyEdge } from '../api/client'

// Custom node component
function CustomNode({ data }: { data: { label: string; nodeType: string } }) {
  const colors: Record<string, string> = {
    genotype: '#1890ff',
    phenotype: '#52c41a',
    environment: '#faad14',
    trait: '#f5222d',
    default: '#8c8c8c',
  }
  const color = colors[data.nodeType] || colors.default

  return (
    <div style={{
      padding: '8px 16px',
      border: `2px solid ${color}`,
      borderRadius: 8,
      background: '#fff',
      minWidth: 100,
    }}>
      <div style={{ fontWeight: 'bold', color }}>{data.nodeType}</div>
      <div>{data.label}</div>
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
    setLoading(true)
    try {
      const response = await ontologyApi.getAll()
      setOntologies(response.data.data)
    } catch (error) {
      message.error('获取本体列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOntologies()
  }, [fetchOntologies])

  // Convert ontology to nodes/edges for ReactFlow
  const loadOntologyToFlow = (ontology: Ontology) => {
    const flowNodes: Node[] = ontology.nodes.map((node, index) => ({
      id: node.id,
      type: 'custom',
      position: {
        x: (index % 4) * 200 + 50,
        y: Math.floor(index / 4) * 150 + 50,
      },
      data: { label: node.label, nodeType: node.node_type },
    }))

    const flowEdges: Edge[] = ontology.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.relation_type,
      animated: true,
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
    setSelectedOntology(ontology)
  }

  // Handle connection
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  // Handle ontology selection
  const handleSelectOntology = (ontology: Ontology) => {
    loadOntologyToFlow(ontology)
  }

  // Create new ontology
  const handleCreateOntology = async (values: { name: string; description: string }) => {
    try {
      const response = await ontologyApi.create({
        name: values.name,
        description: values.description,
        nodes: [],
        edges: [],
      })
      message.success('本体创建成功')
      setModalVisible(false)
      form.resetFields()
      fetchOntologies()
      loadOntologyToFlow(response.data.data)
    } catch (error) {
      message.error('创建失败')
    }
  }

  // Add new node
  const handleAddNode = async () => {
    const values = await nodeForm.validateFields()
    if (!selectedOntology) return

    const newNode: OntologyNode = {
      id: `node-${Date.now()}`,
      label: values.label,
      node_type: values.node_type,
      properties: {},
    }

    try {
      const updatedNodes = [...selectedOntology.nodes, newNode]
      await ontologyApi.update(selectedOntology.id, { nodes: updatedNodes })
      message.success('节点添加成功')
      setNodeModalVisible(false)
      nodeForm.resetFields()

      // Update local state
      const updatedOntology = { ...selectedOntology, nodes: updatedNodes }
      loadOntologyToFlow(updatedOntology)
    } catch (error) {
      message.error('添加节点失败')
    }
  }

  // Save changes
  const handleSave = async () => {
    if (!selectedOntology) return

    try {
      await ontologyApi.update(selectedOntology.id, {
        nodes: selectedOntology.nodes,
        edges: selectedOntology.edges,
      })
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    }
  }

  // Filter nodes
  const filteredNodes = searchText
    ? nodes.filter(node => (node.data as { label: string }).label.toLowerCase().includes(searchText.toLowerCase()))
    : nodes

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '节点数',
      dataIndex: 'nodes',
      key: 'nodeCount',
      render: (nodes: OntologyNode[]) => nodes.length,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Ontology) => (
        <Button size="small" onClick={() => handleSelectOntology(record)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>本体管理</h2>
        <Space>
          <Input
            placeholder="搜索节点..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          <Button icon={<PlusOutlined />} onClick={() => setNodeModalVisible(true)} disabled={!selectedOntology}>
            添加节点
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} disabled={!selectedOntology}>
            保存更改
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            新建本体
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        <Card title="本体列表" style={{ width: 300, overflow: 'auto' }}>
          <Table
            dataSource={ontologies}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
          />
        </Card>

        <Card title={selectedOntology ? `本体: ${selectedOntology.name}` : '请选择本体'} style={{ flex: 1 }}>
          {selectedOntology ? (
            <div style={{ height: 500 }}>
              <ReactFlow
                nodes={filteredNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 50, color: '#999' }}>
              请从左侧选择或创建一个本体
            </div>
          )}
        </Card>
      </div>

      {/* Create Ontology Modal */}
      <Modal
        title="新建本体"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreateOntology} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Node Modal */}
      <Modal
        title="添加节点"
        open={nodeModalVisible}
        onCancel={() => setNodeModalVisible(false)}
        onOk={() => nodeForm.submit()}
      >
        <Form form={nodeForm} onFinish={handleAddNode} layout="vertical">
          <Form.Item name="label" label="节点名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="node_type" label="节点类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="genotype">基因型</Select.Option>
              <Select.Option value="phenotype">表型</Select.Option>
              <Select.Option value="environment">环境</Select.Option>
              <Select.Option value="trait">性状</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
