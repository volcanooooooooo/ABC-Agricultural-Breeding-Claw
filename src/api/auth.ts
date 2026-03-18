import { api } from './client'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface User {
  id: number
  username: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export const authApi = {
  login: (data: LoginRequest) => {
    const formData = new FormData()
    formData.append('username', data.username)
    formData.append('password', data.password)
    return api.post<AuthResponse>('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  register: (data: RegisterRequest) => {
    return api.post<User>('/auth/register', data)
  },

  getMe: () => {
    return api.get<User>('/auth/me')
  },

  logout: () => {
    return api.post('/auth/logout', {})
  }
}
