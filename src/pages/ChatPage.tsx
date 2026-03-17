import { useState, useRef, useEffect } from 'react'
import { Input, Button, List, Avatar, Spin, Empty, Card } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, DeleteOutlined } from '@ant-design/icons'
import { chatApi, Message } from '../api/client'

const { TextArea } = Input

interface ChatMessage extends Message {
  isLoading?: boolean
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // Add a placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isLoading: true,
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await chatApi.sendMessage({ message: userMessage.content })
      const assistantContent = response.data.data.response

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: assistantContent, isLoading: false }
            : msg
        )
      )
    } catch (error) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: '抱歉，发生了一些错误，请稍后重试。', isLoading: false }
            : msg
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>AI 对话</h2>
        {messages.length > 0 && (
          <Button icon={<DeleteOutlined />} onClick={handleClear}>
            清空对话
          </Button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', marginBottom: 16, minHeight: 400 }}>
        {messages.length === 0 ? (
          <Empty
            description="开始与 AI 育种科学家对话"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item style={{ border: 'none', padding: '8px 0' }}>
                <Card
                  size="small"
                  style={{
                    width: '85%',
                    background: item.role === 'user' ? '#e6f7ff' : '#f5f5f5',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Avatar
                      icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      style={{
                        backgroundColor: item.role === 'user' ? '#1890ff' : '#52c41a',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        {item.role === 'user' ? '你' : 'AI 科学家'}
                      </div>
                      {item.isLoading ? (
                        <Spin size="small" />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
                      )}
                    </div>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="输入你的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          style={{ height: 'auto' }}
        >
          发送
        </Button>
      </div>
    </div>
  )
}
