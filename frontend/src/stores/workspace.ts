import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface Workspace {
  id: string
  name: string
  description?: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface Department {
  id: string
  name: string
  description?: string
  workspaceId: string
  createdAt: Date
  updatedAt: Date
}

interface WorkspaceState {
  workspaces: Workspace[]
  departments: Department[]
  currentWorkspace: Workspace | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchWorkspaces: () => Promise<void>
  createWorkspace: (data: Partial<Workspace>) => Promise<Workspace | null>
  selectWorkspace: (workspace: Workspace) => void
  fetchDepartments: (workspaceId: string) => Promise<void>
  createDepartment: (data: Partial<Department>) => Promise<Department | null>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  departments: [],
  currentWorkspace: null,
  isLoading: false,
  error: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/workspaces')
      if (response.ok) {
        const data = await response.json()
        set({ workspaces: data, isLoading: false })
      } else {
        throw new Error('Failed to fetch workspaces')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  createWorkspace: async (data: Partial<Workspace>) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
        }),
      })

      if (response.ok) {
        const newWorkspace = await response.json()
        const workspace: Workspace = {
          id: newWorkspace.id,
          name: newWorkspace.name,
          description: newWorkspace.description,
          ownerId: newWorkspace.owner_id,
          createdAt: new Date(newWorkspace.created_at),
          updatedAt: new Date(newWorkspace.updated_at),
        }

        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          isLoading: false,
        }))

        return workspace
      } else {
        throw new Error('Failed to create workspace')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  selectWorkspace: (workspace: Workspace) => {
    set({ currentWorkspace: workspace })
    get().fetchDepartments(workspace.id)
  },

  fetchDepartments: async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/v1/departments?workspace_id=${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        set({ departments: data })
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  },

  createDepartment: async (data: Partial<Department>) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          workspace_id: data.workspaceId,
        }),
      })

      if (response.ok) {
        const newDepartment = await response.json()
        const department: Department = {
          id: newDepartment.id,
          name: newDepartment.name,
          description: newDepartment.description,
          workspaceId: newDepartment.workspace_id,
          createdAt: new Date(newDepartment.created_at),
          updatedAt: new Date(newDepartment.updated_at),
        }

        set((state) => ({
          departments: [...state.departments, department],
          isLoading: false,
        }))

        return department
      } else {
        throw new Error('Failed to create department')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },
}))
