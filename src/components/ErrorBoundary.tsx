import React, { Component, ErrorInfo } from 'react'
import { Button, Result } from 'antd'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'var(--color-bg-dark)',
        }}>
          <Result
            status="error"
            title="页面出现了问题"
            subTitle="抱歉，页面发生了意外错误。请尝试刷新页面或返回首页。"
            extra={[
              <Button key="reload" type="primary" onClick={() => window.location.reload()}>
                刷新页面
              </Button>,
              <Button key="home" onClick={() => { window.location.href = '/' }}>
                返回首页
              </Button>,
            ]}
          />
        </div>
      )
    }
    return this.props.children
  }
}
