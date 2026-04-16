import { useState, useRef, useCallback, useEffect } from 'react'

interface UseSSEOptions {
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: () => void
}

interface UseSSEReturn {
  status: 'connected' | 'connecting' | 'disconnected'
  reconnect: () => void
  close: () => void
}

const MAX_RETRIES = 5
const BASE_DELAY = 1000 // 1 second

export function useSSE(url: string | null, options: UseSSEOptions = {}): UseSSEReturn {
  const { onMessage, onError, onOpen } = options
  const [status, setStatus] = useState<UseSSEReturn['status']>('disconnected')
  const eventSourceRef = useRef<EventSource | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const close = useCallback(() => {
    clearRetryTimer()
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setStatus('disconnected')
  }, [clearRetryTimer])

  const connect = useCallback(() => {
    if (!url) return
    close()
    setStatus('connecting')

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setStatus('connected')
      retryCountRef.current = 0 // reset on successful connection
      onOpen?.()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
      } catch (e) {
        console.warn('SSE JSON parse error:', e)
      }
    }

    eventSource.onerror = (error) => {
      setStatus('disconnected')
      onError?.(error)

      if (eventSource.readyState === EventSource.CLOSED) {
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current), 30000)
          retryCountRef.current++
          retryTimerRef.current = setTimeout(() => connect(), delay)
        }
      }
    }
  }, [url, onMessage, onError, onOpen, close])

  const reconnect = useCallback(() => {
    retryCountRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    if (url) connect()
    return () => close()
  }, [url]) // intentionally only depend on url

  return { status, reconnect, close }
}
