import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  groupId?: string
  workspaceId: string
  visibility: string
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

export interface KnowledgeGroup {
  id: string
  name: string
  description?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  title: string
  content: string
  filePath?: string
  fileType?: string
  knowledgeBaseId: string
  chunkCount: number
  createdAt: Date
  updatedAt: Date
}

interface KnowledgeState {
  knowledgeBases: KnowledgeBase[]
  currentKnowledgeBase: KnowledgeBase | null
  documents: Document[]
  groups: KnowledgeGroup[]
  trashItems: KnowledgeBase[]
  isLoading: boolean
  error: string | null
  activeView: 'list' | 'trash'

  // Actions
  fetchKnowledgeBases: (workspaceId: string, userId: string) => Promise<void>
  fetchGroups: () => Promise<void>
  createKnowledgeBase: (data: Partial<KnowledgeBase>) => Promise<KnowledgeBase | null>
  updateKnowledgeBase: (id: string, data: Partial<KnowledgeBase>) => Promise<void>
  deleteKnowledgeBase: (id: string) => Promise<void>
  moveToTrash: (id: string) => Promise<void>
  restoreFromTrash: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  selectKnowledgeBase: (kb: KnowledgeBase) => void

  createGroup: (name: string, description?: string) => Promise<KnowledgeGroup | null>
  updateGroup: (id: string, name: string, description?: string) => Promise<void>
  deleteGroup: (id: string) => Promise<void>
  reorderGroups: (groups: KnowledgeGroup[]) => void
  moveKnowledgeToGroup: (knowledgeId: string, groupId: string | null) => Promise<void>

  fetchDocuments: (knowledgeBaseId: string, userId: string) => Promise<void>
  uploadDocument: (knowledgeBaseId: string, file: File, userId: string) => Promise<Document | null>
  deleteDocument: (documentId: string, userId: string) => Promise<void>
  updateDocument: (id: string, data: Partial<Document>) => Promise<void>
  setActiveView: (view: 'list' | 'trash') => void
}

const getInitialData = () => {
  try {
    const savedGroups = localStorage.getItem('teamilyKnowledgeGroups')
    const savedTrash = localStorage.getItem('teamilyKnowledgeTrash')
    const savedKnowledge = localStorage.getItem('teamilyKnowledge')

    const groups: KnowledgeGroup[] = savedGroups ? JSON.parse(savedGroups) : [
      { id: 'default', name: '默认分组', description: '默认知识库分组', order: 0, createdAt: new Date(), updatedAt: new Date() }
    ]

    let trashItems: KnowledgeBase[] = savedTrash ? JSON.parse(savedTrash) : []
    trashItems = trashItems.map(item => ({
      ...item,
      deletedAt: item.deletedAt ? new Date(item.deletedAt) : undefined
    }))

    return { groups, trashItems }
  } catch (e) {
    return {
      groups: [{ id: 'default', name: '默认分组', description: '默认知识库分组', order: 0, createdAt: new Date(), updatedAt: new Date() }],
      trashItems: []
    }
  }
}

const initialData = getInitialData()

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  currentKnowledgeBase: null,
  documents: [],
  groups: initialData.groups,
  trashItems: initialData.trashItems,
  isLoading: false,
  error: null,
  activeView: 'list',

  fetchKnowledgeBases: async (workspaceId, userId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/knowledge?workspace_id=${workspaceId}&user_id=${userId}`)
      if (response.ok) {
        const data = await response.json()
        const transformedKBs: KnowledgeBase[] = data
          .filter((kb: any) => !kb.deleted_at)
          .map((kb: any) => ({
            id: kb.id,
            name: kb.name,
            description: kb.description,
            groupId: kb.group_id || 'default',
            workspaceId: kb.workspace_id,
            visibility: kb.visibility,
            createdAt: new Date(kb.created_at),
            updatedAt: new Date(kb.updated_at),
          }))

        // 合并本地创建的数据
        const localKBs = JSON.parse(localStorage.getItem('teamilyKnowledge') || '[]') as KnowledgeBase[]
        const mergedKBs = [...transformedKBs]
        localKBs.forEach(localKB => {
          if (!mergedKBs.find(kb => kb.id === localKB.id)) {
            mergedKBs.push(localKB)
          }
        })

        set({ knowledgeBases: mergedKBs, isLoading: false })
      } else {
        throw new Error('Failed to fetch knowledge bases')
      }
    } catch (error: any) {
      // 使用本地数据
      const localKBs = JSON.parse(localStorage.getItem('teamilyKnowledge') || '[]') as KnowledgeBase[]
      set({ knowledgeBases: localKBs.filter(kb => !kb.deletedAt), isLoading: false })
    }
  },

  fetchGroups: async () => {
    try {
      const savedGroups = localStorage.getItem('teamilyKnowledgeGroups')
      if (savedGroups) {
        set({ groups: JSON.parse(savedGroups) })
      }
    } catch (e) {
      console.error('Failed to load groups:', e)
    }
  },

  createKnowledgeBase: async (data) => {
    set({ isLoading: true, error: null })
    const newKB: KnowledgeBase = {
      id: uuidv4(),
      name: data.name || '未命名知识库',
      description: data.description,
      groupId: data.groupId || 'default',
      workspaceId: data.workspaceId || 'default',
      visibility: data.visibility || 'private',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      const response = await fetch(`/api/v1/knowledge?user_id=default-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          group_id: data.groupId || 'default',
          workspace_id: data.workspaceId,
          visibility: data.visibility || 'private',
        }),
      })

      if (response.ok) {
        const createdKB = await response.json()
        const knowledgeBase: KnowledgeBase = {
          id: createdKB.id || newKB.id,
          name: createdKB.name || newKB.name,
          description: createdKB.description,
          groupId: createdKB.group_id || 'default',
          workspaceId: createdKB.workspace_id || newKB.workspaceId,
          visibility: createdKB.visibility,
          createdAt: new Date(createdKB.created_at),
          updatedAt: new Date(createdKB.updated_at),
        }

        set((state) => {
          const newKBs = [...state.knowledgeBases, knowledgeBase]
          localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
          return { knowledgeBases: newKBs, isLoading: false }
        })

        return knowledgeBase
      }
    } catch (e) {
      // 离线模式，本地创建
    }

    set((state) => {
      const newKBs = [...state.knowledgeBases, newKB]
      localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
      return { knowledgeBases: newKBs, isLoading: false }
    })

    return newKB
  },

  updateKnowledgeBase: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/knowledge/${id}?user_id=default-user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          group_id: data.groupId,
          visibility: data.visibility,
        }),
      })

      if (response.ok) {
        const updatedKB = await response.json()
        set((state) => {
          const newKBs = state.knowledgeBases.map((kb) =>
            kb.id === id
              ? { ...kb, name: updatedKB.name, description: updatedKB.description, groupId: updatedKB.group_id, visibility: updatedKB.visibility, updatedAt: new Date(updatedKB.updated_at) }
              : kb
          )
          localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
          return {
            knowledgeBases: newKBs,
            currentKnowledgeBase: state.currentKnowledgeBase?.id === id ? { ...state.currentKnowledgeBase, ...data } : state.currentKnowledgeBase,
            isLoading: false,
          }
        })
      } else {
        throw new Error('Failed to update')
      }
    } catch (error: any) {
      // 离线模式
      set((state) => {
        const newKBs = state.knowledgeBases.map((kb) =>
          kb.id === id ? { ...kb, ...data, updatedAt: new Date() } : kb
        )
        localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
        return {
          knowledgeBases: newKBs,
          currentKnowledgeBase: state.currentKnowledgeBase?.id === id ? { ...state.currentKnowledgeBase, ...data } : state.currentKnowledgeBase,
          isLoading: false,
        }
      })
    }
  },

  deleteKnowledgeBase: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await fetch(`/api/v1/knowledge/${id}?user_id=default-user`, { method: 'DELETE' })
    } catch (e) {
      // 离线模式
    }
    set((state) => {
      const newKBs = state.knowledgeBases.filter((kb) => kb.id !== id)
      localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
      return {
        knowledgeBases: newKBs,
        currentKnowledgeBase: state.currentKnowledgeBase?.id === id ? null : state.currentKnowledgeBase,
        isLoading: false,
      }
    })
  },

  moveToTrash: async (id) => {
    const kb = get().knowledgeBases.find(kb => kb.id === id)
    if (!kb) return

    const trashItem: KnowledgeBase = { ...kb, deletedAt: new Date() }

    set((state) => {
      const newKBs = state.knowledgeBases.filter((kb) => kb.id !== id)
      const newTrash = [...state.trashItems, trashItem]
      localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
      localStorage.setItem('teamilyKnowledgeTrash', JSON.stringify(newTrash))
      return {
        knowledgeBases: newKBs,
        trashItems: newTrash,
        currentKnowledgeBase: state.currentKnowledgeBase?.id === id ? null : state.currentKnowledgeBase,
      }
    })
  },

  restoreFromTrash: async (id) => {
    const trashItem = get().trashItems.find(item => item.id === id)
    if (!trashItem) return

    const restoredKB: KnowledgeBase = { ...trashItem, deletedAt: undefined }

    set((state) => {
      const newTrash = state.trashItems.filter((item) => item.id !== id)
      const newKBs = [...state.knowledgeBases, restoredKB]
      localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
      localStorage.setItem('teamilyKnowledgeTrash', JSON.stringify(newTrash))
      return {
        knowledgeBases: newKBs,
        trashItems: newTrash,
      }
    })
  },

  permanentDelete: async (id) => {
    set((state) => {
      const newTrash = state.trashItems.filter((item) => item.id !== id)
      localStorage.setItem('teamilyKnowledgeTrash', JSON.stringify(newTrash))
      return { trashItems: newTrash }
    })
  },

  emptyTrash: async () => {
    set({ trashItems: [] })
    localStorage.setItem('teamilyKnowledgeTrash', JSON.stringify([]))
  },

  selectKnowledgeBase: (kb) => {
    set({ currentKnowledgeBase: kb })
  },

  // Group Actions
  createGroup: async (name, description) => {
    const newGroup: KnowledgeGroup = {
      id: uuidv4(),
      name,
      description,
      order: get().groups.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    set((state) => {
      const newGroups = [...state.groups, newGroup]
      localStorage.setItem('teamilyKnowledgeGroups', JSON.stringify(newGroups))
      return { groups: newGroups }
    })

    return newGroup
  },

  updateGroup: async (id, name, description) => {
    set((state) => {
      const newGroups = state.groups.map((g) =>
        g.id === id ? { ...g, name, description, updatedAt: new Date() } : g
      )
      localStorage.setItem('teamilyKnowledgeGroups', JSON.stringify(newGroups))
      return { groups: newGroups }
    })
  },

  deleteGroup: async (id) => {
    if (id === 'default') return

    // 将该分组下的知识库移到默认分组
    const kbInGroup = get().knowledgeBases.filter(kb => kb.groupId === id)
    for (const kb of kbInGroup) {
      await get().moveKnowledgeToGroup(kb.id, 'default')
    }

    set((state) => {
      const newGroups = state.groups.filter((g) => g.id !== id)
      localStorage.setItem('teamilyKnowledgeGroups', JSON.stringify(newGroups))
      return { groups: newGroups }
    })
  },

  reorderGroups: (groups) => {
    const reorderedGroups = groups.map((g, index) => ({ ...g, order: index }))
    set({ groups: reorderedGroups })
    localStorage.setItem('teamilyKnowledgeGroups', JSON.stringify(reorderedGroups))
  },

  moveKnowledgeToGroup: async (knowledgeId, groupId) => {
    set((state) => {
      const newKBs = state.knowledgeBases.map((kb) =>
        kb.id === knowledgeId ? { ...kb, groupId: groupId || 'default', updatedAt: new Date() } : kb
      )
      localStorage.setItem('teamilyKnowledge', JSON.stringify(newKBs))
      return { knowledgeBases: newKBs }
    })
  },

  // Document Actions
  fetchDocuments: async (knowledgeBaseId, userId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/knowledge/${knowledgeBaseId}/documents?user_id=${userId}`)
      if (response.ok) {
        const data = await response.json()
        const transformedDocs: Document[] = data.map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          filePath: doc.file_path,
          fileType: doc.file_type,
          knowledgeBaseId: doc.knowledge_base_id,
          chunkCount: doc.chunk_count,
          createdAt: new Date(doc.created_at),
          updatedAt: new Date(doc.updated_at),
        }))
        set({ documents: transformedDocs, isLoading: false })
      } else {
        throw new Error('Failed to fetch documents')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  uploadDocument: async (knowledgeBaseId, file, userId) => {
    set({ isLoading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('knowledge_base_id', knowledgeBaseId)
      formData.append('user_id', userId)

      const response = await fetch('/api/v1/knowledge/documents', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const newDoc = await response.json()
        const document: Document = {
          id: newDoc.id,
          title: newDoc.title,
          content: newDoc.content,
          filePath: newDoc.file_path,
          fileType: newDoc.file_type,
          knowledgeBaseId: newDoc.knowledge_base_id,
          chunkCount: newDoc.chunk_count,
          createdAt: new Date(newDoc.created_at),
          updatedAt: new Date(newDoc.updated_at),
        }

        set((state) => ({
          documents: [...state.documents, document],
          isLoading: false,
        }))

        return document
      } else {
        throw new Error('Failed to upload document')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  deleteDocument: async (documentId, userId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/knowledge/documents/${documentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      if (response.ok) {
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== documentId),
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to delete document')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  updateDocument: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/knowledge/documents/${id}?user_id=default-user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
        }),
      })

      if (response.ok) {
        const updatedDoc = await response.json()
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? { ...doc, title: updatedDoc.title, content: updatedDoc.content, updatedAt: new Date(updatedDoc.updated_at) }
              : doc
          ),
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to update document')
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false })
    }
  },

  setActiveView: (view) => {
    set({ activeView: view })
  },
}))