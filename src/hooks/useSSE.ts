import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSSEOptions {
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  enabled?: boolean
}

interface UseSSEReturn {
  status: 'connecting' | 'connected' | 'disconnected'
  lastMessage: any | null
  reconnect: () => void
}

export function useSSE(url: string | null, options: UseSSEOptions = {}): UseSSEReturn {
  const { onMessage, onError, onOpen, enabled = true } = options
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!url || !enabled) return

    setStatus('connecting')
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setStatus('connected')
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessage(data)
        onMessage?.(data)
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }

    eventSource.onerror = (error) => {
      setStatus('disconnected')
      onError?.(error)
      // 简单重连逻辑
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connect()
        }
      }, 3000)
    }
  }, [url, enabled, onMessage, onError, onOpen])

  const reconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    connect()
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      eventSourceRef.current?.close()
    }
  }, [connect])

  return { status, lastMessage, reconnect }
}
