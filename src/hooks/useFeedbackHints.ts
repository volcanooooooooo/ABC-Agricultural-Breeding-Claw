// src/hooks/useFeedbackHints.ts
import { useState, useEffect } from 'react'
import { api } from '../api/client'

export interface FeedbackHint {
  id: number
  keyword: string
  track: 'tool' | 'llm'
  hint_type: 'warning' | 'praise'
  summary: string
  frequency: number
}

export function useFeedbackHints(keyword: string | null, track?: 'tool' | 'llm') {
  const [hints, setHints] = useState<FeedbackHint[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!keyword) {
      setHints([])
      return
    }

    const fetchHints = async () => {
      setLoading(true)
      try {
        const params: Record<string, string> = { keyword }
        if (track) params.track = track
        const res = await api.get<{ data: FeedbackHint[] }>('/feedbacks/hints', { params })
        setHints(res.data?.data || [])
      } catch (e) {
        console.error('Failed to fetch hints:', e)
        setHints([])
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(fetchHints, 500)
    return () => clearTimeout(debounce)
  }, [keyword, track])

  return { hints, loading }
}
