import { useEffect, useState } from 'react'
import { rendererRuntimeClient } from '../../agent/runtime-client'

export function useAvatar(avatarPath: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!avatarPath) {
      setUrl(null)
      return
    }
    const filename = avatarPath.split('/').pop() ?? avatarPath
    let cancelled = false
    const fetchAvatar = async () => {
      try {
        const result = await rendererRuntimeClient.runtimeRequest(
          `/v1/experts/avatars/${encodeURIComponent(filename)}`,
          'GET'
        )
        if (cancelled) return
        if (result.ok) {
          const blob = new Blob([result.body], { type: 'image/png' })
          setUrl(URL.createObjectURL(blob))
        } else {
          setUrl(null)
        }
      } catch {
        if (!cancelled) setUrl(null)
      }
    }
    fetchAvatar()
    return () => {
      cancelled = true
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [avatarPath])

  return url
}
