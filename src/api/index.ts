import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000
})

// 对话 API
export const chatApi = {
  send: (messages: { role: string; content: string }[], context?: any) =>
    api.post('/chat/', { messages, context })
}

// 本体 API
export const ontologyApi = {
  getGraph: () => api.get('/ontology/graph'),
  getList: (nodeType?: string) => api.get('/ontology', { params: { node_type: nodeType } }),
  getNode: (id: string) => api.get(`/ontology/${id}`),
  createNode: (data: any) => api.post('/ontology/nodes', data),
  updateNode: (id: string, data: any) => api.put(`/ontology/nodes/${id}`, data),
  deleteNode: (id: string) => api.delete(`/ontology/nodes/${id}`),
  createEdge: (source: string, target: string, relation: string) =>
    api.post('/ontology/edges', { source, target, relation }),
  deleteEdge: (source: string, target: string) =>
    api.delete('/ontology/edges', { params: { source, target } })
}

// 分析 API
export const analysisApi = {
  listFiles: () => api.get('/analysis/files'),
  getDataInfo: (filePath: string) => api.get('/analysis/info', { params: { file_path: filePath } }),
  run: (analysisType: string, filePath: string, columns?: string[], params?: any) =>
    api.post('/analysis/run', { analysis_type: analysisType, file_path: filePath, columns, params }),
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/analysis/upload', formData)
  }
}

// 配置 API
export const configApi = {
  getLlmConfig: () => api.get('/config/llm'),
  updateLlmConfig: (config: any) => api.put('/config/llm', config),
  testLlm: () => api.post('/config/llm/test')
}

export default api
