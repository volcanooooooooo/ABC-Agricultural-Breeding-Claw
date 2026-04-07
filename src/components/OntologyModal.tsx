import { useState, useCallback, useEffect, useMemo } from 'react'
import { Modal, Input, Select, Button, Drawer, Descriptions, Tag, Tooltip, Space, Spin, message, Empty, Card, Divider } from 'antd'
import { SearchOutlined, ReloadOutlined, ApiOutlined, NodeIndexOutlined, ArrowRightOutlined, DatabaseOutlined, ExperimentOutlined, AuditOutlined, CheckCircleOutlined, BuildOutlined, FileTextOutlined, HistoryOutlined } from '@ant-design/icons'
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, NodeTypes, Handle, Position, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ontologyApi, analysisApi, feedbackApi, OntologyNode, OntologyEdge, OntologyGraph, OntologyNodeType, AnalysisResultSummary, Feedback } from '../api/client'

// 节点类型到颜色的映射 - 温暖奶油风格
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; tag: string }> = {
  Dataset: { bg: 'linear-gradient(135deg, #e8f4fd 0%, #d6e9f8 100%)', border: '#5ba3d9', text: '#2a75b3', tag: '#5ba3d9' },
  Sample: { bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', border: '#66bb6a', text: '#388e3c', tag: '#66bb6a' },
  Gene: { bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', border: '#ffa726', text: '#e65100', tag: '#ffa726' },
  Measurement: { bg: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)', border: '#ab47bc', text: '#7b1fa2', tag: '#ab47bc' },
  ProcessStep: { bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', border: '#42a5f5', text: '#1565c0', tag: '#42a5f5' },
  Tool: { bg: 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)', border: '#26a69a', text: '#00796b', tag: '#26a69a' },
  Result: { bg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)', border: '#ef5350', text: '#c62828', tag: '#ef5350' },
  Conclusion: { bg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)', border: '#d4a574', text: '#b8956a', tag: '#d4a574' },
  genotype: { bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', border: '#ffa726', text: '#e65100', tag: '#ffa726' },
  trait: { bg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)', border: '#ef5350', text: '#c62828', tag: '#ef5350' },
  metabolome: { bg: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)', border: '#ab47bc', text: '#7b1fa2', tag: '#ab47bc' },
  environment: { bg: 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)', border: '#26a69a', text: '#00796b', tag: '#26a69a' },
  method: { bg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', border: '#42a5f5', text: '#1565c0', tag: '#42a5f5' },
}

// 节点类型图标映射
const TYPE_ICONS: Record<string, any> = {
  Dataset: <DatabaseOutlined />,
  Sample: <ExperimentOutlined />,
  Gene: <NodeIndexOutlined />,
  Measurement: <AuditOutlined />,
  ProcessStep: <ArrowRightOutlined />,
  Tool: <BuildOutlined />,
  Result: <CheckCircleOutlined />,
  Conclusion: <FileTextOutlined />,
}

interface OntologyModalProps {
  open: boolean
  onClose: () => void
  searchKeyword?: string  // 可选：打开时自动搜索的关键词
  nodeId?: string  // 可选：打开时自动选中的节点ID
}

function CustomNode({ data }: { data: { node: OntologyNode; onClick?: () => void } }) {
  const type = data.node.type
  const colors = TYPE_COLORS[type] || { bg: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)', border: '#9e9e9e', text: '#616161', tag: '#9e9e9e' }

  return (
    <div
      className="ontology-node"
      style={{
        padding: '10px 14px',
        background: colors.bg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 10,
        minWidth: 110,
        maxWidth: 170,
        boxShadow: `0 2px 8px rgba(0,0,0,0.06)`,
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, width: 8, height: 8 }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
      }}>
        <span style={{ color: colors.tag, fontSize: 11 }}>{TYPE_ICONS[type]}</span>
        <span style={{
          fontSize: 9,
          fontWeight: 600,
          color: colors.text,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {type}
        </span>
      </div>

      <div style={{
        color: colors.text,
        fontWeight: 500,
        fontSize: 12,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {data.node.name}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

export function OntologyModal({ open, onClose, searchKeyword, nodeId }: OntologyModalProps) {
  const [graph, setGraph] = useState<OntologyGraph | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [nodeRelations, setNodeRelations] = useState<{ incoming: OntologyEdge[]; outgoing: OntologyEdge[] }>({ incoming: [], outgoing: [] })
  const [pendingNodeId, setPendingNodeId] = useState<string | undefined>()

  // 历史分析相关状态
  const [historyAnalyses, setHistoryAnalyses] = useState<AnalysisResultSummary[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<any | null>(null)
  const [loadingHistoryDetail, setLoadingHistoryDetail] = useState(false)
  const [selectedHistoryFeedbacks, setSelectedHistoryFeedbacks] = useState<Feedback[]>([])

  // 加载完整图谱
  const loadGraph = useCallback(async () => {
    try {
      setLoading(true)
      const response = await ontologyApi.getGraph()
      setGraph(response.data)
    } catch (error) {
      message.error('加载本体图谱失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setPendingNodeId(undefined)  // 清理之前的状态
      setSelectedNode(null)  // 清理之前选中的节点
      setSelectedHistoryResult(null)  // 清理之前的历史详情
      setSelectedHistoryFeedbacks([])
      loadGraph()
    }
  }, [open, loadGraph])

  // 处理外部传入的搜索关键词
  useEffect(() => {
    if (searchKeyword) {
      setSearchText(searchKeyword)
    }
  }, [searchKeyword])

  // 处理外部传入的节点ID - 保存待处理状态
  useEffect(() => {
    if (nodeId) {
      setPendingNodeId(nodeId)
    }
  }, [nodeId])

  // 当 graph 加载完成时，检查是否有待处理的节点ID
  useEffect(() => {
    if (graph && pendingNodeId) {
      const node = graph.nodes.find(n => n.id === pendingNodeId)
      if (node) {
        setSelectedNode(node)
        setDrawerVisible(true)
      }
      setPendingNodeId(undefined)
    }
  }, [graph, pendingNodeId])

  // 根据过滤条件构建节点和边
  useEffect(() => {
    if (!graph) return

    let filteredNodes = graph.nodes
    let filteredEdges = graph.edges

    if (selectedType) {
      filteredNodes = filteredNodes.filter(n => n.type === selectedType)
    }

    if (searchText.trim()) {
      const kw = searchText.toLowerCase()
      filteredNodes = filteredNodes.filter(n =>
        n.name.toLowerCase().includes(kw) ||
        n.id.toLowerCase().includes(kw)
      )
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id))
    filteredEdges = filteredEdges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    )

    const typeOrder: OntologyNodeType[] = ['Dataset', 'Sample', 'Measurement', 'Gene', 'ProcessStep', 'Tool', 'Result', 'Conclusion']

    const typeGroups: Record<string, OntologyNode[]> = {}
    for (const node of filteredNodes) {
      const t = node.type
      if (!typeGroups[t]) typeGroups[t] = []
      typeGroups[t].push(node)
    }

    const flowNodes: Node[] = []
    let yOffset = 0
    for (const t of typeOrder) {
      const group = typeGroups[t]
      if (!group || group.length === 0) continue

      group.forEach((node, i) => {
        flowNodes.push({
          id: node.id,
          type: 'custom',
          position: { x: 100 + (i % 6) * 200, y: yOffset },
          data: {
            node,
            label: node.name,
            nodeType: node.type,
            onClick: () => {
              setSelectedNode(node)
              setDrawerVisible(true)
            },
          },
        })
      })
      yOffset += 140
    }

    const flowEdges: Edge[] = filteredEdges.map((edge, i) => ({
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: 'out',
      targetHandle: 'in',
      label: edge.relation,
      type: 'default',
      style: { stroke: '#c9a87c', strokeWidth: 1.5, opacity: 0.6 },
      labelStyle: { fill: '#b8956a', fontSize: 10 },
    }))

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [graph, selectedType, searchText])

  // 获取节点类型统计
  const nodeStats = useMemo(() => {
    if (!graph) return []
    const counts: Record<string, number> = {}
    for (const n of graph.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1
    }
    return Object.entries(counts).map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  }, [graph])

  // 获取选中节点的关联信息
  useEffect(() => {
    if (!selectedNode) return
    ontologyApi.getNodeRelations(selectedNode.id)
      .then(res => setNodeRelations(res.data))
      .catch(() => setNodeRelations({ incoming: [], outgoing: [] }))
  }, [selectedNode])

  // 获取选中节点的历史分析记录（仅对基因类型）
  useEffect(() => {
    if (!selectedNode) return
    // 切换节点时清除之前的历史详情
    setSelectedHistoryResult(null)
    setSelectedHistoryFeedbacks([])
    // 只有 Gene 类型才获取历史分析
    if (selectedNode.type !== 'Gene' && selectedNode.type !== 'gene') {
      setHistoryAnalyses([])
      return
    }

    const fetchHistory = async () => {
      setLoadingHistory(true)
      try {
        const res = await analysisApi.getResultsByGene(selectedNode.id)
        setHistoryAnalyses(res.data?.data || [])
      } catch (e) {
        console.error('Failed to fetch history analyses:', e)
        setHistoryAnalyses([])
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [selectedNode])

  // 获取历史分析详情
  const handleViewHistoryDetail = async (jobId: string) => {
    setLoadingHistoryDetail(true)
    try {
      const [resultRes, feedbackRes] = await Promise.all([
        analysisApi.getResult(jobId),
        feedbackApi.getByAnalysis(jobId)
      ])
      setSelectedHistoryResult(resultRes.data?.data || null)
      setSelectedHistoryFeedbacks(feedbackRes.data?.data || [])
    } catch (e) {
      console.error('Failed to fetch analysis detail:', e)
      setSelectedHistoryResult(null)
      setSelectedHistoryFeedbacks([])
    } finally {
      setLoadingHistoryDetail(false)
    }
  }

  // 获取关联节点的名称
  const getNodeName = (nodeId: string) => {
    return graph?.nodes.find(n => n.id === nodeId)?.name || nodeId
  }

  const totalNodes = graph?.nodes.length || 0
  const totalEdges = graph?.edges.length || 0

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="100%"
      style={{ top: 0 }}
      styles={{ body: { margin: 0, padding: 0, height: 'calc(100vh - 110px)', background: 'var(--color-bg-dark)' } }}
      closable
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--gradient-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ApiOutlined style={{ fontSize: 18, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>知识本体</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Knowledge Ontology Graph</div>
          </div>
        </div>
      }
    >
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg-dark)',
      }}>
        {/* 工具栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Input
              placeholder="搜索节点名称或ID..."
              prefix={<SearchOutlined style={{ color: 'var(--color-text-muted)' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              style={{
                width: 200,
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text-primary)',
              }}
            />
            <Select
              placeholder="全部类型"
              allowClear
              value={selectedType}
              onChange={setSelectedType}
              style={{ width: 150 }}
              options={nodeStats.map(s => ({
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: TYPE_COLORS[s.type]?.tag || 'var(--color-text-muted)' }}>{TYPE_ICONS[s.type] || <NodeIndexOutlined />}</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>{s.type}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>({s.count})</span>
                  </div>
                ),
                value: s.type
              }))}
            />
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <div style={{
                padding: '6px 12px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-accent)' }}>{totalNodes}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>节点</div>
              </div>
              <div style={{
                padding: '6px 12px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gold)' }}>{totalEdges}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>边</div>
              </div>
            </div>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadGraph}
              loading={loading}
              style={{
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-text-primary)',
              }}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 图谱区域 */}
        <div style={{
          flex: 1,
          minHeight: 0,
          margin: 16,
          background: 'var(--color-bg-card)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              style={{ background: 'transparent', width: '100%', height: '100%' }}
              defaultEdgeOptions={{
                type: 'smoothstep',
                style: { stroke: '#c9a87c', strokeWidth: 1.5, opacity: 0.5 },
              }}
            >
              <Background
                color="rgba(201, 168, 124, 0.15)"
                gap={40}
                style={{ background: 'transparent' }}
              />
              <Controls
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
              />
              <MiniMap
                nodeColor={(node) => {
                  const type = (node.data as any)?.node?.type as string
                  return TYPE_COLORS[type]?.border || '#9e9e9e'
                }}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          </ReactFlowProvider>

          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(4px)',
            }}>
              <div style={{
                padding: '16px 32px',
                background: 'var(--color-bg-card)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}>
                <Spin style={{ marginRight: 8 }} />
                正在加载图谱数据...
              </div>
            </div>
          )}

          {!loading && nodes.length === 0 && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}>
              <ApiOutlined style={{ fontSize: 48, color: 'var(--color-border)' }} />
              <div style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>暂无数据</div>
            </div>
          )}
        </div>

        {/* 节点类型图例 */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          maxWidth: 600,
          padding: '12px 16px',
          margin: '0 16px 16px',
          background: 'var(--color-bg-card)',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
        }}>
          {nodeStats.map(({ type, count }) => {
            const colors = TYPE_COLORS[type] || { border: '#9e9e9e', text: '#616161', tag: '#9e9e9e', bg: '#f5f5f5' }
            return (
              <Tooltip key={type} title={`${type} 类型，共 ${count} 个节点`}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                  onClick={() => setSelectedType(selectedType === type ? undefined : type)}
                >
                  <span style={{ color: colors.tag, fontSize: 12 }}>{TYPE_ICONS[type]}</span>
                  <span style={{ color: colors.text, fontSize: 11 }}>{type}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                </div>
              </Tooltip>
            )
          })}
        </div>

        {/* 节点详情抽屉 */}
        <Drawer
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: selectedNode ? TYPE_COLORS[selectedNode.type]?.border : 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
              }}>
                {selectedNode && (TYPE_ICONS[selectedNode.type] || <NodeIndexOutlined />)}
              </div>
              <span style={{ color: 'var(--color-text-primary)' }}>节点详情</span>
            </div>
          }
          placement="right"
          width={400}
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          styles={{
            header: { background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' },
            body: { background: 'var(--color-bg-dark)', padding: 16 },
            content: { background: 'var(--color-bg-card)' },
          }}
        >
          {selectedNode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                padding: 16,
                background: selectedNode ? TYPE_COLORS[selectedNode.type]?.bg : 'var(--color-bg-input)',
                borderRadius: 10,
                border: `1px solid ${TYPE_COLORS[selectedNode.type]?.border || 'var(--color-border)'}`,
              }}>
                <div style={{ fontSize: 10, color: TYPE_COLORS[selectedNode.type]?.text, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                  {selectedNode.type}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                  {selectedNode.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  ID: {selectedNode.id}
                </div>
              </div>

              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div style={{
                  padding: 14,
                  background: 'var(--color-bg-card)',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 10, fontWeight: 500 }}>属性信息</div>
                  <pre style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'JetBrains Mono, monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(selectedNode.properties, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 10, fontWeight: 500 }}>关联关系</div>

                {nodeRelations.incoming.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowRightOutlined style={{ rotate: '180deg' }} />
                      入边 ({nodeRelations.incoming.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {nodeRelations.incoming.slice(0, 5).map((e, i) => (
                        <div key={i} style={{
                          padding: '8px 12px',
                          background: 'var(--color-bg-card)',
                          borderRadius: 8,
                          border: '1px solid var(--color-border)',
                          fontSize: 12,
                        }}>
                          <div style={{ color: 'var(--color-accent)', marginBottom: 2 }}>{e.relation}</div>
                          <a
                            style={{ color: 'var(--color-accent)', cursor: 'pointer' }}
                            onClick={() => {
                              const n = graph?.nodes.find(n => n.id === e.source)
                              if (n) { setSelectedNode(n) }
                            }}
                          >
                            {getNodeName(e.source)}
                          </a>
                        </div>
                      ))}
                      {nodeRelations.incoming.length > 5 && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                          还有 {nodeRelations.incoming.length - 5} 条...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {nodeRelations.outgoing.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowRightOutlined />
                      出边 ({nodeRelations.outgoing.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {nodeRelations.outgoing.slice(0, 5).map((e, i) => (
                        <div key={i} style={{
                          padding: '8px 12px',
                          background: 'var(--color-bg-card)',
                          borderRadius: 8,
                          border: '1px solid var(--color-border)',
                          fontSize: 12,
                        }}>
                          <div style={{ color: 'var(--color-accent)', marginBottom: 2 }}>{e.relation}</div>
                          <a
                            style={{ color: 'var(--color-accent)', cursor: 'pointer' }}
                            onClick={() => {
                              const n = graph?.nodes.find(n => n.id === e.target)
                              if (n) { setSelectedNode(n) }
                            }}
                          >
                            {getNodeName(e.target)}
                          </a>
                        </div>
                      ))}
                      {nodeRelations.outgoing.length > 5 && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                          还有 {nodeRelations.outgoing.length - 5} 条...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {nodeRelations.incoming.length === 0 && nodeRelations.outgoing.length === 0 && (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
                    暂无关联关系
                  </div>
                )}
              </div>

              {/* 历史分析区域（仅对基因节点显示） */}
              {(selectedNode?.type === 'Gene' || selectedNode?.type === 'gene') && (
                <div style={{ marginTop: 16 }}>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <HistoryOutlined style={{ color: '#1890ff' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>历史分析</span>
                    {loadingHistory && <Spin size="small" />}
                  </div>

                  {historyAnalyses.length === 0 && !loadingHistory ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史分析" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {historyAnalyses.map((analysis) => (
                        <Card
                          key={analysis.id}
                          size="small"
                          hoverable
                          onClick={() => handleViewHistoryDetail(analysis.id)}
                          style={{
                            background: selectedHistoryResult?.id === analysis.id ? '#e6f7ff' : 'var(--color-bg-input)',
                            border: selectedHistoryResult?.id === analysis.id ? '1px solid #1890ff' : '1px solid var(--color-border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{analysis.dataset_name}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                {new Date(analysis.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 12 }}>
                                <span style={{ color: '#52c41a' }}>✓ {analysis.feedback_count}</span> 条反馈
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                评分: {analysis.avg_rating > 0 ? `${(analysis.avg_rating * 100).toFixed(0)}%` : '无'}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* 展开的历史分析详情 */}
                  {selectedHistoryResult && (
                    <Card
                      size="small"
                      style={{ marginTop: 12, background: '#fafafa' }}
                      title={<span style={{ fontSize: 12 }}>分析详情</span>}
                    >
                      <div style={{ fontSize: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                          <strong>工具轨显著基因 ({selectedHistoryResult.tool_result?.significant_genes?.length || 0} 个):</strong>
                          <div style={{ marginTop: 4, color: '#52c41a', fontSize: 11 }}>
                            {selectedHistoryResult.tool_result?.significant_genes?.map((g: any) => g.gene_id).join(', ') || '无'}
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <strong>LLM轨显著基因 ({selectedHistoryResult.llm_result?.significant_genes?.length || 0} 个):</strong>
                          <div style={{ marginTop: 4, color: '#1890ff', fontSize: 11 }}>
                            {selectedHistoryResult.llm_result?.significant_genes?.map((g: any) => g.gene_id).join(', ') || '无'}
                          </div>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <strong>一致性分析:</strong>
                          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Tag color="green">共同检出 {selectedHistoryResult.consistency?.overlap?.length || 0} 个</Tag>
                            <Tag color="orange">仅工具 {selectedHistoryResult.consistency?.tool_only?.length || 0} 个</Tag>
                            <Tag color="blue">仅LLM {selectedHistoryResult.consistency?.llm_only?.length || 0} 个</Tag>
                          </div>
                          {selectedHistoryResult.consistency?.overlap?.length > 0 && (
                            <div style={{ marginTop: 4, fontSize: 11, color: '#52c41a' }}>
                              共同: {selectedHistoryResult.consistency.overlap.join(', ')}
                            </div>
                          )}
                          {selectedHistoryResult.consistency?.tool_only?.length > 0 && (
                            <div style={{ marginTop: 2, fontSize: 11, color: '#fa8c16' }}>
                              仅工具: {selectedHistoryResult.consistency.tool_only.join(', ')}
                            </div>
                          )}
                          {selectedHistoryResult.consistency?.llm_only?.length > 0 && (
                            <div style={{ marginTop: 2, fontSize: 11, color: '#1890ff' }}>
                              仅LLM: {selectedHistoryResult.consistency.llm_only.join(', ')}
                            </div>
                          )}
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <strong>反馈详情 ({selectedHistoryFeedbacks.length} 条):</strong>
                          {selectedHistoryFeedbacks.length > 0 ? (
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {selectedHistoryFeedbacks.map((fb: Feedback) => (
                                <div key={fb.id} style={{
                                  padding: '6px 8px',
                                  background: fb.rating === 'positive' ? 'rgba(82,196,26,0.1)' : 'rgba(255,0,0,0.05)',
                                  borderRadius: 4,
                                  borderLeft: `3px solid ${fb.rating === 'positive' ? '#52c41a' : '#ff4d4f'}`
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Tag color={fb.track === 'tool' ? 'green' : 'blue'} style={{ margin: 0 }}>
                                      {fb.track === 'tool' ? '工具轨' : 'LLM轨'}
                                    </Tag>
                                    <Tag color={fb.rating === 'positive' ? 'success' : 'error'} style={{ margin: 0 }}>
                                      {fb.rating === 'positive' ? '✓ 正面' : '✗ 负面'}
                                    </Tag>
                                  </div>
                                  {fb.comment && (
                                    <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>{fb.comment}</div>
                                  )}
                                  {fb.gene_ids && fb.gene_ids.length > 0 && (
                                    <div style={{ marginTop: 2, fontSize: 10, color: '#999' }}>
                                      涉及基因: {fb.gene_ids.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ marginTop: 4, color: '#999', fontSize: 11 }}>暂无反馈</div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )}
                  {loadingHistoryDetail && <Spin style={{ marginTop: 8 }} />}
                </div>
              )}
            </div>
          )}
        </Drawer>
      </div>

      <style>{`
        .ontology-node:hover {
          z-index: 1000;
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15), 0 3px 10px rgba(0,0,0,0.1);
        }
        .react-flow__node {
          transition: transform 0.2s ease;
        }
        .react-flow__edge-path {
          stroke-linecap: round;
        }
        .react-flow__controls button {
          background: var(--color-bg-card) !important;
          border-color: var(--color-border) !important;
          color: var(--color-text-primary) !important;
        }
        .react-flow__controls button:hover {
          background: var(--color-bg-input) !important;
        }
        .react-flow__minimap {
          border-radius: 8px;
        }
      `}</style>
    </Modal>
  )
}
