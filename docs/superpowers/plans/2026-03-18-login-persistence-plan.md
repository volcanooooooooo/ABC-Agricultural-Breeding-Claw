# 用户登录与对话持久化实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现用户登录功能，支持注册/登录/退出，对话历史持久化到后端数据库

**Architecture:** 后端使用 SQLite + JWT Token，前端使用 React Context 管理登录状态，对话数据通过 API 存储

**Tech Stack:** FastAPI, SQLite, bcrypt, JWT, React, Ant Design

---

## Chunk 1: 后端 - 用户认证模块

**Files:**
- Create: `backend/app/models/user.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 添加后端依赖**

修改: `backend/requirements.txt`

添加：
```
passlib[bcrypt]
python-jose
python-multipart
pydantic
```

- [ ] **Step 2: 创建用户模型**

创建: `backend/app/models/user.py`

```python
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversations = relationship("Conversation", back_populates="user")
```

- [ ] **Step 3: 创建认证路由**

创建: `backend/app/routers/auth.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

router = APIRouter()

# Pydantic models
class UserCreate(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    db_user = User(
        username=user.username,
        password_hash=get_password_hash(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 4: 注册数据库依赖**

创建: `backend/app/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/breeding.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 5: 修改 main.py 添加认证路由**

修改: `backend/app/main.py`

在文件顶部添加导入：
```python
from app.database import init_db
```

在 app = FastAPI() 后添加初始化：
```python
@app.on_event("startup")
def startup():
    init_db()
```

添加路由：
```python
from app.routers import auth
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
```

- [ ] **Step 6: 测试认证接口**

运行后端并测试：
```bash
curl -X POST http://localhost:8003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test123"}'
```

---

## Chunk 2: 后端 - 对话持久化模块

**Files:**
- Create: `backend/app/models/conversation.py`
- Create: `backend/app/routers/conversations.py`
- Modify: `backend/app/models/user.py` (添加 relationship)

- [ ] **Step 1: 创建对话模型**

创建: `backend/app/models/conversation.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="新对话")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
```

- [ ] **Step 2: 创建消息模型**

创建: `backend/app/models/message.py`

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")
```

- [ ] **Step 3: 修改 user.py 添加 relationship**

修改: `backend/app/models/user.py`

添加 import:
```python
from app.models.conversation import Conversation
```

添加 relationship:
```python
conversations = relationship("Conversation", back_populates="user")
```

- [ ] **Step 4: 创建对话路由**

创建: `backend/app/routers/conversations.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.routers.auth import get_current_user

router = APIRouter()

# Pydantic models
class ConversationCreate(BaseModel):
    title: str = "新对话"

class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    role: str
    content: str

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Conversation).filter(Conversation.user_id == current_user.id)\
        .order_by(Conversation.updated_at.desc()).all()

@router.post("/", response_model=ConversationResponse)
def create_conversation(
    conversation: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_conv = Conversation(
        user_id=current_user.id,
        title=conversation.title
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv

@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"status": "deleted"}

@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return db.query(Message).filter(Message.conversation_id == conversation_id)\
        .order_by(Message.timestamp.asc()).all()

@router.post("/{conversation_id}/messages", response_model=MessageResponse)
def create_message(
    conversation_id: int,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db_msg = Message(
        conversation_id=conversation_id,
        role=message.role,
        content=message.content
    )
    db.add(db_msg)

    # Update conversation timestamp
    conv.updated_at = datetime.utcnow()
    if conv.title == "新对话" and message.role == "user":
        conv.title = message.content[:25] + ("..." if len(message.content) > 25 else "")

    db.commit()
    db.refresh(db_msg)
    return db_msg
```

- [ ] **Step 5: 注册对话路由**

修改: `backend/app/main.py`

添加导入：
```python
from app.routers import conversations
```

添加路由：
```python
app.include_router(conversations.router, prefix="/api/conversations", tags=["对话"])
```

- [ ] **Step 6: 测试对话接口**

```bash
# 登录获取 token
curl -X POST http://localhost:8003/api/auth/login \
  -d "username=test&password=test123"

# 创建对话
curl -X POST http://localhost:8003/api/conversations/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Conversation"}'
```

---

## Chunk 3: 前端 - 认证状态管理

**Files:**
- Create: `src/context/AuthContext.tsx`
- Create: `src/api/auth.ts`

- [ ] **Step 1: 创建认证 API**

创建: `src/api/auth.ts`

```typescript
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
```

- [ ] **Step 2: 创建认证上下文**

创建: `src/context/AuthContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi, User } from '../api/auth'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then(res => {
          setUser(res.data)
        })
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password })
    const { access_token, user } = res.data
    localStorage.setItem('token', access_token)
    setToken(access_token)
    setUser(user)
  }

  const register = async (username: string, password: string) => {
    await authApi.register({ username, password })
    await login(username, password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

- [ ] **Step 3: 修改 api/client.ts 添加 token**

修改: `src/api/client.ts`

在 axios 创建后添加请求拦截器：

```typescript
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

---

## Chunk 4: 前端 - 登录页面

**Files:**
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/RegisterPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 创建登录页面**

创建: `src/pages/LoginPage.tsx`

```typescript
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-dark)'
    }}>
      <Card style={{ width: 400, background: 'var(--color-bg-card)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>登录</h2>
        <Form onFinish={handleSubmit} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            还没有账号？ <Link to="/register">立即注册</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: 创建注册页面**

创建: `src/pages/RegisterPage.tsx`

```typescript
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await register(values.username, values.password)
      message.success('注册成功')
      navigate('/')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-dark)'
    }}>
      <Card style={{ width: 400, background: 'var(--color-bg-card)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>注册</h2>
        <Form onFinish={handleSubmit} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              注册
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center' }}>
            已有账号？ <Link to="/login">立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: 修改 App.tsx 添加路由**

修改: `src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import { AuthProvider } from './context/AuthContext'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<ChatPage />} />
      </Routes>
    </AuthProvider>
  )
}

export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
```

---

## Chunk 5: 前端 - 右上角登录状态 + 对话页面集成

**Files:**
- Modify: `src/pages/ChatPage.tsx`

- [ ] **Step 1: 修改 ChatPage 添加登录状态检查**

修改: `src/pages/ChatPage.tsx`

在文件顶部添加导入：
```typescript
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { conversationApi } from '../api/client'
```

添加 conversationApi 定义（在 client.ts 中需要添加）：
```typescript
// Conversation API
export const conversationApi = {
  getAll: () => api.get<any[]>('/conversations/'),
  get: (id: number) => api.get<any>(`/conversations/${id}`),
  create: (title: string) => api.post<any>('/conversations/', { title }),
  delete: (id: number) => api.delete(`/conversations/${id}`),
  getMessages: (id: number) => api.get<any[]>(`/conversations/${id}/messages`),
  addMessage: (id: number, role: string, content: string) =>
    api.post<any>(`/conversations/${id}/messages`, { role, content }),
}
```

修改 ChatPage 组件：
```typescript
// 在组件内添加
const { user, isAuthenticated, logout } = useAuth()
const navigate = useNavigate()
const [currentConversationId, setCurrentConversationId] = useState<string | number | null>(null)

// 登录检查
useEffect(() => {
  if (!isAuthenticated && !loading) {
    navigate('/login')
  }
}, [isAuthenticated, loading])

// 加载对话列表
useEffect(() => {
  if (isAuthenticated) {
    loadConversations()
  }
}, [isAuthenticated])

const loadConversations = async () => {
  try {
    const res = await conversationApi.getAll()
    if (res.data.length > 0) {
      setCurrentConversationId(res.data[0].id)
      loadMessages(res.data[0].id)
    } else {
      // 创建新对话
      const newConv = await conversationApi.create('新对话')
      setCurrentConversationId(newConv.data.id)
    }
  } catch (e) {
    console.error(e)
  }
}

const loadMessages = async (convId: number) => {
  try {
    const res = await conversationApi.getMessages(convId)
    // 将消息转换为本地格式
    if (res.data.length > 0) {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return {
            ...s,
            messages: res.data.map((m: any) => ({
              id: m.id.toString(),
              role: m.role,
              content: m.content,
              timestamp: m.timestamp
            }))
          }
        }
        return s
      }))
    }
  } catch (e) {
    console.error(e)
  }
}
```

修改发送消息逻辑：
```typescript
// 发送消息时保存到后端
const handleSend = async () => {
  if (!input.trim() || loading || !currentSessionId) return

  // 如果未登录，跳转登录
  if (!isAuthenticated) {
    navigate('/login')
    return
  }

  // ... 原有逻辑 ...

  // 发送消息到后端
  if (currentConversationId) {
    try {
      await conversationApi.addMessage(Number(currentConversationId), 'user', userMessage.content)
    } catch (e) {
      console.error(e)
    }
  }
}
```

修改右上角显示：
```typescript
// 替换原有的右上角部分
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  {isAuthenticated ? (
    <>
      <span style={{ color: 'var(--color-text-primary)' }}>{user?.username}</span>
      <Button type="text" onClick={logout}>退出</Button>
    </>
  ) : (
    <Button type="primary" onClick={() => navigate('/login')}>登录</Button>
  )}
</div>
```

修改输入框禁用状态：
```typescript
disabled={loading || !isAuthenticated}
placeholder={!isAuthenticated ? "请先登录后对话" : (hasMessages ? "输入消息..." : "请描述您的问题或分析需求...")}
```

- [ ] **Step 2: 测试登录流程**

1. 访问 http://localhost:3003
2. 应该自动跳转到登录页面
3. 点击"立即注册"进行注册
4. 注册成功后跳转到对话页面
5. 右上角显示用户名和退出按钮

---

## 完成

所有步骤完成后，用户可以：
1. 注册新账号
2. 登录系统
3. 对话自动保存到后端
4. 重新登录可以加载历史对话
5. 点击退出清除登录状态
