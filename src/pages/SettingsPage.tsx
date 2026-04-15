import { useState, useEffect, useCallback } from 'react'
import { Card, Form, Input, Select, Button, Space, message, Divider, Tabs, Tag } from 'antd'
import { SaveOutlined, KeyOutlined, GlobalOutlined, BgColorsOutlined, CheckCircleOutlined, ExperimentOutlined } from '@ant-design/icons'
import { settingsApi } from '../api/client'

export default function SettingsPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

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
        theme: 'dark',
        language: 'zh-CN',
      })
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      await settingsApi.update(values)
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await settingsApi.testConnection()
      if (response.data.data.success) {
        message.success('连接测试成功')
      } else {
        message.error(`连接失败: ${response.data.data.message}`)
      }
    } catch (error: any) {
      message.error(`连接失败: ${error.response?.data?.message || error.message}`)
    } finally {
      setTesting(false)
    }
  }

  const llmProviderItems = [
    {
      key: '1',
      label: (
        <span>
          <KeyOutlined /> LLM 配置
        </span>
      ),
      children: (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            llm_provider: 'qwen',
          }}
        >
          <Form.Item
            name="llm_provider"
            label="模型提供商"
            rules={[{ required: true }]}
          >
            <Select>
              <Select.Option value="qwen">
                <Space>
                  <span>千问 (Qwen)</span>
                  <Tag color="blue">推荐</Tag>
                </Space>
              </Select.Option>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="anthropic">Anthropic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="llm_api_key"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="输入 API Key" />
          </Form.Item>

          <Form.Item name="llm_model" label="模型">
            <Select>
              <Select.Option value="qwen-turbo">Qwen Turbo (快速)</Select.Option>
              <Select.Option value="qwen-plus">Qwen Plus (标准)</Select.Option>
              <Select.Option value="qwen-max">Qwen Max (最强)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="llm_temperature" label="Temperature (0-1)">
            <Input type="number" min={0} max={1} step={0.1} />
          </Form.Item>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                style={{
                  background: 'var(--gradient-accent)',
                  border: 'none',
                }}
              >
                保存配置
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handleTest}
                loading={testing}
                style={{ background: 'transparent', border: '1px solid var(--color-border)' }}
              >
                测试连接
              </Button>
            </Space>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <BgColorsOutlined /> 外观
        </span>
      ),
      children: (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            theme: 'dark',
            language: 'zh-CN',
          }}
        >
          <Form.Item name="theme" label="主题">
            <Select>
              <Select.Option value="dark">
                <Space>
                  <BgColorsOutlined /> 深色主题
                </Space>
              </Select.Option>
              <Select.Option value="light">浅色主题</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="language" label="语言">
            <Select>
              <Select.Option value="zh-CN">
                <Space>
                  <GlobalOutlined /> 简体中文
                </Space>
              </Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              style={{
                background: 'var(--gradient-accent)',
                border: 'none',
              }}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <ExperimentOutlined /> 关于
        </span>
      ),
      children: (
        <div>
          <Card style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: 12 }}>ABC: Agricultural Breeding Claw</h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>版本: 1.0.0</p>
            <p style={{ color: 'var(--color-text-secondary)' }}>基于 AI 的农业育种智能助手系统</p>
          </Card>
          <Card style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 12 }}>技术栈</h4>
            <ul style={{ color: 'var(--color-text-secondary)', paddingLeft: 20 }}>
              <li>前端: React + TypeScript + Vite</li>
              <li>UI: Ant Design + Recharts + React Flow</li>
              <li>后端: FastAPI + LangChain</li>
              <li>LLM: 千问 (Qwen)</li>
            </ul>
          </Card>
        </div>
      ),
    },
  ]

  return (
    <div>
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
            <BgColorsOutlined style={{ color: 'var(--color-accent)' }} />
            系统设置
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            配置系统参数
          </p>
        </div>
      </div>

      <Card
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <Tabs items={llmProviderItems} />
      </Card>
    </div>
  )
}
