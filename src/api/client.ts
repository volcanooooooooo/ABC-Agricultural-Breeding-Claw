import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截器 - 自动添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理401未授权
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // 可以在这里触发重新登录
    }
    // 超时友好提示
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.friendlyMessage = '请求超时，请检查网络连接后重试'
    }
    // 网络断开
    else if (!error.response) {
      error.friendlyMessage = '网络连接失败，请检查网络后重试'
    }
    // 服务端错误
    else if (error.response?.status >= 500) {
      error.friendlyMessage = error.response.data?.detail || '服务器暂时不可用，请稍后重试'
    }
    return Promise.reject(error)
  }
)

// Response types
export interface ApiResponse<T> {
  status: string
  data: T
  message?: string
}

// Chat types
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatRequest {
  message: string
  context?: {
    ontology_ids?: string[]
    data_source?: string
  }
}

export interface ChatResponse {
  response: string
  references?: string[]
}

// Ontology types - 匹配后端 Pydantic 模型
export type OntologyNodeType =
  | 'Dataset' | 'Sample' | 'Gene' | 'Measurement'
  | 'ProcessStep' | 'Tool' | 'Result' | 'Conclusion'
  | 'genotype' | 'trait' | 'metabolome' | 'environment' | 'method'

export interface OntologyNode {
  id: string
  type: OntologyNodeType
  name: string
  properties?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface OntologyEdge {
  source: string
  target: string
  relation: string
}

export interface OntologyGraph {
  nodes: OntologyNode[]
  edges: OntologyEdge[]
}

export interface OntologyListResponse {
  total: number
  items: OntologyNode[]
}

// Analysis types
export interface DataSource {
  id: string
  name: string
  type: string
  description?: string
}

export interface AnalysisResult {
  id: string
  name: string
  type: string
  data: any
  created_at: string
}

export interface AnalysisResultSummary {
  id: string
  dataset_id: string
  dataset_name: string
  created_at: string
  feedback_count: number
  avg_rating: number
}

// Settings types
export interface Settings {
  llm_provider: string
  llm_api_key?: string
  theme: 'light' | 'dark'
  language: string
}

// Chat API
export const chatApi = {
  sendMessage: (data: ChatRequest) => {
    // 转换格式以匹配后端 API
    const payload = {
      messages: [{ role: 'user', content: data.message }]
    }
    return api.post<ApiResponse<any>>('/chat/', payload)
  },
  getHistory: () =>
    api.get<ApiResponse<Message[]>>('/chat/history'),
  clearHistory: () =>
    api.delete<ApiResponse<void>>('/chat/history'),
}

// Ontology API - 匹配后端 /api/ontology 路由
export const ontologyApi = {
  // 获取完整图谱
  getGraph: () =>
    api.get<OntologyGraph>('/ontology/'),

  // 获取节点列表（支持 type 过滤）
  getNodes: (type?: OntologyNodeType) =>
    api.get<OntologyListResponse>('/ontology/nodes', {
      params: type ? { type } : undefined
    }),

  // 获取单个节点
  getNode: (nodeId: string) =>
    api.get<OntologyNode>(`/ontology/nodes/${nodeId}`),

  // 获取边列表（支持 source/target 过滤）
  getEdges: (params?: { source?: string; target?: string }) =>
    api.get<{ total: number; items: OntologyEdge[] }>('/ontology/edges', { params }),

  // 获取节点的所有关联
  getNodeRelations: (nodeId: string) =>
    api.get<{ incoming: OntologyEdge[]; outgoing: OntologyEdge[] }>(`/ontology/nodes/${nodeId}/relations`),

  // 搜索节点
  searchNodes: (keyword: string) =>
    api.get<{ total: number; items: OntologyNode[] }>('/ontology/search', { params: { keyword } }),
}

// Analysis API
export const analysisApi = {
  getDataSources: () =>
    api.get<ApiResponse<DataSource[]>>('/analysis/datasources'),
  runAnalysis: (data: { source_id: string; analysis_type: string; params?: any }) =>
    api.post<ApiResponse<AnalysisResult>>('/analysis/run', data),
  getResults: () =>
    api.get<ApiResponse<AnalysisResult[]>>('/analysis/results'),
  getResultById: (id: string) =>
    api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
  // 新增：按基因获取分析结果列表
  getResultsByGene: (geneId: string) =>
    api.get<ApiResponse<AnalysisResultSummary[]>>('/analysis/results', { params: { gene_id: geneId } }),
  // 扩展方法 - 双轨分析
  compare: (data: CompareRequest) => api.post<ApiResponse<CompareResponse>>('/analysis/compare', data),
  getResult: (id: string) => api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
  // 取消分析
  cancel: (jobId: string) => api.post<ApiResponse<{ status: string; message: string }>>(`/analysis/cancel/${jobId}`),
  // 富集分析（直接调用，不经过 Agent）
  runEnrichment: (geneList: string[], analysisType?: string, pvalueCutoff?: number) =>
    api.post<ApiResponse<any>>('/analysis/enrichment', {
      gene_list: geneList,
      analysis_type: analysisType ?? 'both',
      pvalue_cutoff: pvalueCutoff ?? 0.05,
    }),
  // FASTA 文件上传（用于 BLAST）
  uploadFasta: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{ file_path: string; filename: string }>>('/analysis/upload-fasta', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // 表达矩阵文件上传（用于差异分析）
  uploadMatrix: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{
      file_path: string
      filename: string
      columns: string[]
      row_count: number
      suggested_groups: Record<string, string[]> | null
    }>>('/analysis/upload-matrix', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // 基因列表文件上传（用于富集分析）
  uploadGeneList: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ApiResponse<{
      file_path: string
      filename: string
      gene_count: number
      gene_preview: string[]
      file_type: 'gene_list' | 'diff_result'
    }>>('/analysis/upload-genelist', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // 注册临时数据集（上传文件 → 双轨分析）
  registerTemp: (filePath: string, filename: string, groups: Record<string, string[]>) =>
    api.post<ApiResponse<Dataset>>('/analysis/register-temp', {
      file_path: filePath,
      filename: filename,
      groups: groups,
    }),
}

// Dataset types
export interface Dataset {
  id: string
  name: string
  description?: string
  data_type: string
  file_path: string
  file_size?: number
  gene_count: number
  sample_count: number
  groups: Record<string, string[]>
  owner?: string
  created_at: string
  updated_at: string
}

// Analysis types (扩展)
export interface GeneInfo {
  gene_id: string
  expression_change: 'up' | 'down' | 'none'
  log2fc?: number
  pvalue?: number
  reason?: string
}

export interface ToolResult {
  method: string
  significant_genes: GeneInfo[]   // TOP10上调 + TOP10下调（展示用）
  all_significant_genes?: GeneInfo[]  // 完整列表（可选）
  all_genes: GeneInfo[]
  execution_time: number
  total_significant?: number       // 完整显著基因总数
}

export interface LLMResult {
  model: string
  significant_genes: GeneInfo[]
  reasoning: string
  execution_time: number
}

export interface ConsistencyInfo {
  overlap: string[]
  tool_only: string[]
  llm_only: string[]
  overlap_rate: number
}

export interface AnalysisResult {
  id: string
  dataset_id: string
  dataset_name: string
  group_control: string
  group_treatment: string
  tool_result: ToolResult
  llm_result: LLMResult
  consistency: ConsistencyInfo
  created_at: string
}

export interface CompareRequest {
  dataset_id: string
  group_control: string
  group_treatment: string
  pvalue_threshold?: number
  log2fc_threshold?: number
}

export interface CompareResponse {
  job_id: string
  status: string
}

// Feedback types
export interface Feedback {
  id: string
  analysis_id: string
  track: 'tool' | 'llm'
  rating: 'positive' | 'negative'
  comment?: string
  gene_ids?: string[]
  created_by?: string
  created_at: string
}

// Dataset API
export const datasetApi = {
  getAll: () => api.get<Dataset[]>('/datasets'),
  getById: (id: string) => api.get<ApiResponse<Dataset>>(`/datasets/${id}`),
  upload: (formData: FormData) => api.post<ApiResponse<Dataset>>('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/datasets/${id}`),
}

// Feedback API
export const feedbackApi = {
  getAll: () => api.get<ApiResponse<Feedback[]>>('/feedbacks'),
  getByAnalysis: (analysisId: string) =>
    api.get<ApiResponse<Feedback[]>>('/feedbacks', { params: { analysis_id: analysisId } }),
  create: (data: Omit<Feedback, 'id' | 'created_at'>) => api.post<ApiResponse<Feedback>>('/feedbacks', data),
}

// Settings API
export const settingsApi = {
  get: () =>
    api.get<ApiResponse<any>>('/config/llm'),
  update: (data: Partial<Settings>) =>
    api.patch<ApiResponse<any>>('/config/llm', data),
  testConnection: () =>
    api.post<ApiResponse<{ success: boolean; message: string; response?: string }>>('/config/llm/test'),
}

export { api }
export default api
