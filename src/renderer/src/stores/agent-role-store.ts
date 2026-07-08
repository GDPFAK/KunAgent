import { create } from 'zustand'
import type { GuiAgentRoleInfo, GuiAgentRoleCatalogResponse } from '@shared/agent-role'

interface AgentRoleStoreState {
  roles: GuiAgentRoleInfo[]
  activeRoleId: string | null
  defaultRoleId: string | null
  loading: boolean
  error: string | null
  setRoles: (catalog: GuiAgentRoleCatalogResponse) => void
  setActiveRoleId: (roleId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  /** Compute active role info from state. */
  activeRole: () => GuiAgentRoleInfo | undefined
  reset: () => void
}

export const useAgentRoleStore = create<AgentRoleStoreState>((set, get) => ({
  roles: [],
  activeRoleId: null,
  defaultRoleId: null,
  loading: false,
  error: null,
  setRoles: (catalog) =>
    set({
      roles: catalog.roles,
      defaultRoleId: catalog.defaultRoleId,
      activeRoleId: catalog.activeRoleId ?? catalog.defaultRoleId
    }),
  setActiveRoleId: (roleId) => set({ activeRoleId: roleId }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  activeRole: () => {
    const { roles, activeRoleId } = get()
    return roles.find((r) => r.id === activeRoleId)
  },
  reset: () =>
    set({
      roles: [],
      activeRoleId: null,
      defaultRoleId: null,
      loading: false,
      error: null
    })
}))
