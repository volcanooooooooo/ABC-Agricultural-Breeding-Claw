import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

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

// Ontology types
export interface OntologyNode {
  id: string
  label: string
  node_type: string
  properties?: Record<string, any>
}

export interface OntologyEdge {
  id: string
  source: string
  target: string
  relation_type: string
}

export interface Ontology {
  id: string
  name: string
  description?: string
  nodes: OntologyNode[]
  edges: OntologyEdge[]
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
    return api.post<ApiResponse<any>>('/chat', payload)
  },
  getHistory: () =>
    api.get<ApiResponse<Message[]>>('/chat/history'),
  clearHistory: () =>
    api.delete<ApiResponse<void>>('/chat/history'),
}

// Ontology API
export const ontologyApi = {
  getAll: () =>
    api.get<ApiResponse<Ontology[]>>('/ontology'),
  getById: (id: string) =>
    api.get<ApiResponse<Ontology>>(`/ontology/${id}`),
  create: (data: Partial<Ontology>) =>
    api.post<ApiResponse<Ontology>>('/ontology', data),
  update: (id: string, data: Partial<Ontology>) =>
    api.put<ApiResponse<Ontology>>(`/ontology/${id}`, data),
  delete: (id: string) =>
    api.delete<ApiResponse<void>>(`/ontology/${id}`),
  searchNodes: (query: string) =>
    api.get<ApiResponse<OntologyNode[]>>('/ontology/nodes/search', { params: { q: query } }),
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
  // 扩展方法 - 双轨分析
  compare: (data: CompareRequest) => api.post<ApiResponse<CompareResponse>>('/analysis/compare', data),
  getResult: (id: string) => api.get<ApiResponse<AnalysisResult>>(`/analysis/results/${id}`),
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
  significant_genes: GeneInfo[]
  all_genes: GeneInfo[]
  execution_time: number
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
  getAll: () => api.get<ApiResponse<Dataset[]>>('/datasets'),
  getById: (id: string) => api.get<ApiResponse<Dataset>>(`/datasets/${id}`),
  upload: (formData: FormData) => api.post<ApiResponse<Dataset>>('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/datasets/${id}`),
}

// Feedback API
export const feedbackApi = {
  getAll: () => api.get<ApiResponse<Feedback[]>>('/feedbacks'),
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

export default api
