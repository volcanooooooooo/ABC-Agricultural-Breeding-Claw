import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User, LoginRequest, RegisterRequest } from '../api/auth'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (data: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authApi.getMe()
        .then(res => {
          setUser(res.data)
        })
        .catch(() => {
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (data: LoginRequest) => {
    const res = await authApi.login(data)
    const { access_token, user: userData } = res.data
    localStorage.setItem('token', access_token)
    setUser(userData)
  }

  const register = async (data: RegisterRequest) => {
    await authApi.register(data)
    // 注册后自动登录
    await login({ username: data.username, password: data.password })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
