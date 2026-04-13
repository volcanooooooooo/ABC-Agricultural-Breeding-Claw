import { useState, useEffect } from 'react'
import { Modal, Tag, Spin, Button, Typography, Divider } from 'antd'
import { LinkOutlined, ReloadOutlined } from '@ant-design/icons'

const { Text } = Typography

interface KeggPathwayModalProps {
  open: boolean
  onClose: () => void
  pathwayId: string
  pathwayName: string
  genes: string[]
}

export function KeggPathwayModal({ open, onClose, pathwayId, pathwayName, genes }: KeggPathwayModalProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (open) {
      setImageLoading(true)
      setImageError(false)
    }
  }, [open, pathwayId])

  const imageSrc = `/api/analysis/kegg-image/${pathwayId}?_r=${retryKey}`
  const keggWebUrl = `https://www.kegg.jp/pathway/${pathwayId}`

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{pathwayName}</span>
          <Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{pathwayId}</Tag>
        </div>
      }
      styles={{ body: { padding: '16px 24px' } }}
    >
      {/* 外链按钮 */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="link"
          icon={<LinkOutlined />}
          href={keggWebUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13 }}
        >
          在 KEGG 网站查看
        </Button>
      </div>

      {/* 通路图 */}
      <div style={{
        border: '1px solid var(--color-border, #333)',
        borderRadius: 8,
        overflow: 'auto',
        maxHeight: '60vh',
        background: '#fff',
        position: 'relative',
        minHeight: 200,
      }}>
        {imageLoading && !imageError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}>
            <Spin size="large" tip="正在加载通路图..." />
          </div>
        )}

        {imageError ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            gap: 12,
          }}>
            <Text type="secondary">通路图加载失败</Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setImageError(false)
                setImageLoading(true)
                setRetryKey(k => k + 1)
              }}
            >
              重试
            </Button>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={pathwayName}
            style={{ display: imageLoading ? 'none' : 'block' }}
            onLoad={() => setImageLoading(false)}
            onError={() => { setImageLoading(false); setImageError(true) }}
          />
        )}
      </div>

      {/* 富集基因列表 */}
      {genes.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div>
            <Text style={{ fontSize: 12, color: 'var(--color-text-muted, #888)' }}>
              富集基因（{genes.length} 个）
            </Text>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {genes.map(g => (
                <Tag key={g} color="blue" style={{ marginBottom: 4 }}>{g}</Tag>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
