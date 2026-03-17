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
  sendMessage: (data: ChatRequest) =>
    api.post<ApiResponse<ChatResponse>>('/chat', data),
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
}

// Settings API
export const settingsApi = {
  get: () =>
    api.get<ApiResponse<Settings>>('/settings'),
  update: (data: Partial<Settings>) =>
    api.put<ApiResponse<Settings>>('/settings', data),
}

export default api
