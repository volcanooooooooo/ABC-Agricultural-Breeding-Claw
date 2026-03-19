import React, { useState, useRef, useEffect, Fragment } from 'react'
import { Input, Button, Avatar, Spin, Card, Row, Col, Tag, Table, Progress, message, Layout, Dropdown, Space } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, DeleteOutlined, PlusOutlined, MessageOutlined, FileOutlined, ArrowRightOutlined, LogoutOutlined, SettingOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { chatApi, analysisApi, datasetApi, Message, AnalysisResult, Dataset, GeneInfo } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import { AnalysisProgress } from '../components/AnalysisProgress'
import { DualTrackResultCard } from '../components/DualTrackResultCard'
import { FeedbackHintBanner } from '../components/FeedbackHintBanner'
import { GeneDetailModal } from '../components/GeneDetailModal'
import { useSSE } from '../hooks/useSSE'

const { TextArea } = Input
const { Sider, Content } = Layout

interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query'
  progress?: { track: 'tool' | 'llm' | 'init' | 'consistency'; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
  candidateDatasets?: Dataset[]
  selectedDataset?: Dataset
  geneId?: string  // 新增：查询的基因ID
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
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(0)
  const [geneModalOpen, setGeneModalOpen] = useState(false)
  const [selectedGene, setSelectedGene] = useState<string>('')
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
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

  // 模拟数据集候选列表（实际项目中从后端加载）
  const MOCK_DATASETS: Dataset[] = [
    { id: 'ds_rice_20240306', name: '水稻3月6日表达数据', description: '水稻基因表达矩阵 - 3月6日实验数据，包含10个基因、6个样本', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_rice_20240306.csv', gene_count: 10, sample_count: 6, groups: { control: ['Ctrl_1', 'Ctrl_2', 'Ctrl_3'], treatment: ['Treat_1', 'Treat_2', 'Treat_3'] }, created_at: '2024-03-06', updated_at: '2024-03-06' },
    { id: 'ds_corn_20240115', name: '玉米干旱胁迫转录组', description: '玉米在干旱胁迫条件下的基因表达谱分析，包含48个样本', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_corn_20240115.csv', gene_count: 156, sample_count: 48, groups: { control: ['Corn_CK_1', 'Corn_CK_2', 'Corn_CK_3', 'Corn_CK_4'], treatment: ['Corn_DR_1', 'Corn_DR_2', 'Corn_DR_3', 'Corn_DR_4'] }, created_at: '2024-01-15', updated_at: '2024-01-15' },
    { id: 'ds_wheat_20231220', name: '冬小麦春化阶段表达谱', description: '冬小麦不同春化阶段的转录组测序数据', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_wheat_20231220.csv', gene_count: 234, sample_count: 36, groups: { control: ['Wheat_V0_1', 'Wheat_V0_2', 'Wheat_V0_3'], treatment: ['Wheat_V3_1', 'Wheat_V3_2', 'Wheat_V3_3'] }, created_at: '2023-12-20', updated_at: '2023-12-20' },
    { id: 'ds_soybean_20240228', name: '大豆结瘤固氮表达数据', description: '大豆根瘤发育不同时期的基因表达矩阵', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_soybean_20240228.csv', gene_count: 89, sample_count: 24, groups: { control: ['Soy_Nodule_0_1', 'Soy_Nodule_0_2', 'Soy_Nodule_0_3'], treatment: ['Soy_Nodule_14_1', 'Soy_Nodule_14_2', 'Soy_Nodule_14_3'] }, created_at: '2024-02-28', updated_at: '2024-02-28' },
    { id: 'ds_rice_nitrogen_20231110', name: '水稻氮响应表达谱', description: '水稻在不同氮浓度条件下的转录组分析', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_rice_nitrogen_20231110.csv', gene_count: 312, sample_count: 42, groups: { control: ['Rice_LN_1', 'Rice_LN_2', 'Rice_LN_3'], treatment: ['Rice_HN_1', 'Rice_HN_2', 'Rice_HN_3'] }, created_at: '2023-11-10', updated_at: '2023-11-10' },
    { id: 'ds_arabidopsis_20240105', name: '拟南芥光周期响应数据', description: '拟南芥在不同光照周期下的基因表达分析', data_type: 'expression_matrix', file_path: 'backend/data/datasets/ds_arabidopsis_20240105.csv', gene_count: 67, sample_count: 18, groups: { control: ['Ara_LD_1', 'Ara_LD_2', 'Ara_LD_3'], treatment: ['Ara_SD_1', 'Ara_SD_2', 'Ara_SD_3'] }, created_at: '2024-01-05', updated_at: '2024-01-05' },
  ]

  // 加载数据集
  const loadDatasets = async () => {
    try {
      const res = await datasetApi.getAll()
      const apiDatasets = res?.data?.data || []

      // 如果没有数据集，使用模拟数据
      if (apiDatasets.length === 0) {
        setDatasets(MOCK_DATASETS)
      } else {
        setDatasets(apiDatasets)
      }
    } catch (e) {
      console.error(e)
      // 即使出错也设置模拟数据
      setDatasets(MOCK_DATASETS)
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

  // 基因查询意图识别
  const detectGeneQueryIntent = (text: string): string | null => {
    // 基因查询模式：查看/展示 + 基因名
    const patterns = [
      /基因(\w+)/i,           // "展示基因Gene7" / "查看基因Gene7详情"
      /(gene\d+)/i,          // "查看 gene7" / "gene7详情"
      /(?:Gene|gene)(\d+)\s*详情/i,  // "Gene7详情" / "gene7详情"
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        // 返回匹配的基因ID
        const geneId = match[1] || match[0]
        // 标准化为 GeneX 格式
        if (/^gene\d+$/i.test(geneId)) {
          return 'Gene' + geneId.slice(4).toLowerCase()
        }
        // 如果是纯数字（如 "7详情" 匹配到的），加上 Gene 前缀
        if (/^\d+$/.test(geneId)) {
          return 'Gene' + geneId
        }
        return geneId
      }
    }
    return null
  }

  const handleSend = async () => {
    if (!input.trim() || loading || !currentSessionId) return

    // 检查是否是分析意图
    if (detectAnalysisIntent(input) && datasets.length > 0) {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date().toString(),
      }

      updateCurrentSession(msgs => [...msgs, userMsg])
      setInput('')
      setLoading(true)
      setIsAtBottom(true)

      // 显示"正在检索相关数据集..."
      const searchingMsgId = (Date.now() + 1).toString()
      updateCurrentSession(msgs => [...msgs, {
        id: searchingMsgId,
        role: 'assistant',
        content: '正在检索相关数据集...',
        timestamp: new Date().toString(),
      }])

      // 模拟检索延迟 1.5 秒
      await new Promise(resolve => setTimeout(resolve, 1500))

      // 替换检索消息为数据集选择列表
      updateCurrentSession(msgs =>
        msgs.map(msg =>
          msg.id === searchingMsgId
            ? {
                ...msg,
                type: 'dataset-select' as const,
                candidateDatasets: datasets,
              }
            : msg
        )
      )

      setLoading(false)
      return
    }

    // 检查基因查询意图
    const detectedGeneId = detectGeneQueryIntent(input)
    if (detectedGeneId && currentSession) {
      // 查找当前会话中的分析结果
      const resultMsg = currentSession.messages.find(
        msg => msg.type === 'progress' && msg.analysisResult
      )

      if (resultMsg?.analysisResult) {
        // 找到分析结果，直接打开基因详情弹窗
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: input.trim(),
          timestamp: new Date().toString(),
          type: 'gene-query',
          geneId: detectedGeneId
        }
        updateCurrentSession(msgs => [...msgs, userMsg])
        setInput('')
        setSelectedGene(detectedGeneId)
        setSelectedResult(resultMsg.analysisResult)
        setGeneModalOpen(true)
        return
      } else {
        // 没有分析结果，提示用户先进行分析
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: input.trim(),
          timestamp: new Date().toString(),
        }
        const systemMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `您查询的基因 "${detectedGeneId}" 信息需要先完成分析才能展示。请先发起一个差异表达分析任务。`,
          timestamp: new Date().toString(),
        }
        updateCurrentSession(msgs => [...msgs, userMsg, systemMsg])
        setInput('')
        return
      }
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
  const handleDatasetSelect = async (dataset: Dataset) => {
    // 移除数据集选择消息
    updateCurrentSession(msgs =>
      msgs.filter(msg => msg.type !== 'dataset-select')
    )

    // 添加系统消息显示选择的数据集（结构化卡片形式）
    updateCurrentSession(msgs => [...msgs, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      type: 'dataset-selected',
      content: `已选择数据集「${dataset.name}」，正在开始双轨差异分析...`,
      selectedDataset: dataset,
      timestamp: new Date().toString(),
    }])

    setLoading(true)
    setIsAtBottom(true)
    setAnalysisStartTime(Date.now())

    // 调用分析API
    await handleAnalysisRequest('', dataset)
    setLoading(false)
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

  // 追问处理
  const handleFollowUp = async (question: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date().toString(),
    }

    updateCurrentSession(msgs => [...msgs, userMessage])
    setIsAtBottom(true)
    await handleNormalChat(userMessage)
  }

  // 基因点击处理
  const handleGeneClick = (geneId: string) => {
    setSelectedGene(geneId)
    // 找到当前消息中的 analysisResult
    if (currentSession) {
      const resultMsg = currentSession.messages.find(
        msg => msg.type === 'progress' && msg.analysisResult
      )
      if (resultMsg?.analysisResult) {
        setSelectedResult(resultMsg.analysisResult)
        setGeneModalOpen(true)
      }
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

    // 初始进度消息（用于显示进度条）
    const progressMsgId = (Date.now() + 2).toString()
    updateCurrentSession(msgs => [...msgs, {
      id: progressMsgId,
      role: 'assistant',
      type: 'progress',
      content: '',
      progress: { track: 'init', status: '正在初始化...', progress: 0, currentStep: '初始化分析任务', elapsedTime: 0 },
      timestamp: new Date().toString(),
    }])

    try {
      const compareRes = await analysisApi.compare({
        dataset_id: dataset.id,
        group_control: 'control',
        group_treatment: 'treatment',
      })

      // 兼容两种响应格式：
      // 1. 后端直接返回 { job_id, status } - compareRes.data 是 CompareResponse
      // 2. 后端返回 { status, data: { job_id, status } } - compareRes.data.data 是 CompareResponse
      const resData = compareRes.data as any
      const jobId = resData?.job_id || resData?.data?.job_id

      if (!jobId) {
        throw new Error('无法获取分析任务ID')
      }

      const startTime = Date.now()

      const eventSource = new EventSource(`/api/analysis/stream/${jobId}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        const elapsedTime = (Date.now() - startTime) / 1000

        if (data.result) {
          // 分析完成
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, analysisResult: data.result, progress: { ...msg.progress!, progress: 100, status: '分析完成', elapsedTime } }
                : msg
            )
          )
          eventSource.close()
        } else if (data.status === 'error') {
          message.error(data.message || '分析失败')
          eventSource.close()
        } else if (data.progress !== undefined) {
          // 更新进度条
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, progress: { track: data.track || 'init', status: data.status, progress: data.progress, currentStep: data.currentStep, elapsedTime } }
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

  // 渲染消息内容
  const renderMessageContent = (msg: ChatMessage) => {
    // 加载状态
    if (msg.isLoading) {
      return <Spin />
    }

    // 数据集选择卡片
    if (msg.type === 'dataset-select' && msg.candidateDatasets) {
      return (
        <div style={{ background: 'var(--color-bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)', minWidth: 400 }}>
          <div style={{ marginBottom: 12, color: 'var(--color-text-primary)', fontSize: 14 }}>
            请选择要分析的数据集：
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {msg.candidateDatasets.map(dataset => (
              <div
                key={dataset.id}
                onClick={() => handleDatasetSelect(dataset)}
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-bg-input)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent)'
                  e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.background = 'var(--color-bg-input)'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                  {dataset.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                  {dataset.description}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color="blue">基因: {dataset.gene_count}</Tag>
                  <Tag color="green">样本: {dataset.sample_count}</Tag>
                  <Tag color="purple">对照: {dataset.groups?.control?.join(', ') || 'control'}</Tag>
                  <Tag color="red">处理: {dataset.groups?.treatment?.join(', ') || 'treatment'}</Tag>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(0, 212, 255, 0.1)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            💡 分析将同时使用传统统计工具（t检验/DESeq2）和大语言模型进行双轨分析对比
          </div>
        </div>
      )
    }

    // 已选择数据集卡片
    if (msg.type === 'dataset-selected' && msg.selectedDataset) {
      const ds = msg.selectedDataset
      return (
        <div style={{ background: 'var(--color-bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)', minWidth: 450 }}>
          <div style={{ marginBottom: 8, fontSize: 14, color: 'var(--color-text-primary)' }}>
            {msg.content}
          </div>
          <div style={{ background: 'var(--color-bg-input)', borderRadius: 12, padding: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileOutlined style={{ fontSize: 20, color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>
                  {ds.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  {ds.description}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--color-bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>基因数量</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-accent)' }}>{ds.gene_count}</div>
              </div>
              <div style={{ background: 'var(--color-bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>样本数量</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-accent)' }}>{ds.sample_count}</div>
              </div>
              <div style={{ background: 'var(--color-bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>对照组</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {ds.groups?.control?.join(', ') || 'control'}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-card)', padding: '8px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>处理组</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {ds.groups?.treatment?.join(', ') || 'treatment'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // 进度卡片（当有 analysisResult 时显示结果卡片）
    if (msg.type === 'progress' && msg.progress) {
      return (
        <>
          <AnalysisProgress progress={msg.progress} isAnalyzing={!msg.analysisResult} />
          {msg.analysisResult && (
            <div style={{ marginTop: 16 }}>
              <DualTrackResultCard result={msg.analysisResult} onFollowUp={handleFollowUp} onGeneClick={handleGeneClick} />
            </div>
          )}
        </>
      )
    }

    // 分析结果卡片
    if ((msg.type === 'result' || msg.type === 'analysis') && msg.analysisResult) {
      return <DualTrackResultCard result={msg.analysisResult} onFollowUp={handleFollowUp} onGeneClick={handleGeneClick} />
    }

    // 普通文本消息
    return (
      <div style={{
        background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
        color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
        padding: '12px 16px',
        borderRadius: 16,
        lineHeight: 1.6
      }}>
        {msg.content}
      </div>
    )
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

        {/* 基因详情弹窗 */}
        {selectedResult && (
          <GeneDetailModal
            geneId={selectedGene}
            result={selectedResult}
            open={geneModalOpen}
            onClose={() => setGeneModalOpen(false)}
          />
        )}

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
            <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '0 24px' }}>
              {currentSession?.messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 24, display: 'flex', gap: 16, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role !== 'user' && <Avatar icon={<RobotOutlined />} style={{ background: 'var(--color-bg-dark)', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }} />}
                  <div style={{ maxWidth: '90%' }}>
                    {msg.role !== 'user' && <div style={{ fontSize: 12, color: 'var(--color-gold)', marginBottom: 4 }}>天枢</div>}
                    {renderMessageContent(msg)}
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
            maxWidth: 1050,
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
