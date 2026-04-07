import { useState, useCallback, useEffect, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, NodeTypes, Handle, Position, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, Button, Input, Select, Space, Tag, message, Drawer, Descriptions, Tooltip } from 'antd'
import { SearchOutlined, ReloadOutlined, ApiOutlined, NodeIndexOutlined, ArrowRightOutlined, DatabaseOutlined, ExperimentOutlined, AuditOutlined, CheckCircleOutlined, BuildOutlined, FileTextOutlined, AlertOutlined } from '@ant-design/icons'
import { ontologyApi, OntologyNode, OntologyEdge, OntologyGraph, OntologyNodeType } from '../api/client'

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
  // 旧类型兼容
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
      {/* 隐藏的 handles */}
      <Handle type="target" position={Position.Left} id="in" style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ opacity: 0, width: 8, height: 8 }} />

      {/* 类型标签 */}
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

      {/* 节点名称 */}
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

const edgeType = 'default'

export default function OntologyPage() {
  const [graph, setGraph] = useState<OntologyGraph | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined)
  const [searchText, setSearchText] = useState('')
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)

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
    loadGraph()
  }, [loadGraph])

  // 根据过滤条件构建节点和边
  useEffect(() => {
    if (!graph) return

    let filteredNodes = graph.nodes
    let filteredEdges = graph.edges

    // 按类型过滤
    if (selectedType) {
      filteredNodes = filteredNodes.filter(n => n.type === selectedType)
    }

    // 按搜索文本过滤
    if (searchText.trim()) {
      const kw = searchText.toLowerCase()
      filteredNodes = filteredNodes.filter(n =>
        n.name.toLowerCase().includes(kw) ||
        n.id.toLowerCase().includes(kw)
      )
    }

    // 过滤只与可见节点相连的边
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    filteredEdges = filteredEdges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    )

    // 为不同类型分配不同层级
    const typeOrder: OntologyNodeType[] = ['Dataset', 'Sample', 'Measurement', 'Gene', 'ProcessStep', 'Tool', 'Result', 'Conclusion']

    // 按类型分组计算位置
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
      type: edgeType,
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
  const [nodeRelations, setNodeRelations] = useState<{ incoming: OntologyEdge[]; outgoing: OntologyEdge[] }>({ incoming: [], outgoing: [] })

  useEffect(() => {
    if (!selectedNode) return
    ontologyApi.getNodeRelations(selectedNode.id)
      .then(res => setNodeRelations(res.data))
      .catch(() => setNodeRelations({ incoming: [], outgoing: [] }))
  }, [selectedNode])

  // 获取关联节点的名称
  const getNodeName = (nodeId: string) => {
    return graph?.nodes.find(n => n.id === nodeId)?.name || nodeId
  }

  const totalNodes = graph?.nodes.length || 0
  const totalEdges = graph?.edges.length || 0

  return (
    <div style={{
      height: 'calc(100vh - 80px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-bg-dark)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        padding: '24px 28px 0',
        position: 'relative',
        zIndex: 10,
      }}>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 8,
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px var(--color-accent-glow)',
            }}>
              <ApiOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                letterSpacing: '0.5px',
              }}>
                知识本体
              </h2>
              <p style={{
                margin: '4px 0 0',
                fontSize: 12,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.3px',
              }}>
                Knowledge Ontology Graph
              </p>
            </div>
          </div>
        </div>

        {/* 统计概览 */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 4,
        }}>
          <div style={{
            padding: '8px 16px',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'JetBrains Mono, monospace' }}>{totalNodes}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>节点</div>
          </div>
          <div style={{
            padding: '8px 16px',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-gold)', fontFamily: 'JetBrains Mono, monospace' }}>{totalEdges}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>边</div>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '0 28px',
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}>
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
              borderRadius: 10,
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
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadGraph}
            loading={loading}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
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
        margin: '0 28px 24px',
        background: 'var(--color-bg-card)',
        borderRadius: 16,
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'var(--shadow-card)',
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
              borderRadius: 10,
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
              borderRadius: 10,
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
        </ReactFlowProvider>

        {/* 加载状态 */}
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
              padding: '20px 40px',
              background: 'var(--color-bg-card)',
              borderRadius: 12,
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              boxShadow: 'var(--shadow-card)',
            }}>
              正在加载图谱数据...
            </div>
          </div>
        )}

        {/* 空状态 */}
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
        position: 'absolute',
        bottom: 90,
        left: 28,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        maxWidth: 600,
        padding: '12px 16px',
        background: 'var(--color-bg-card)',
        borderRadius: 10,
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {nodeStats.map(({ type, count }) => {
          const colors = TYPE_COLORS[type] || { border: '#9e9e9e', text: '#616161', tag: '#9e9e9e' }
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
        width={420}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        styles={{
          header: { background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' },
          body: { background: 'var(--color-bg-dark)', padding: 20 },
          content: { background: 'var(--color-bg-card)' },
        }}
      >
        {selectedNode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 节点主信息卡片 */}
            <div style={{
              padding: 20,
              background: selectedNode ? TYPE_COLORS[selectedNode.type]?.bg : 'var(--color-bg-input)',
              borderRadius: 12,
              border: `1px solid ${TYPE_COLORS[selectedNode.type]?.border || 'var(--color-border)'}`,
            }}>
              <div style={{ fontSize: 10, color: TYPE_COLORS[selectedNode.type]?.text, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                {selectedNode.type}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                {selectedNode.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                ID: {selectedNode.id}
              </div>
            </div>

            {/* 属性信息 */}
            {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
              <div style={{
                padding: 16,
                background: 'var(--color-bg-card)',
                borderRadius: 10,
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 12, fontWeight: 500 }}>属性信息</div>
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

            {/* 关联信息 */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 12, fontWeight: 500 }}>关联关系</div>

              {nodeRelations.incoming.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
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
                <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                  暂无关联关系
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* 全局样式 */}
      <style>{`
        .ontology-node:hover {
          z-index: 1000;
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15), 0 3px 10px rgba(0,0,0,0.1);
        }

        /* React Flow 样式覆盖 */
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
          border-radius: 10px;
        }

        /* 输入框样式覆盖 */
        .ant-input {
          background: var(--color-bg-input) !important;
          border-color: var(--color-border) !important;
          color: var(--color-text-primary) !important;
        }

        .ant-input::placeholder {
          color: var(--color-text-muted) !important;
        }

        .ant-input:focus {
          border-color: var(--color-accent) !important;
          box-shadow: 0 0 0 2px var(--color-accent-glow) !important;
        }

        .ant-select-selector {
          background: var(--color-bg-input) !important;
          border-color: var(--color-border) !important;
        }

        .ant-select-selection-placeholder {
          color: var(--color-text-muted) !important;
        }

        .ant-select-dropdown {
          background: var(--color-bg-card) !important;
          border: 1px solid var(--color-border) !important;
        }

        .ant-select-item {
          color: var(--color-text-primary) !important;
        }

        .ant-select-item-option-active {
          background: var(--color-bg-input) !important;
        }

        .ant-select-item-option-selected {
          background: var(--color-accent-glow) !important;
        }
      `}</style>
    </div>
  )
}
