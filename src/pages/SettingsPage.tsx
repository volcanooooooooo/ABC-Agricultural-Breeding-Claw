import { useState, useEffect, useCallback } from 'react'
import { Card, Form, Input, Select, Button, Space, message, Divider, Tabs } from 'antd'
import { SaveOutlined, KeyOutlined, GlobalOutlined, BgColorsOutlined } from '@ant-design/icons'
import { settingsApi } from '../api/client'

export default function SettingsPage() {
  const [form] = Form.useForm()
  const [, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await settingsApi.get()
      form.setFieldsValue(response.data.data)
    } catch (error) {
      // Use default values
      form.setFieldsValue({
        llm_provider: 'qwen',
        theme: 'light',
        language: 'zh-CN',
      })
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Save settings
  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await settingsApi.update(values)
      message.success('设置保存成功')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const tabItems = [
    {
      key: 'llm',
      label: (
        <span>
          <KeyOutlined />
          LLM 设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="llm_provider"
            label="LLM 提供商"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="qwen">千问 (Qwen)</Select.Option>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="llm_api_key"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>

          <Form.Item name="llm_model" label="模型名称">
            <Input placeholder="如: qwen-turbo, gpt-4 等" />
          </Form.Item>

          <Form.Item name="llm_temperature" label="温度参数">
            <Input type="number" step="0.1" min="0" max="2" placeholder="0.7" />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'appearance',
      label: (
        <span>
          <BgColorsOutlined />
          外观
        </span>
      ),
      children: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="theme"
            label="主题"
            valuePropName="checked"
          >
            <Select>
              <Select.Option value="light">浅色</Select.Option>
              <Select.Option value="dark">深色</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="font_size" label="字体大小">
            <Select>
              <Select.Option value="small">小</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="large">大</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'language',
      label: (
        <span>
          <GlobalOutlined />
          语言
        </span>
      ),
      children: (
        <Form form={form} layout="vertical">
          <Form.Item
            name="language"
            label="界面语言"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="zh-CN">简体中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="date_format" label="日期格式">
            <Select>
              <Select.Option value="YYYY-MM-DD">YYYY-MM-DD</Select.Option>
              <Select.Option value="DD/MM/YYYY">DD/MM/YYYY</Select.Option>
              <Select.Option value="MM/DD/YYYY">MM/DD/YYYY</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 800 }}>
      <h2>系统设置</h2>

      <Card>
        <Tabs items={tabItems} />

        <Divider />

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存设置
          </Button>
          <Button onClick={() => form.resetFields()}>
            重置
          </Button>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <h3>关于</h3>
        <p>育种 AI 科学家系统 v1.0.0</p>
        <p style={{ color: '#666' }}>
          本系统通过自然语言交互，帮助育种研究人员完成论文研读、自动化数据分析和本体可视化等任务。
        </p>
      </Card>
    </div>
  )
}
