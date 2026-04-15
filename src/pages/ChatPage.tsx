import React, { useState, useRef, useEffect, Fragment } from 'react'
import { Input, Button, Avatar, Spin, Card, Row, Col, Tag, Table, Progress, message, Layout, Dropdown, Space, Modal } from 'antd'
import { SendOutlined, UserOutlined, RobotOutlined, DeleteOutlined, PlusOutlined, MessageOutlined, FileOutlined, ArrowRightOutlined, LogoutOutlined, SettingOutlined, UserSwitchOutlined, UploadOutlined, DatabaseOutlined, EditOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { chatApi, analysisApi, datasetApi, ontologyApi, Message, AnalysisResult, Dataset, GeneInfo } from '../api/client'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import { AnalysisProgress } from '../components/AnalysisProgress'
import { DualTrackResultCard } from '../components/DualTrackResultCard'
import { AnalysisResultCard, SimpleAnalysisResult } from '../components/AnalysisResultCard'
import { FeedbackHintBanner } from '../components/FeedbackHintBanner'
import { GeneDetailModal } from '../components/GeneDetailModal'
import { GeneInfoPanel } from '../components/GeneInfoPanel'
import { OntologyModal } from '../components/OntologyModal'
import { useSSE } from '../hooks/useSSE'
import { EnrichmentResultCard, EnrichmentResult } from '../components/EnrichmentResultCard'
import { BlastResultCard, BlastResult } from '../components/BlastResultCard'
import { AnalysisFlowChart } from '../components/AnalysisFlowChart'
import { GroupSelectModal } from '../components/GroupSelectModal'
import iconImg from '../img/icon.png'

const { TextArea } = Input
const { Sider, Content } = Layout

interface ChatMessage extends Message {
  isLoading?: boolean
  type?: 'text' | 'progress' | 'analysis' | 'result' | 'dataset-select' | 'dataset-selected' | 'step' | 'gene-query' | 'enrichment-prompt' | 'enrichment-loading' | 'enrichment-result' | 'blast-result' | 'analysis-method-select' | 'enrichment-file-confirm'
  progress?: { track: 'tool' | 'llm' | 'init' | 'consistency'; status: string; progress: number; currentStep?: string; elapsedTime?: number }
  analysisResult?: AnalysisResult
  candidateDatasets?: Dataset[]
  selectedDataset?: Dataset
  geneId?: string
  enrichmentResult?: EnrichmentResult
  blastResult?: BlastResult
  attachedFile?: { name: string; path: string }
  enrichmentFileInfo?: {
    filePath: string
    filename: string
    geneCount: number
    genePreview: string[]
    fileType: 'gene_list' | 'diff_result'
  }
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
  const [showCmdMenu, setShowCmdMenu] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(0)
  const [cmdMenuIndex, setCmdMenuIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [analysisStartTime, setAnalysisStartTime] = useState<number>(0)
  const [geneModalOpen, setGeneModalOpen] = useState(false)
  const [selectedGene, setSelectedGene] = useState<string>('')
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [geneInfoPanelOpen, setGeneInfoPanelOpen] = useState(false)
  const [ontologyModalOpen, setOntologyModalOpen] = useState(false)
  const [ontologyNodeId, setOntologyNodeId] = useState<string | undefined>()
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ path: string; name: string; type: 'fasta' | 'matrix' | 'genelist' } | null>(null)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [pendingUpload, setPendingUpload] = useState<{
    filePath: string
    filename: string
    columns: string[]
    rowCount: number
  } | null>(null)
  const [siderCollapsed, setSiderCollapsed] = useState(window.innerWidth < 768)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const matrixFileInputRef = useRef<HTMLInputElement>(null)

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

  // 保存会话到 localStorage（裁剪大体积数据避免超出配额）
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        const trimmed = sessions.map(s => ({
          ...s,
          messages: s.messages.map(msg => {
            // 移除大体积的分析结果数据，只保留消息文本和类型
            const { analysisResult, enrichmentResult, blastResult, ...rest } = msg as any
            return rest
          }),
        }))
        localStorage.setItem('chat_sessions', JSON.stringify(trimmed))
      } catch (e) {
        // QuotaExceededError: 清理旧会话后重试
        if (sessions.length > 1) {
          try {
            const recent = sessions.slice(-3) // 只保留最近 3 个会话
            localStorage.setItem('chat_sessions', JSON.stringify(recent))
          } catch {
            // 仍然失败，清空存储
            localStorage.removeItem('chat_sessions')
          }
        }
      }
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
      // API 返回直接数组
      const apiDatasets = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : [])

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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  // 识别差异表达分析意图（仅斜杠命令）
  const detectAnalysisIntent = (text: string): boolean => {
    const commands = ['/analyze', '/diff', '/analyse']
    return commands.some(cmd => text.toLowerCase().startsWith(cmd))
  }

  // 解析 AI 回复中的 ANALYSIS_READY 标记
  const parseAnalysisReady = (content: string): { hasIntent: boolean; cleanContent: string } => {
    const marker = '<!-- ANALYSIS_READY -->'
    const hasIntent = content.includes(marker)
    const cleanContent = content.replace(marker, '').trim()
    return { hasIntent, cleanContent }
  }

  // 知识本体查询意图识别
  const detectOntologyIntent = (text: string): boolean => {
    const keywords = ['知识本体', 'ontology', '本体查询', '查询本体', '本体图谱', '本体图', '知识图谱']
    const textLower = text.toLowerCase()
    return keywords.some(k => textLower.includes(k.toLowerCase()))
  }

  // 基因查询意图识别
  const detectGeneQueryIntent = (text: string): string | null => {
    // 排除多行文本（粘贴的表达数据）和过长输入
    if (text.includes('\t') || text.includes('\n') || text.length > 100) return null

    // 基因查询模式：需要明确的查询上下文
    const patterns = [
      /(?:查看|展示|查询|搜索|显示).*基因\s*(\w+)/i,  // "查看基因Gene7"
      /基因\s*(\w+)\s*(?:详情|信息|表达)/i,            // "基因Gene7详情"
      /(?:查看|展示|查询|搜索|显示)\s*(gene\d+)/i,     // "查看 Gene7"
      /(gene\d+)\s*(?:详情|信息|怎么样)/i,             // "Gene7详情"
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const geneId = match[1] || match[0]
        if (/^gene\d+$/i.test(geneId)) {
          return 'Gene' + geneId.slice(4).toLowerCase()
        }
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

    // /tools 命令：展示所有可用工具
    if (input.trim() === '/tools') {
      const userMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: '/tools',
        timestamp: new Date().toString(),
      }
      const toolsMsg: ChatMessage = {
        id: `${Date.now()}-tools`,
        role: 'assistant',
        content: '__tools_list__',
        timestamp: new Date().toString(),
        type: 'text',
      }
      updateCurrentSession(msgs => [...msgs, userMsg, toolsMsg])
      setInput('')
      return
    }

    // /datasets 命令：展示可用数据集列表
    if (input.trim() === '/datasets') {
      const userMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: '/datasets',
        timestamp: new Date().toString(),
      }
      const datasetsMsg: ChatMessage = {
        id: `${Date.now()}-datasets`,
        role: 'assistant',
        content: '__datasets_list__',
        timestamp: new Date().toString(),
        type: 'text',
      }
      updateCurrentSession(msgs => [...msgs, userMsg, datasetsMsg])
      setInput('')
      return
    }

    // 检查是否是知识本体查询意图
    if (detectOntologyIntent(input)) {
      const userMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: input.trim(),
        timestamp: new Date().toString(),
      }
      updateCurrentSession(msgs => [...msgs, userMsg])
      setInput('')
      setOntologyModalOpen(true)
      return
    }

    // 检查是否是差异分析意图
    if (detectAnalysisIntent(input)) {
      // 无上传文件 → 显示分析方式选择卡片
      if (!uploadedFile) {
        const userMsg: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: 'user',
          content: input.trim(),
          timestamp: new Date().toString(),
        }
        updateCurrentSession(msgs => [...msgs, userMsg])
        setInput('')

        // 显示分析方式选择卡片
        updateCurrentSession(msgs => [...msgs, {
          id: `${Date.now()}-analysis-method`,
          role: 'assistant',
          content: '',
          timestamp: new Date().toString(),
          type: 'analysis-method-select',
        }])
        return
      }
      // 有 FASTA 文件但说差异分析 → 走对话
    }

    // 检查基因查询意图
    const detectedGeneId = detectGeneQueryIntent(input)
    if (detectedGeneId && currentSession) {
      // 查找当前会话中的分析结果
      const resultMsg = currentSession.messages.find(
        msg => msg.type === 'progress' && msg.analysisResult
      )

      // 无论是否有 analysisResult，都打开 GeneDetailModal
      // 如果没有，会自动从后端获取历史分析
      const userMsg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: input.trim(),
        timestamp: new Date().toString(),
        type: 'gene-query',
        geneId: detectedGeneId
      }
      updateCurrentSession(msgs => [...msgs, userMsg])
      setInput('')
      setSelectedGene(detectedGeneId)
      setSelectedResult(resultMsg?.analysisResult || null)  // 可能为 null，Modal 会自动从后端获取
      setGeneModalOpen(true)
      return
    }

    let finalContent = input.trim()
    let sendContent = finalContent
    if (uploadedFile) {
      sendContent += `\n[上传文件: ${uploadedFile.name}, 路径: ${uploadedFile.path}]`
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: finalContent,
      timestamp: new Date().toString(),
      attachedFile: uploadedFile ? { name: uploadedFile.name, path: uploadedFile.path } : undefined,
    }

    // 发送给后端的消息带文件路径
    const messageForBackend: ChatMessage = { ...userMessage, content: sendContent }

    updateCurrentSession(msgs => [...msgs, userMessage])
    setInput('')
    setUploadedFile(null)
    setLoading(true)
    setIsAtBottom(true)
    await handleNormalChat(messageForBackend)
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
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

  // 分析方式选择：内置数据集
  const handleSelectBuiltinDataset = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'analysis-method-select'))
    // 显示数据集选择列表
    updateCurrentSession(msgs => [...msgs, {
      id: `${Date.now()}-dataset-select`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toString(),
      type: 'dataset-select',
      candidateDatasets: datasets,
    }])
  }

  // 分析方式选择：输入序列
  const handleSelectInputSequence = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'analysis-method-select'))
    updateCurrentSession(msgs => [...msgs, {
      id: `${Date.now()}-input-hint`,
      role: 'assistant',
      content: '请在输入框中粘贴您的表达数据，格式示例：\n\n```\ngene_id\\tWT_1\\tWT_2\\tTreat_1\\tTreat_2\nGene1\\t100\\t120\\t80\\t95\nGene2\\t200\\t180\\t210\\t190\n```\n\n然后输入"帮我做差异分析，对照组为 WT，处理组为 Treat"即可。',
      timestamp: new Date().toString(),
    }])
  }

  // 分析方式选择：上传文件
  const handleSelectUploadMatrix = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'analysis-method-select'))
    matrixFileInputRef.current?.click()
  }

  // 表达矩阵文件选择回调
  const handleMatrixFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset

    // 添加用户消息
    updateCurrentSession(msgs => [...msgs, {
      id: `${Date.now()}-upload-user`,
      role: 'user' as const,
      content: `上传表达矩阵文件：${file.name}`,
      timestamp: new Date().toString(),
    }])

    await handleUploadAndAnalyze(file)
  }

  // 上传文件 → 自动推断分组 → 双轨分析
  const handleUploadAndAnalyze = async (file: File) => {
    try {
      const res = await analysisApi.uploadMatrix(file)
      const data = (res.data as any).data ?? res.data
      const { file_path, filename, columns, row_count, suggested_groups } = data

      if (suggested_groups && Object.keys(suggested_groups).length >= 2) {
        // 自动推断成功 → 注册临时数据集 → 直接开始双轨分析
        const groupKeys = Object.keys(suggested_groups)
        const totalSamples = groupKeys.reduce(
          (sum: number, k: string) => sum + (suggested_groups[k]?.length || 0), 0
        )

        // 显示上传成功消息
        updateCurrentSession(msgs => [...msgs, {
          id: `${Date.now()}-upload-success`,
          role: 'assistant' as const,
          content: `文件 **${filename}** 上传成功（${row_count} 基因, ${totalSamples} 样本）。\n\n已自动识别分组：**${groupKeys[0]}**（${suggested_groups[groupKeys[0]].length} 样本）vs **${groupKeys[1]}**（${suggested_groups[groupKeys[1]].length} 样本），正在开始双轨分析...`,
          timestamp: new Date().toString(),
        }])

        // 注册临时数据集
        const regRes = await analysisApi.registerTemp(file_path, filename, suggested_groups)
        const dataset: Dataset = (regRes.data as any).data ?? regRes.data

        // 开始双轨分析
        setLoading(true)
        setIsAtBottom(true)
        setAnalysisStartTime(Date.now())
        await handleAnalysisRequest('', dataset)
        setLoading(false)
      } else {
        // 自动推断失败 → 弹出分组选择 Modal
        message.info(`文件 ${filename} 上传成功，请手动选择分组`)
        setPendingUpload({ filePath: file_path, filename, columns: columns || [], rowCount: row_count })
        setGroupModalOpen(true)
      }
    } catch (err: any) {
      message.error('文件上传失败: ' + (err.message || '未知错误'))
    }
  }

  // 用户手动确认分组后 → 注册临时数据集 → 双轨分析
  const handleGroupConfirm = async (groups: Record<string, string[]>) => {
    if (!pendingUpload) return
    setGroupModalOpen(false)

    const groupKeys = Object.keys(groups)

    // 显示确认消息
    updateCurrentSession(msgs => [...msgs, {
      id: `${Date.now()}-group-confirmed`,
      role: 'assistant' as const,
      content: `文件 **${pendingUpload.filename}** 分组确认：**${groupKeys[0]}**（${groups[groupKeys[0]].length} 样本）vs **${groupKeys[1]}**（${groups[groupKeys[1]].length} 样本），正在开始双轨分析...`,
      timestamp: new Date().toString(),
    }])

    try {
      // 注册临时数据集
      const regRes = await analysisApi.registerTemp(
        pendingUpload.filePath, pendingUpload.filename, groups
      )
      const dataset: Dataset = (regRes.data as any).data ?? regRes.data

      // 开始双轨分析
      setLoading(true)
      setIsAtBottom(true)
      setAnalysisStartTime(Date.now())
      await handleAnalysisRequest('', dataset)
      setLoading(false)
    } catch (err: any) {
      message.error('注册数据集失败: ' + (err.message || '未知错误'))
    }

    setPendingUpload(null)
  }

  // 普通对话
  const handleNormalChat = async (userMessage: ChatMessage) => {
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toString(),
      isLoading: true,
    }
    updateCurrentSession(msgs => [...msgs, assistantMessage])

    try {
      const response = await chatApi.sendMessage({ message: userMessage.content })
      const assistantContent = (response.data as any).content ?? (response.data as any).response ?? ''
      updateCurrentSession(msgs =>
        msgs.map(msg => msg.id === assistantMessage.id ? { ...msg, content: assistantContent, isLoading: false } : msg)
      )
    } catch (error: any) {
      console.error('Chat error:', error)
      const errorMsg = error.friendlyMessage
        || error.response?.data?.detail
        || '抱歉，发生了一些错误，请稍后重试'
      updateCurrentSession(msgs =>
        msgs.map(msg => msg.id === assistantMessage.id
          ? { ...msg, content: errorMsg, isLoading: false }
          : msg)
      )
    }
  }

  // 追问处理
  const handleFollowUp = async (question: string) => {
    const userMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    let analysisResult: AnalysisResult | null = null
    if (currentSession) {
      const resultMsg = currentSession.messages.find(
        msg => msg.type === 'progress' && msg.analysisResult
      )
      analysisResult = resultMsg?.analysisResult || null
    }
    // 无论是否有 analysisResult，都打开 GeneDetailModal
    // 如果没有，会自动从后端获取历史分析
    setSelectedResult(analysisResult)
    setGeneModalOpen(true)
  }

  // 分析请求
  const handleAnalysisRequest = async (userMessageContent: string, selectedDataset?: Dataset) => {
    const dataset = selectedDataset || datasets[0]
    if (!dataset) {
      updateCurrentSession(msgs => [...msgs, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: '请先上传表达矩阵数据集再进行分析。',
        timestamp: new Date().toString(),
      }])
      return
    }

    // 初始进度消息（用于显示进度条）
    const progressMsgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    updateCurrentSession(msgs => [...msgs, {
      id: progressMsgId,
      role: 'assistant',
      type: 'progress',
      content: '',
      progress: { track: 'init', status: '正在初始化...', progress: 0, currentStep: '初始化分析任务', elapsedTime: 0 },
      timestamp: new Date().toString(),
    }])

    try {
      // 从数据集中获取实际的分组名称
      const groupKeys = Object.keys(dataset.groups || {})
      const groupControl = groupKeys[0] || 'control'
      const groupTreatment = groupKeys[1] || 'treatment'

      const compareRes = await analysisApi.compare({
        dataset_id: dataset.id,
        group_control: groupControl,
        group_treatment: groupTreatment,
      })

      // 兼容两种响应格式：
      // 1. 后端直接返回 { job_id, status } - compareRes.data 是 CompareResponse
      // 2. 后端返回 { status, data: { job_id, status } } - compareRes.data.data 是 CompareResponse
      const resData = compareRes.data as any
      const jobId = resData?.job_id || resData?.data?.job_id

      if (!jobId) {
        throw new Error('无法获取分析任务ID')
      }

      // 保存 jobId 以支持取消
      setCurrentJobId(jobId)

      const startTime = Date.now()

      // 使用代理，Vite 已配置 ws: true 支持 SSE
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
          // 若有显著基因，追加富集分析提示
          const sigGenes = data.result?.tool_result?.significant_genes ?? []
          if (sigGenes.length > 0) {
            updateCurrentSession(msgs => [...msgs, {
              id: `${Date.now()}-enrichment-prompt`,
              role: 'assistant' as const,
              type: 'enrichment-prompt' as const,
              content: '',
              analysisResult: data.result,
              timestamp: new Date().toString(),
            }])
          }
          eventSource.close()
          setCurrentJobId(null)
        } else if (data.status === 'error') {
          message.error(data.message || '分析失败')
          eventSource.close()
          setCurrentJobId(null)
        } else if (data.status === 'cancelled') {
          message.info('分析已取消')
          updateCurrentSession(msgs =>
            msgs.map(msg =>
              msg.id === progressMsgId
                ? { ...msg, progress: { ...msg.progress!, status: '已取消', progress: data.progress || 50 } }
                : msg
            )
          )
          eventSource.close()
          setCurrentJobId(null)
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
        setCurrentJobId(null)
      }
    } catch (error: any) {
      updateCurrentSession(msgs => [...msgs, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'assistant',
        content: `分析失败: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date().toString(),
      }])
      setCurrentJobId(null)
    }
  }

  // 取消分析
  const handleCancelAnalysis = async () => {
    if (!currentJobId || isCancelling) return

    setIsCancelling(true)
    try {
      await analysisApi.cancel(currentJobId)
      message.info('正在取消分析...')
    } catch (error: any) {
      message.error('取消失败: ' + (error.response?.data?.detail || error.message))
      setIsCancelling(false)
    }
  }

  // 从差异分析结果触发富集分析（通过 Agent）
  const handleEnrichmentFromResult = async (analysisResult: AnalysisResult) => {
    // 移除富集提示卡片
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))

    const totalSig = analysisResult.tool_result.total_significant
      ?? analysisResult.tool_result.significant_genes.length

    // 构造用户消息发送给 Agent
    const userMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: `请对差异分析结果 ${analysisResult.id} 中的 ${totalSig} 个显著基因进行 KEGG/GO 富集分析`,
      timestamp: new Date().toString(),
    }
    updateCurrentSession(msgs => [...msgs, userMsg])
    setIsAtBottom(true)
    setLoading(true)
    await handleNormalChat(userMsg)
    setLoading(false)
  }

  // 跳过富集分析提示
  const handleSkipEnrichment = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-prompt'))
  }

  // 确认富集分析（从文件）
  const handleEnrichmentFileConfirm = async (fileInfo: { filePath: string; filename: string; geneCount: number }) => {
    // 移除确认卡片
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-file-confirm'))

    // 构造用户消息发送给 Agent
    const userMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: `请对文件 ${fileInfo.filename} 中的 ${fileInfo.geneCount} 个基因进行 KEGG/GO 富集分析（文件路径：${fileInfo.filePath}）`,
      timestamp: new Date().toString(),
    }
    updateCurrentSession(msgs => [...msgs, userMsg])
    setIsAtBottom(true)
    setLoading(true)
    await handleNormalChat(userMsg)
    setLoading(false)
  }

  // 取消富集分析
  const handleEnrichmentFileCancel = () => {
    updateCurrentSession(msgs => msgs.filter(msg => msg.type !== 'enrichment-file-confirm'))
  }

  const COMMANDS = [
    { cmd: '/tools', icon: '🛠️', desc: '显示所有可用分析工具' },
    { cmd: '/datasets', icon: '📂', desc: '显示可用数据集列表' },
  ]

  const filteredCmds = COMMANDS.filter(c => c.cmd.startsWith(input.trim()))

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (!file) return

    const fastaExts = ['.fa', '.fasta', '.fna', '.faa', '.fas']
    const matrixExts = ['.csv', '.tsv', '.xls', '.xlsx']
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')

    if (fastaExts.includes(ext)) {
      try {
        const res = await analysisApi.uploadFasta(file)
        const data = (res.data as any).data ?? res.data
        setUploadedFile({ path: data.file_path, name: data.filename ?? file.name, type: 'fasta' })
        message.success(`文件 ${file.name} 已附加，请输入分析指令`)
      } catch (err: any) {
        message.error('文件上传失败: ' + (err.message || '未知错误'))
      }
    } else if (matrixExts.includes(ext) || ext === '.txt') {
      // 上传文件，附加到输入框，等用户输入指令后再处理
      try {
        const res = await analysisApi.uploadMatrix(file)
        const data = (res.data as any).data ?? res.data
        setUploadedFile({ path: data.file_path, name: data.filename ?? file.name, type: 'matrix' })
        message.success(`文件 ${file.name} 已附加，请输入分析指令`)
      } catch (err: any) {
        message.error('文件上传失败: ' + (err.response?.data?.detail || err.message || '未知错误'))
      }
    } else {
      message.error('请上传 FASTA 格式文件（.fa, .fasta）或数据文件（.csv, .tsv, .txt）')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showCmdMenu && filteredCmds.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCmdIndex(i => (i + 1) % filteredCmds.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCmdIndex(i => (i - 1 + filteredCmds.length) % filteredCmds.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        setInput(filteredCmds[cmdIndex].cmd)
        setShowCmdMenu(false)
        setCmdIndex(0)
        return
      }
      if (e.key === 'Escape') {
        setShowCmdMenu(false)
        setCmdIndex(0)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 检测消息内容是否为 JSON 格式的分析结果
  const tryParseAnalysisResult = (content: string): SimpleAnalysisResult | null => {
    if (!content) return null
    try {
      const parsed = JSON.parse(content)
      // 检查是否符合 SimpleAnalysisResult 格式
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.significant_genes) &&
        Array.isArray(parsed.volcano_data) &&
        parsed.summary &&
        typeof parsed.summary.total_genes === 'number' &&
        typeof parsed.summary.significant_count === 'number' &&
        typeof parsed.summary.upregulated === 'number' &&
        typeof parsed.summary.downregulated === 'number'
      ) {
        return parsed as SimpleAnalysisResult
      }
      return null
    } catch {
      return null
    }
  }

  const tryParseEnrichmentResult = (content: string): EnrichmentResult | null => {
    if (!content) return null
    const match = content.match(/<!-- ENRICHMENT_DATA: (.+?) -->/)
    if (!match) return null
    try {
      return JSON.parse(match[1]) as EnrichmentResult
    } catch {
      return null
    }
  }

  const tryParseBlastResult = (content: string): BlastResult | null => {
    if (!content) return null
    const match = content.match(/<!-- BLAST_DATA: (.+?) -->/)
    if (!match) return null
    try {
      return JSON.parse(match[1]) as BlastResult
    } catch {
      return null
    }
  }

  // 可用工具定义（与后端 TOOL_REGISTRY 保持同步）
  const TOOL_LIST = [
    {
      name: 'differential_expression_analysis',
      label: '差异表达分析',
      icon: '🧬',
      description: '对基因表达数据进行差异表达分析，使用 t-test 统计方法识别显著差异基因，支持 log2FC 和 p-value 阈值筛选。',
      usage: '/analyze --control WT --treatment osbzip23',
      params: [
        { name: 'control_group', desc: '对照组名称（如 "WT"）' },
        { name: 'treatment_group', desc: '处理组名称（如 "osbzip23"）' },
        { name: 'pvalue_threshold', desc: 'P 值阈值，默认 0.05' },
        { name: 'log2fc_threshold', desc: 'log2FC 阈值，默认 1.0' },
      ],
      output: '返回上调/下调 TOP10 基因表格、火山图数据及完整 CSV 下载',
    },
    {
      name: 'enrichment_analysis',
      label: 'KEGG/GO 富集分析',
      icon: '🔬',
      description: '对基因列表进行 KEGG 通路富集分析和 GO 功能富集分析，支持差异分析结果串联或直接输入基因 ID。',
      usage: '对以下基因做富集分析：OsMH_01G0000400,OsMH_02G0001200',
      params: [
        { name: 'gene_list', desc: '逗号分隔的基因 ID 列表' },
        { name: 'analysis_type', desc: '"GO" | "KEGG" | "both"，默认 both' },
        { name: 'pvalue_cutoff', desc: 'P 值阈值，默认 0.05' },
        { name: 'organism', desc: '物种名称，默认 oryza sativa（水稻）' },
      ],
      output: '返回 KEGG/GO 富集通路气泡图和可排序结果表格',
    },
    {
      name: 'blast_search',
      label: 'BLAST 序列比对',
      icon: '🧬',
      description: '使用本地 BLAST+ 进行序列比对分析。支持 blastn（核酸比核酸）、blastp（蛋白比蛋白）、blastx（核酸翻译比蛋白）、tblastn（蛋白比核酸翻译）。',
      usage: '帮我比对这条序列：ATGCGATCGATCG... 或拖拽 FASTA 文件到对话框',
      params: [
        { name: 'query', desc: 'FASTA 序列、基因 ID 或上传文件路径' },
        { name: 'program', desc: '"blastn" | "blastp" | "blastx" | "tblastn"，默认 blastn' },
        { name: 'database', desc: '目标数据库名称，默认 MH63' },
        { name: 'evalue', desc: 'E-value 阈值，默认 1e-5' },
        { name: 'max_hits', desc: '最大返回比对数，默认 50' },
      ],
      output: '返回 BLAST 比对命中表格，包含相似度、E-value、覆盖度等',
    },
  ]

  // 渲染消息内容
  const renderMessageContent = (msg: ChatMessage) => {
    // 加载状态
    if (msg.isLoading) {
      return <Spin />
    }

    // /tools 工具列表
    if (msg.content === '__tools_list__') {
      return (
        <div style={{ minWidth: 480, maxWidth: 600 }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            🛠️ 当前可用工具（共 {TOOL_LIST.length} 个）
          </div>
          {TOOL_LIST.map((tool, idx) => (
            <div key={tool.name} style={{
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: 16,
              marginBottom: idx < TOOL_LIST.length - 1 ? 10 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{tool.icon}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-accent)' }}>{tool.label}</span>
                <Tag style={{ marginLeft: 4, fontSize: 11, fontFamily: 'monospace' }}>{tool.name}</Tag>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10, lineHeight: 1.6 }}>
                {tool.description}
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>参数：</span>
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {tool.params.map(p => (
                    <div key={p.name} style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      <code style={{ background: 'rgba(0,212,255,0.1)', padding: '1px 6px', borderRadius: 4, marginRight: 6, fontSize: 11 }}>{p.name}</code>
                      {p.desc}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>输出：</span>{tool.output}
              </div>
              <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(0,212,255,0.08)', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: 'var(--color-accent)' }}>
                示例：{tool.usage}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
            💡 输入 <code style={{ background: 'rgba(0,212,255,0.1)', padding: '1px 6px', borderRadius: 4 }}>/analyze</code> 或直接用自然语言描述分析需求即可调用工具
          </div>
        </div>
      )
    }

    // /datasets 数据集列表
    if (msg.content === '__datasets_list__') {
      return (
        <div style={{ minWidth: 480, maxWidth: 620 }}>
          <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            📂 可用数据集（共 {datasets.length} 个）
          </div>
          {datasets.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>暂无数据集，请先上传数据集。</div>
          ) : datasets.map((ds, idx) => (
            <div key={ds.id} style={{
              background: 'var(--color-bg-input)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: idx < datasets.length - 1 ? 8 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>{ds.name}</span>
                <Tag style={{ fontSize: 11, fontFamily: 'monospace' }}>{ds.id}</Tag>
              </div>
              {ds.description && (
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{ds.description}</div>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
                {ds.gene_count != null && <span>🧬 {ds.gene_count} 基因</span>}
                {ds.sample_count != null && <span>🧪 {ds.sample_count} 样本</span>}
                {ds.groups && (
                  <span>分组：{Object.keys(ds.groups).join(' / ')}</span>
                )}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
            💡 直接描述分析需求，系统会自动匹配合适的数据集
          </div>
        </div>
      )
    }

    // 分析方式选择卡片
    if (msg.type === 'analysis-method-select') {
      return (
        <div style={{ background: 'var(--color-bg-card)', padding: 16, borderRadius: 16, border: '1px solid var(--color-border)', minWidth: 400 }}>
          <div style={{ marginBottom: 12, color: 'var(--color-text-primary)', fontSize: 14, fontWeight: 600 }}>
            请选择差异分析方式：
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              onClick={handleSelectBuiltinDataset}
              style={{
                padding: '14px 16px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
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
              <DatabaseOutlined style={{ fontSize: 20, color: 'var(--color-accent)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>选择内置数据集</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>从已有数据集中选择进行双轨分析</div>
              </div>
            </div>
            <div
              onClick={handleSelectInputSequence}
              style={{
                padding: '14px 16px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
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
              <EditOutlined style={{ fontSize: 20, color: 'var(--color-accent)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>手动输入表达数据</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>粘贴表格格式的基因表达数据</div>
              </div>
            </div>
            <div
              onClick={handleSelectUploadMatrix}
              style={{
                padding: '14px 16px',
                background: 'var(--color-bg-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
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
              <UploadOutlined style={{ fontSize: 20, color: 'var(--color-accent)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>上传表达矩阵文件</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>支持 CSV/TSV 格式文件</div>
              </div>
            </div>
          </div>
        </div>
      )
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

    // 富集分析加载中
    if (msg.type === 'enrichment-loading') {
      return (
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '24px 32px',
          textAlign: 'center',
          minWidth: 300,
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {msg.content}
          </div>
        </div>
      )
    }

    // 富集分析结果
    if (msg.type === 'enrichment-result' && msg.enrichmentResult) {
      return <EnrichmentResultCard result={msg.enrichmentResult} />
    }

    // 富集分析文件确认卡片
    if (msg.type === 'enrichment-file-confirm' && msg.enrichmentFileInfo) {
      const info = msg.enrichmentFileInfo
      return (
        <Card
          size="small"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            maxWidth: 500,
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              检测到 {info.geneCount} 个基因ID
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              文件：{info.filename} ({info.fileType === 'diff_result' ? '差异分析结果' : '基因列表'})
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              预览：{info.genePreview.join(', ')}
              {info.geneCount > info.genePreview.length && ` ...等${info.geneCount}个`}
            </div>
            <Space>
              <Button
                type="primary"
                size="small"
                style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
                onClick={() => handleEnrichmentFileConfirm({
                  filePath: info.filePath,
                  filename: info.filename,
                  geneCount: info.geneCount,
                })}
              >
                开始富集分析
              </Button>
              <Button
                type="text"
                size="small"
                style={{ color: 'var(--color-text-muted)' }}
                onClick={handleEnrichmentFileCancel}
              >
                取消
              </Button>
            </Space>
          </Space>
        </Card>
      )
    }

    // 富集分析提示卡片
    if (msg.type === 'enrichment-prompt' && msg.analysisResult) {
      const totalSig = msg.analysisResult.tool_result.total_significant
        ?? msg.analysisResult.tool_result.significant_genes.length
      return (
        <div style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '16px 20px',
          minWidth: 360,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>🔬</span>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>
              差异分析完成
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            共发现 <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{totalSig}</span> 个显著差异基因。
            <br />是否对全部基因进行 KEGG/GO 富集分析？
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type="primary"
              size="small"
              style={{ borderRadius: 8, background: 'var(--gradient-accent)', border: 'none' }}
              onClick={() => handleEnrichmentFromResult(msg.analysisResult!)}
            >
              立即富集
            </Button>
            <Button
              type="text"
              size="small"
              style={{ color: 'var(--color-text-muted)' }}
              onClick={handleSkipEnrichment}
            >
              跳过
            </Button>
          </div>
        </div>
      )
    }

    // 进度卡片（当有 analysisResult 时显示结果卡片）
    if (msg.type === 'progress' && msg.progress) {
      return (
        <>
          <AnalysisProgress
            progress={msg.progress}
            isAnalyzing={!msg.analysisResult}
            onCancel={handleCancelAnalysis}
            isCancelling={isCancelling}
            canCancel={currentJobId !== null && msg.progress.progress > 50 && msg.progress.progress < 75}
          />
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

    // 检测消息内容是否包含 BLAST 比对数据
    const blastResult = tryParseBlastResult(msg.content)
    if (blastResult) {
      const cleanContent = msg.content.replace(/<!-- BLAST_DATA: .+? -->/, '').trim()
      return (
        <div>
          {cleanContent && (
            <div className="markdown-body" style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              padding: '12px 16px',
              borderRadius: 16,
              lineHeight: 1.6,
              marginBottom: 8,
            }}>
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          )}
          <BlastResultCard result={blastResult} />
        </div>
      )
    }

    // 检测消息内容是否包含富集分析数据
    const enrichmentResult = tryParseEnrichmentResult(msg.content)
    if (enrichmentResult) {
      const cleanContent = msg.content.replace(/<!-- ENRICHMENT_DATA: .+? -->/, '').trim()
      return (
        <div>
          {cleanContent && (
            <div className="markdown-body" style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              padding: '12px 16px',
              borderRadius: 16,
              lineHeight: 1.6,
              marginBottom: 8,
            }}>
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          )}
          <EnrichmentResultCard result={enrichmentResult} />
        </div>
      )
    }

    // 检测消息内容是否为 JSON 格式的分析结果
    const simpleResult = tryParseAnalysisResult(msg.content)
    if (simpleResult) {
      return <AnalysisResultCard result={simpleResult} onGeneClick={handleGeneClick} />
    }

    // 普通文本消息
    const { hasIntent, cleanContent } = msg.role === 'assistant'
      ? parseAnalysisReady(msg.content)
      : { hasIntent: false, cleanContent: msg.content }

    return (
      <div>
        <div style={{
          background: msg.role === 'user' ? 'var(--color-accent)' : 'var(--color-bg-card)',
          color: msg.role === 'user' ? '#fff' : 'var(--color-text-primary)',
          padding: '12px 16px',
          borderRadius: 16,
          lineHeight: 1.6
        }}>
          {msg.role === 'assistant' ? (
            <div className="markdown-body">
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          ) : (
            <>
              {msg.content}
              {msg.attachedFile && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginLeft: msg.content ? 8 : 0,
                  background: 'rgba(255,255,255,0.2)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                }}>
                  <FileOutlined style={{ fontSize: 14 }} />
                  <span>{msg.attachedFile.name}</span>
                </div>
              )}
            </>
          )}
        </div>
        {hasIntent && (
          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => {
                updateCurrentSession(msgs => [...msgs, {
                  id: `${Date.now()}-analysis-method`,
                  role: 'assistant',
                  content: '',
                  timestamp: new Date().toString(),
                  type: 'analysis-method-select',
                }])
              }}
              style={{
                borderRadius: 8,
                background: 'var(--gradient-accent)',
                border: 'none',
              }}
            >
              开始差异分析
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 删除会话
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个会话吗？',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        const newSessions = sessions.filter(s => s.id !== sessionId)
        setSessions(newSessions)
        if (sessionId === currentSessionId) {
          if (newSessions.length > 0) setCurrentSessionId(newSessions[0].id)
          else createNewSession()
        }
      },
    })
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
      <Sider
        width={280}
        collapsedWidth={0}
        collapsed={siderCollapsed}
        breakpoint="md"
        onBreakpoint={(broken) => setSiderCollapsed(broken)}
        trigger={null}
        collapsible
        style={{
          background: '#faf8f5',
          borderRight: '1px solid var(--color-border)',
          height: '100vh',
          overflow: 'auto',
        }}
      >
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
        <GeneDetailModal
          geneId={selectedGene}
          result={selectedResult || undefined}
          open={geneModalOpen}
          onClose={() => setGeneModalOpen(false)}
          // 本体功能已禁用
          // onViewInOntology={(geneId) => {
          //   setGeneModalOpen(false)
          //   setSelectedGene(geneId)
          //   setOntologyNodeId(geneId)
          //   setOntologyModalOpen(true)
          // }}
        />

        {/* 基因信息面板（本体功能已禁用） */}
        {/* <GeneInfoPanel
          geneId={selectedGene}
          open={geneInfoPanelOpen}
          onClose={() => setGeneInfoPanelOpen(false)}
          // onViewDetails={(nodeId) => {
          //   setGeneInfoPanelOpen(false)
          //   setOntologyNodeId(nodeId)
          //   setOntologyModalOpen(true)
          // }}
        /> */}

        {/* 知识本体查询弹窗（已禁用） */}
        {/* <OntologyModal
          open={ontologyModalOpen}
          onClose={() => {
            setOntologyModalOpen(false)
            setOntologyNodeId(undefined)
          }}
          nodeId={ontologyNodeId}
        /> */}

        {/* 分组选择弹窗（上传文件自动推断失败时） */}
        <GroupSelectModal
          open={groupModalOpen}
          columns={pendingUpload?.columns || []}
          onConfirm={handleGroupConfirm}
          onCancel={() => {
            setGroupModalOpen(false)
            setPendingUpload(null)
          }}
        />

        {/* 顶部栏 */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {siderCollapsed && (
              <Button
                type="text"
                icon={<MessageOutlined />}
                onClick={() => setSiderCollapsed(false)}
                style={{ marginRight: 8 }}
              />
            )}
            <img src={iconImg} alt="ABC Logo" width={44} height={44} style={{ borderRadius: '50%' }} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>ABC: Agricultural Breeding Claw</span>
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
            <div style={{ flex: 1, display: 'flex' }}>
              <AnalysisFlowChart />
            </div>
          ) : (
            <div style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: '0 24px' }}>
              {currentSession?.messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 24, display: 'flex', gap: 16, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role !== 'user' && (
                    <Avatar
                      size={36}
                      alt="AI 助手"
                      style={{ background: 'transparent', padding: 0, overflow: 'visible' }}
                      icon={
                        <img src={iconImg} alt="ABC" width={44} height={44} style={{ borderRadius: '50%' }} />
                      }
                    />
                  )}
                  <div style={{ maxWidth: '90%' }}>
                    {msg.role !== 'user' && <div style={{ fontSize: 12, color: 'var(--color-gold)', marginBottom: 4 }}>ABC</div>}
                    {renderMessageContent(msg)}
                  </div>
                  {msg.role === 'user' && <Avatar alt="用户" icon={<UserOutlined />} style={{ background: 'var(--color-accent)' }} />}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div style={{ padding: '0 24px 24px', background: 'var(--color-bg-dark)' }} onDrop={handleDrop} onDragOver={handleDragOver}>
          {/* 命令提示面板 */}
          {showCmdMenu && filteredCmds.length > 0 && (
            <div style={{
              maxWidth: 1050,
              margin: '0 auto 8px',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}>
              {filteredCmds.map((c, idx) => (
                <div
                  key={c.cmd}
                  onClick={() => { setInput(c.cmd); setShowCmdMenu(false); setCmdIndex(0) }}
                  onMouseEnter={() => setCmdIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: idx < filteredCmds.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: idx === cmdIndex ? 'rgba(0,212,255,0.12)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <code style={{ fontSize: 13, color: 'var(--color-accent)', minWidth: 100 }}>{c.cmd}</code>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{c.desc}</span>
                </div>
              ))}
            </div>
          )}
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
            {uploadedFile && (
              <Tag
                closable
                onClose={() => setUploadedFile(null)}
                style={{ marginRight: 8 }}
                color="cyan"
              >
                {uploadedFile.name}
              </Tag>
            )}
            <TextArea
              aria-label="输入分析问题"
              value={input}
              onChange={(e) => {
                const val = e.target.value
                setInput(val)
                setShowCmdMenu(val.startsWith('/') && val.length >= 1)
              }}
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
              aria-label="发送消息"
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

      {/* 隐藏的表达矩阵文件上传输入 */}
      <input
        ref={matrixFileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xls,.xlsx"
        style={{ display: 'none' }}
        onChange={handleMatrixFileChange}
      />
    </Layout>
  )
}
