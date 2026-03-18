import React, { useState, useRef, useEffect, Fragment } from 'react'
import { Input, Button, List, Avatar, Spin, Card, Row, Col, Tag, Table, Progress, message, Layout, Dropdown, Space, Modal, Radio } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, DeleteOutlined, PlusOutlined, MessageOutlined, FileOutlined, ArrowRightOutlined, LogoutOutlined, SettingOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { chatApi, analysisApi, datasetApi, Message, AnalysisResult, Dataset, GeneInfo } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import { AnalysisProgress } from '../components/AnalysisProgress'
import { DualTrackResultCard } from '../components/DualTrackResultCard'
import { FeedbackHintBanner } from '../components/FeedbackHintBanner'
import { useSSE } from '../hooks/useSSE'

const { TextArea } = Input
const { Sider, Content } = Layout

interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result'
  progress?: { track: 'tool' | 'llm'; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
}

interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
}

export default function ChatPage() {
  const { user, isAuthenticated, logout } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  // 数据集选择弹窗
  const [datasetModalOpen, setDatasetModalOpen] = useState(false)
  const [pendingAnalysisMsg, setPendingAnalysisMsg] = useState<string>('')
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentSession = sessions.find(s => s.id === currentSessionId) || null
  const hasMessages = currentSession && currentSession.messages.length > 0

  // 从 localStorage 加载会话
  useEffect(() => {
    const saved = localStorage.getItem('chat_sessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          setSessions(parsed)
          setCurrentSessionId(parsed[0].id)
        } else {
          createNewSession()
        }
      } catch {
        createNewSession()
      }
    } else {
      createNewSession()
    }
    loadDatasets()
  }, [])

  // 保存会话到 localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chat_sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  // 加载数据集
  const loadDatasets = async () => {
    try {
      const res = await datasetApi.getAll()
      const apiDatasets = res?.data?.data || []

      // 如果没有数据集，添加示例数据
      if (apiDatasets.length === 0) {
        setDatasets([
          { id: 'ds_rice_20240306', name: '水稻3月6日表达数据', description: '水稻基因表达矩阵 - 3月6日实验', data_type: 'expression_matrix', file_path: '', gene_count: 5000, sample_count: 6, groups: { control: ['C1', 'C2', 'C3'], treatment: ['T1', 'T2', 'T3'] }, created_at: '2024-03-06', updated_at: '2024-03-06' },
          { id: 'ds_mouse_20240310', name: '小鼠RNA-seq数据', description: '小鼠肝组织RNA测序数据', data_type: 'expression_matrix', file_path: '', gene_count: 15000, sample_count: 8, groups: { control: ['WT1', 'WT2', 'WT3', 'WT4'], treatment: ['KO1', 'KO2', 'KO3', 'KO4'] }, created_at: '2024-03-10', updated_at: '2024-03-10' },
          { id: 'ds_arabidopsis_20240315', name: '拟南芥叶片数据', description: '拟南芥干旱胁迫实验', data_type: 'expression_matrix', file_path: '', gene_count: 8000, sample_count: 6, groups: { control: ['N1', 'N2', 'N3'], treatment: ['D1', 'D2', 'D3'] }, created_at: '2024-03-15', updated_at: '2024-03-15' },
        ])
      } else {
        setDatasets(apiDatasets)
      }
    } catch (e) {
      console.error(e)
      // 即使出错也设置示例数据
      setDatasets([
        { id: 'ds_rice_20240306', name: '水稻3月6日表达数据', description: '水稻基因表达矩阵 - 3月6日实验', data_type: 'expression_matrix', file_path: '', gene_count: 5000, sample_count: 6, groups: { control: ['C1', 'C2', 'C3'], treatment: ['T1', 'T2', 'T3'] }, created_at: '2024-03-06', updated_at: '2024-03-06' },
        { id: 'ds_mouse_20240310', name: '小鼠RNA-seq数据', description: '小鼠肝组织RNA测序数据', data_type: 'expression_matrix', file_path: '', gene_count: 15000, sample_count: 8, groups: { control: ['WT1', 'WT2', 'WT3', 'WT4'], treatment: ['KO1', 'KO2', 'KO3', 'KO4'] }, created_at: '2024-03-10', updated_at: '2024-03-10' },
        { id: 'ds_arabidopsis_20240315', name: '拟南芥叶片数据', description: '拟南芥干旱胁迫实验', data_type: 'expression_matrix', file_path: '', gene_count: 8000, sample_count: 6, groups: { control: ['N1', 'N2', 'N3'], treatment: ['D1', 'D2', 'D3'] }, created_at: '2024-03-15', updated_at: '2024-03-15' },
      ])
    }
  }

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom()
    }
  }, [currentSession?.messages, isAtBottom])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
    setIsAtBottom(isAtBottom)
  }

  // 创建新会话
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date().toString()
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
  }

  // 更新当前会话
  const updateCurrentSession = (updater: (msgs: ChatMessage[]) => ChatMessage[]) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const newMessages = updater(s.messages)
        const firstUserMsg = newMessages.find(m => m.role === 'user')
        const title = firstUserMsg ? (firstUserMsg.content.substring(0, 25) + (firstUserMsg.content.length > 25 ? '...' : '')) : '新对话'
        return { ...s, messages: newMessages, title }
      }
      return s
    }))
  }

  // 识别分析意图
  const detectAnalysisIntent = (text: string): boolean => {
    const keywords = ['分析', '差异', '对比', '双轨', 'tool', 'llm', 'deseq', 't检验', '表达']
    return keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !currentSessionId) return

    // 检查是否是分析意图
    if (detectAnalysisIntent(input) && datasets.length > 0) {
      // 显示数据集选择弹窗
      setPendingAnalysisMsg(input.trim())
      setDatasetModalOpen(true)
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toString(),
    }

    updateCurrentSession(msgs => [...msgs, userMessage])
    setInput('')
    setLoading(true)
    setIsAtBottom(true)
    await handleNormalChat(userMessage)
    setLoading(false)
  }

  // 确认选择数据集后开始分析
  const handleDatasetSelect = async (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId)
    if (!dataset) return

    setDatasetModalOpen(false)

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: pendingAnalysisMsg,
      timestamp: new Date().toString(),
    }

    // 添加系统消息
    updateCurrentSession(msgs => [
      ...msgs,
      userMessage,
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `已选择数据集「${dataset.name}」，正在开始双轨差异分析...\n\n📊 数据概览：\n- 基因数量: ${dataset.gene_count}\n- 样本数量: ${dataset.sample_count}\n- 对照组: ${dataset.groups?.control?.join(', ') || 'control'}\n- 处理组: ${dataset.groups?.treatment?.join(', ') || 'treatment'}`,
        timestamp: new Date().toString(),
      }
    ])

    setInput('')
    setLoading(true)
    setIsAtBottom(true)
    setAnalysisStartTime(Date.now())

    // 调用分析API
    await handleAnalysisRequest(pendingAnalysisMsg, dataset)
    setLoading(false)
    setPendingAnalysisMsg('')
  }

  // 普通对话
  const handleNormalChat = async (userMessage: ChatMessage) => {
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toString(),
      isLoading: true,
    }
    updateCurrentSession(msgs => [...msgs, assistantMessage])

    try {
      const response = await chatApi.sendMessage({ message: userMessage.content })
      const assistantContent = (response.data as any).content || (response.data as any).response
      updateCurrentSession(msgs =>
        msgs.map(msg => msg.id === assistantMessage.id ? { ...msg, content: assistantContent, isLoading: false } : msg)
      )
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMsg = error.response?.data?.detail || error.message || '未知错误'
      updateCurrentSession(msgs =>
        msgs.map(msg => msg.id === assistantMessage.id ? { ...msg, content: `抱歉，发生了一些错误：${errorMsg}`, isLoading: false } : msg)
      )
    }
  }

  // 分析请求
  const handleAnalysisRequest = async (userMessageContent: string, selectedDataset?: Dataset) => {
    const dataset = selectedDataset || datasets[0]
    if (!dataset) {
      updateCurrentSession(msgs => [...msgs, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '请先上传表达矩阵数据集再进行分析。',
        timestamp: new Date().toString(),
      }])
      return
    }

    const progressMsgId = (Date.now() + 2).toString()
    updateCurrentSession(msgs => [...msgs, {
      id: progressMsgId,
      role: 'assistant',
      content: '',
      type: 'progress',
      progress: { track: 'tool', status: '正在解析数据...', progress: 5, currentStep: '初始化分析任务', elapsedTime: 0 },
      timestamp: new Date().toString(),
    }])

    try {
      const compareRes = await analysisApi.compare({
        dataset_id: dataset.id,
        group_control: 'control',
        group_treatment: 'treatment',
      })
      const { job_id } = compareRes.data.data
      const startTime = Date.now()

      const eventSource = new EventSource(`/api/analysis/stream/${job_id}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const elapsedTime = (Date.now() - startTime) / 1000

        if (data.result) {
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, type: 'result', analysisResult: data.result, progress: undefined as any }
                : msg
            )
          )
          eventSource.close()
        } else if (data.status === 'error') {
          message.error(data.message || '分析失败')
          eventSource.close()
        } else if (data.progress !== undefined) {
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, progress: { track: data.track || '', status: data.status, progress: data.progress, currentStep: data.currentStep, elapsedTime } }
                : msg
            )
          )
        }
      }

      eventSource.onerror = () => {
        message.error('连接中断')
        eventSource.close()
      }
    } catch (error: any) {
      updateCurrentSession(msgs => [...msgs, {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `分析失败: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date().toString(),
      }])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 删除会话
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSessions = sessions.filter(s => s.id !== sessionId)
    setSessions(newSessions)
    if (sessionId === currentSessionId) {
      if (newSessions.length > 0) setCurrentSessionId(newSessions[0].id)
      else createNewSession()
    }
  }

  // 渲染分析结果
  const renderAnalysisCard = (result: AnalysisResult) => {
    const toolColumns = [
      { title: '基因', dataIndex: 'gene_id', key: 'gene_id' },
      { title: '变化', dataIndex: 'expression_change', key: 'expression_change', render: (val: string) => <Tag color={val === 'up' ? 'red' : val === 'down' ? 'blue' : 'default'}>{val === 'up' ? '上调' : val === 'down' ? '下调' : '无'}</Tag> },
      { title: 'log2FC', dataIndex: 'log2fc', key: 'log2fc', render: (v: number) => v?.toFixed(2) },
      { title: 'p值', dataIndex: 'pvalue', key: 'pvalue', render: (v: number) => v?.toFixed(4) },
    ]

    return (
      <Card size="small" title={`双轨分析结果 - ${result.dataset_name}`} style={{ marginTop: 16, background: 'var(--color-bg-card)' }}>
        <Row gutter={16}>
          <Col span={12}>
            <Card size="small" title="工具轨 (scipy)" style={{ background: '#fafafa' }}>
              <Tag color="green">{result.tool_result.significant_genes.length} 个显著基因</Tag>
              <Table size="small" dataSource={result.tool_result.significant_genes} columns={toolColumns} rowKey="gene_id" pagination={false} style={{ marginTop: 8 }} />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="大模型轨 (千问)" style={{ background: '#f0f7ff' }}>
              <Tag color="blue">{result.llm_result.significant_genes.length} 个显著基因</Tag>
              <div style={{ marginTop: 8, fontSize: 12 }}>{result.llm_result.reasoning.substring(0, 150)}...</div>
            </Card>
          </Col>
        </Row>
        <Card size="small" title="一致性分析" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={8}><Tag color="green">共同: {result.consistency.overlap.join(', ') || '-'}</Tag></Col>
            <Col span={8}><Tag color="orange">仅工具: {result.consistency.tool_only.join(', ') || '-'}</Tag></Col>
            <Col span={8}><Tag color="blue">仅LLM: {result.consistency.llm_only.join(', ') || '-'}</Tag></Col>
          </Row>
          <div style={{ marginTop: 8 }}><strong>重合率: {(result.consistency.overlap_rate * 100).toFixed(0)}%</strong></div>
        </Card>
      </Card>
    )
  }

  // 渲染进度
  const renderProgress = (progress: { track: string; status: string; progress: number }) => {
    if (progress.progress >= 100) return null
    return (
      <div style={{ marginTop: 12, width: 300 }}>
        <div style={{ marginBottom: 8 }}><Spin size="small" /> {progress.status}</div>
        <Progress percent={progress.progress} size="small" />
      </div>
    )
  }

  return (
    <Layout style={{ height: '100vh', background: 'var(--color-bg-dark)' }}>
      {/* 右侧会话列表 */}
      <Sider width={280} style={{ background: 'var(--color-bg-card)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 20 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={createNewSession} block size="large" style={{ background: 'var(--gradient-accent)', border: 'none' }}>
            新建对话
          </Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 20px' }}>
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setCurrentSessionId(session.id)}
              style={{
                padding: '14px 16px',
                marginBottom: 8,
                borderRadius: 12,
                cursor: 'pointer',
                background: session.id === currentSessionId ? 'var(--color-bg-input)' : 'transparent',
                border: session.id === currentSessionId ? '1px solid var(--color-border)' : '1px solid transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <MessageOutlined style={{ marginRight: 8 }} />
                  {session.title}
                </div>
              </div>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => handleDeleteSession(session.id, e)} />
            </div>
          ))}
        </div>
      </Sider>

      {/* 主内容区 */}
      <Content style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 0 }}>
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />

        {/* 数据集选择弹窗 */}
        <Modal
          title={<><FileOutlined style={{ marginRight: 8 }} />请选择要分析的数据集</>}
          open={datasetModalOpen}
          onCancel={() => { setDatasetModalOpen(false); setPendingAnalysisMsg('') }}
          footer={null}
          width={600}
          centered
        >
          <div style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
            请从以下数据集中选择一个进行差异表达分析：
          </div>
          <Radio.Group style={{ width: '100%' }}>
            <List
              dataSource={datasets}
              renderItem={(dataset) => (
                <List.Item
                  style={{
                    padding: '16px',
                    marginBottom: 8,
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleDatasetSelect(dataset.id)}
                >
                  <Radio value={dataset.id} style={{ width: '100%' }}>
                    <div style={{ marginLeft: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{dataset.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                        {dataset.description}
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                        <Tag color="blue">基因: {dataset.gene_count}</Tag>
                        <Tag color="green">样本: {dataset.sample_count}</Tag>
                        <Tag color="purple">对照组: {dataset.groups?.control?.join(', ') || 'control'}</Tag>
                        <Tag color="red">处理组: {dataset.groups?.treatment?.join(', ') || 'treatment'}</Tag>
                      </div>
                    </div>
                  </Radio>
                </List.Item>
              )}
            />
          </Radio.Group>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-bg-card)', borderRadius: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            💡 提示：分析将同时使用传统统计工具（t检验/DESeq2）和大语言模型进行双轨分析对比
          </div>
        </Modal>

        {/* 顶部栏 */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RobotOutlined style={{ fontSize: 20, color: '#fff' }} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>天枢系统</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {datasets.length > 0 && <Tag color="blue" icon={<FileOutlined />}>{datasets.length} 个数据集</Tag>}
            {isAuthenticated && user ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'profile',
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <UserOutlined />
                          <span>{user.username}</span>
                        </div>
                      ),
                      disabled: true,
                    },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      label: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff4d4f' }}>
                          <LogoutOutlined />
                          <span>退出登录</span>
                        </div>
                      ),
                      onClick: logout,
                    },
                  ],
                }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button
                  type="text"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--gradient-accent)',
                    border: '2px solid var(--color-border)',
                  }}
                >
                  <Avatar
                    size={32}
                    src={null}
                    icon={<UserOutlined />}
                    style={{ background: 'var(--gradient-accent)', color: '#fff' }}
                  />
                </Button>
              </Dropdown>
            ) : (
              <Button
                type="primary"
                icon={<UserSwitchOutlined />}
                onClick={() => setAuthModalOpen(true)}
                style={{
                  height: 36,
                  borderRadius: 18,
                  background: 'var(--gradient-accent)',
                  border: 'none',
                  fontWeight: 500,
                }}
              >
                登录
              </Button>
            )}
          </div>
        </div>

        {/* 消息区域 */}
        <div
          style={{ flex: 1, overflow: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column' }}
          onScroll={handleScroll}
        >
          {!hasMessages ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <RobotOutlined style={{ fontSize: 48, color: '#fff' }} />
              </div>
              <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>天枢系统</h2>
              <p style={{ textAlign: 'center', maxWidth: 400, lineHeight: 1.8 }}>
                基于双轨差异分析的育种研究助手<br />
                试试这样问：<br />
                "帮我做差异表达分析"
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', padding: '0 24px' }}>
              {currentSession?.messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 24, display: 'flex', gap: 16, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role !== 'user' && <Avatar icon={<RobotOutlined />} style={{ background: 'var(--color-bg-dark)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }} />}
                  <div style={{ maxWidth: '70%' }}>
                    {msg.role !== 'user' && <div style={{ fontSize: 12, color: 'var(--color-gold)', marginBottom: 4 }}>天枢</div>}
                    {msg.isLoading ? <Spin /> : msg.type === 'progress' && msg.progress ? <AnalysisProgress progress={msg.progress} isAnalyzing={msg.isLoading || false} /> : msg.type === 'analysis' && msg.analysisResult ? <DualTrackResultCard result={msg.analysisResult} /> : msg.type === 'result' && msg.analysisResult ? <DualTrackResultCard result={msg.analysisResult} /> : <div style={{ background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)', color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)', padding: '12px 16px', borderRadius: 16, lineHeight: 1.6 }}>{msg.content}</div>}
                  </div>
                  {msg.role === 'user' && <Avatar icon={<UserOutlined />} style={{ background: 'var(--color-accent)' }} />}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={{ padding: '0 24px 24px', background: 'var(--color-bg-dark)' }}>
          <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: 24,
            border: '1px solid var(--color-border)',
            padding: hasMessages ? '8px 8px 8px 20px' : '20px',
            display: 'flex',
            alignItems: hasMessages ? 'center' : 'flex-start',
            gap: 12,
            maxWidth: 800,
            margin: '0 auto',
            boxShadow: 'var(--shadow-card)',
          }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={hasMessages ? "输入消息..." : "请描述您的问题或分析需求..."}
              autoSize={{ minRows: 1, maxRows: 6 }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 16,
                resize: 'none',
              }}
              disabled={loading}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
              style={{
                width: 48,
                height: 48,
                background: input.trim() ? 'var(--gradient-accent)' : 'var(--color-bg-input)',
                border: 'none',
              }}
            />
          </div>
          {hasMessages && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>AI 生成内容可能存在错误，请核实重要信息</div>}
        </div>
      </Content>
    </Layout>
  )
}
