import { useState, useEffect } from 'react'
import { Modal, Tag, Divider, message, Spin } from 'antd'
import { NodeIndexOutlined, ArrowRightOutlined, ThunderboltOutlined, RobotOutlined } from '@ant-design/icons'
import { OntologyNode, ontologyApi } from '../api/client'

interface GeneInfoPanelProps {
  geneId: string
  open: boolean
  onClose: () => void
  onViewDetails: (nodeId: string) => void  // 点击查看详情时的回调
}

interface OntologyNodeData {
  id: string
  type: string
  name: string
  properties?: Record<string, any>
}

export function GeneInfoPanel({ geneId, open, onClose, onViewDetails }: GeneInfoPanelProps) {
  const [loading, setLoading] = useState(false)
  const [geneNode, setGeneNode] = useState<OntologyNodeData | null>(null)
  const [geneRelations, setGeneRelations] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] })

  useEffect(() => {
    if (open && geneId) {
      loadGeneInfo()
    }
  }, [open, geneId])

  const loadGeneInfo = async () => {
    setLoading(true)
    try {
      // 搜索该基因节点
      const searchRes = await ontologyApi.searchNodes(geneId)
      const nodes = searchRes.data?.items || []
      const matchedNode = nodes.find((n: OntologyNode) =>
        n.name.toLowerCase().includes(geneId.toLowerCase()) ||
        n.id.toLowerCase().includes(geneId.toLowerCase())
      )

      if (matchedNode) {
        setGeneNode(matchedNode)
        // 获取关联关系
        try {
          const relRes = await ontologyApi.getNodeRelations(matchedNode.id)
          setGeneRelations(relRes.data || { incoming: [], outgoing: [] })
        } catch {
          setGeneRelations({ incoming: [], outgoing: [] })
        }
      } else {
        setGeneNode(null)
      }
    } catch (e) {
      console.error('Failed to load gene info:', e)
      message.error('加载基因信息失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = () => {
    if (geneNode) {
      onViewDetails(geneNode.id)
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            border: '1px solid #ffa726',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <NodeIndexOutlined style={{ color: '#e65100', fontSize: 16 }} />
          </div>
          <span style={{ fontWeight: 600 }}>{geneId}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
          <div style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>正在加载...</div>
        </div>
      ) : geneNode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 基本信息卡片 */}
          <div style={{
            padding: 14,
            background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
            borderRadius: 10,
            border: '1px solid #ffa726',
          }}>
            <div style={{ fontSize: 11, color: '#e65100', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              {geneNode.type}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 2 }}>
              {geneNode.name}
            </div>
            <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>
              ID: {geneNode.id}
            </div>
          </div>

          {/* 属性信息 */}
          {geneNode.properties && Object.keys(geneNode.properties).length > 0 && (
            <div style={{
              padding: 12,
              background: 'var(--color-bg-input)',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 8, fontWeight: 500 }}>属性信息</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {Object.entries(geneNode.properties).slice(0, 3).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{key}: </span>
                    <span>{String(value).substring(0, 50)}{String(value).length > 50 ? '...' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 关联关系摘要 */}
          <div style={{
            padding: 12,
            background: 'var(--color-bg-input)',
            borderRadius: 8,
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--color-accent)', marginBottom: 8, fontWeight: 500 }}>关联关系</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>入边: </span>
                <span style={{ fontWeight: 500 }}>{geneRelations.incoming.length}</span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>出边: </span>
                <span style={{ fontWeight: 500 }}>{geneRelations.outgoing.length}</span>
              </div>
            </div>
          </div>

          {/* 查看详情按钮 */}
          <div
            onClick={handleViewDetails}
            style={{
              padding: '10px 16px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-accent)',
              borderRadius: 8,
              color: 'var(--color-accent)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-accent)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-card)'
              e.currentTarget.style.color = 'var(--color-accent)'
            }}
          >
            <ArrowRightOutlined style={{ fontSize: 12 }} />
            在知识本体库中查看详情
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)' }}>
          未在知识本体中找到该基因
        </div>
      )}
    </Modal>
  )
}
