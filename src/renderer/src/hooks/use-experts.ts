import { useCallback, useEffect, useState } from 'react'
import { getProvider } from '../agent/registry'

export type ExpertData = {
  id: string
  displayName: { zh: string; en: string }
  profession: { zh: string; en: string }
  description: { zh: string; en: string }
  avatar?: string
  tags: Array<{ zh: string; en: string }>
  categoryId: string
  isOPC?: boolean
  promptFile: string
  quickPrompts?: Array<{ zh: string; en: string }>
  defaultInitPrompt?: { zh: string; en: string }
  plugin?: string
  agentName?: string
}

export type ExpertCategoryData = {
  id: string
  name: { zh: string; en: string }
  description: { zh: string; en: string }
}

type ExpertsState = {
  categories: ExpertCategoryData[]
  experts: ExpertData[]
  loading: boolean
  error: string | null
}

export function useExperts(): ExpertsState {
  const [state, setState] = useState<ExpertsState>({
    categories: [],
    experts: [],
    loading: true,
    error: null
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const provider = getProvider()
        if (!provider || !provider.getExperts) {
          setState({ categories: [], experts: [], loading: false, error: 'No provider' })
          return
        }
        const result = await provider.getExperts()
        if (!cancelled) {
          setState({
            categories: result.categories,
            experts: result.experts,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            categories: [],
            experts: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return state
}

export function useSelectExpert(): {
  selectExpert: (expert: ExpertData) => void
  selectedExpert: ExpertData | null
  clearSelectedExpert: () => void
} {
  const [selectedExpert, setSelectedExpert] = useState<ExpertData | null>(null)

  const selectExpert = useCallback((expert: ExpertData) => {
    setSelectedExpert(expert)
  }, [])

  const clearSelectedExpert = useCallback(() => {
    setSelectedExpert(null)
  }, [])

  return { selectExpert, selectedExpert, clearSelectedExpert }
}
