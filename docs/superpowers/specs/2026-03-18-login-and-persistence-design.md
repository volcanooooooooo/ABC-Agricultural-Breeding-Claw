# 用户登录与对话持久化设计

## 1. 需求概述

为育种 AI 科学家系统添加用户登录功能，实现对话历史持久化，确保每个用户拥有独立的对话记录。

## 2. 功能列表

### 2.1 用户管理
- 用户注册（用户名 + 密码）
- 用户登录（用户名 + 密码）
- 用户退出
- 密码加密存储（bcrypt）

### 2.2 登录状态管理
- 右上角显示登录状态
- 未登录：显示"登录"按钮
- 已登录：显示用户名 + "退出"按钮
- 登录状态持久化（JWT Token）

### 2.3 对话持久化
- 登录后自动保存对话到后端
- 每个用户独立的对话历史
- 重新登录可加载历史对话

## 3. 技术方案

### 3.1 后端技术
- **数据库**：SQLite
- **密码加密**：bcrypt
- **认证**：JWT Token
- **框架**：FastAPI

### 3.2 前端技术
- **状态管理**：React Context
- **存储**：localStorage (Token)
- **UI**：Ant Design

### 3.3 API 设计

#### 认证接口
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户退出 |
| GET | /api/auth/me | 获取当前用户信息 |

#### 对话接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/conversations | 获取用户对话列表 |
| POST | /api/conversations | 创建新对话 |
| GET | /api/conversations/{id} | 获取对话详情 |
| DELETE | /api/conversations/{id} | 删除对话 |

#### 消息接口
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/conversations/{id}/messages | 获取对话消息 |
| POST | /api/conversations/{id}/messages | 发送消息 |

## 4. 数据库设计

### 4.1 用户表 (users)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| username | TEXT | 用户名，唯一 |
| password_hash | TEXT | bcrypt 加密后的密码 |
| created_at | DATETIME | 创建时间 |

### 4.2 对话表 (conversations)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| user_id | INTEGER | 外键，关联 users |
| title | TEXT | 对话标题 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 4.3 消息表 (messages)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| conversation_id | INTEGER | 外键，关联 conversations |
| role | TEXT | user / assistant |
| content | TEXT | 消息内容 |
| timestamp | DATETIME | 时间戳 |

## 5. UI 设计

### 5.1 右上角状态栏
- **未登录**：
  ```
  [登录按钮]
  ```
- **已登录**：
  ```
  [用户名] [退出]
  ```

### 5.2 登录弹窗
- 用户名输入框
- 密码输入框
- 登录按钮
- 注册链接（跳转注册页或弹窗）

### 5.3 对话页面
- 未登录时：输入框禁用，显示提示"请先登录后对话"
- 登录后：正常对话，会话自动保存

## 6. 安全考虑

1. 密码使用 bcrypt 加密存储
2. JWT Token 设置过期时间
3. API 需要认证的接口验证 Token
4. 用户只能操作自己的对话

## 7. 实施步骤

1. 后端：创建数据库模型和认证接口
2. 后端：创建对话和消息接口
3. 前端：添加 Auth Context 管理登录状态
4. 前端：修改右上角显示登录状态
5. 前端：添加登录/注册页面或弹窗
6. 前端：对接后端 API
7. 前端：禁用未登录时的输入框
