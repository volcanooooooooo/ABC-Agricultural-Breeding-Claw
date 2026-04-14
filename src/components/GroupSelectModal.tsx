import React, { useState } from 'react'
import { Modal, Transfer, Input, message } from 'antd'

interface GroupSelectModalProps {
  open: boolean
  columns: string[]
  onConfirm: (groups: Record<string, string[]>) => void
  onCancel: () => void
}

export function GroupSelectModal({ open, columns, onConfirm, onCancel }: GroupSelectModalProps) {
  const [controlKeys, setControlKeys] = useState<string[]>([])
  const [controlName, setControlName] = useState('control')
  const [treatmentName, setTreatmentName] = useState('treatment')

  const dataSource = columns.map(col => ({ key: col, title: col }))

  const handleConfirm = () => {
    const controlCols = controlKeys
    const treatmentCols = columns.filter(c => !controlKeys.includes(c))

    if (controlCols.length < 2) {
      message.error('对照组至少需要 2 个样本')
      return
    }
    if (treatmentCols.length < 2) {
      message.error('处理组至少需要 2 个样本')
      return
    }
    if (!controlName.trim() || !treatmentName.trim()) {
      message.error('请输入分组名称')
      return
    }

    onConfirm({
      [controlName.trim()]: controlCols,
      [treatmentName.trim()]: treatmentCols,
    })
  }

  return (
    <Modal
      title="选择分组"
      open={open}
      onOk={handleConfirm}
      onCancel={onCancel}
      width={680}
      okText="确认分组并开始分析"
      cancelText="取消"
      styles={{ body: { paddingTop: 16 } }}
    >
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        无法自动识别分组，请将样本列分配到对照组和处理组：
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-muted)' }}>对照组名称</div>
          <Input value={controlName} onChange={e => setControlName(e.target.value)} size="small" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-muted)' }}>处理组名称</div>
          <Input value={treatmentName} onChange={e => setTreatmentName(e.target.value)} size="small" />
        </div>
      </div>

      <Transfer
        dataSource={dataSource}
        titles={['处理组 (未选中)', '对照组']}
        targetKeys={controlKeys}
        onChange={(targetKeys) => setControlKeys(targetKeys.map(String))}
        render={item => item.title}
        listStyle={{ width: 280, height: 320 }}
        locale={{
          itemUnit: '列',
          itemsUnit: '列',
          searchPlaceholder: '搜索样本列',
        }}
        showSearch
      />
    </Modal>
  )
}
