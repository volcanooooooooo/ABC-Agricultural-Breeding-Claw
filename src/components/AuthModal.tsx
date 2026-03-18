import { useState } from 'react'
import { Modal, Tabs, Form, Input, Button, message, Avatar } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, UserAddOutlined, LoginOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values)
      message.success('登录成功')
      onClose()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: { username: string; password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次密码输入不一致')
      return
    }
    setLoading(true)
    try {
      await register({ username: values.username, password: values.password })
      message.success('注册成功')
      onClose()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={400}
      className="auth-modal"
      styles={{
        mask: { background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' },
        content: { background: 'var(--color-bg-card)', borderRadius: 16, padding: 0 },
        header: { background: 'transparent', borderBottom: 'none' },
        body: { padding: '24px 32px 32px' },
        closeIcon: { color: 'var(--color-text-muted)' }
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--gradient-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
        }}>
          <UserOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4 }}>
          {activeTab === 'login' ? '欢迎回来' : '创建账号'}
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          {activeTab === 'login' ? '登录以继续使用天枢系统' : '注册成为天枢系统用户'}
        </p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        centered
        items={[
          {
            key: 'login',
            label: (
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                <LoginOutlined style={{ marginRight: 6 }} />
                登录
              </span>
            ),
          },
          {
            key: 'register',
            label: (
              <span style={{ fontSize: 15, fontWeight: 500 }}>
                <UserAddOutlined style={{ marginRight: 6 }} />
                注册
              </span>
            ),
          },
        ]}
      />

      {activeTab === 'login' ? (
        <Form onFinish={handleLogin} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="用户名"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="密码"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                borderRadius: 10,
                background: 'var(--gradient-accent)',
                border: 'none',
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <Form onFinish={handleRegister} layout="vertical" size="large">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="用户名（至少3个字符）"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="密码（至少6个字符）"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次密码输入不一致'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--color-text-muted)' }} />}
              placeholder="确认密码"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                borderRadius: 10,
                background: 'var(--gradient-accent)',
                border: 'none',
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              注册并登录
            </Button>
          </Form.Item>
        </Form>
      )}
    </Modal>
  )
}
