import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit, Upload, FileText, Folder, Eye, EyeOff, Save, X, Search, Edit3, RotateCcw, Trash, FolderPlus, ChevronRight, ChevronDown, MoreVertical } from 'lucide-react'
import { useKnowledgeStore, KnowledgeBase, Document, KnowledgeGroup } from '@/stores'
import { useWorkspaceStore } from '@/stores'

interface KnowledgeBaseModalProps {
  isOpen: boolean
  onClose: () => void
  knowledgeBase?: KnowledgeBase | null
  groups: KnowledgeGroup[]
  onGroupChange?: (groupId: string) => void
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose, knowledgeBase, groups, onGroupChange }) => {
  const { createKnowledgeBase, updateKnowledgeBase, isLoading } = useKnowledgeStore()
  const { currentWorkspace } = useWorkspaceStore()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visibility: 'private',
    groupId: 'default',
  })

  useEffect(() => {
    if (isOpen && knowledgeBase) {
      setFormData({
        name: knowledgeBase.name || '',
        description: knowledgeBase.description || '',
        visibility: knowledgeBase.visibility || 'private',
        groupId: knowledgeBase.groupId || 'default',
      })
    } else if (!isOpen) {
      setFormData({
        name: '',
        description: '',
        visibility: 'private',
        groupId: 'default',
      })
    }
  }, [knowledgeBase, isOpen])

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      visibility: formData.visibility,
      groupId: formData.groupId,
      workspaceId: currentWorkspace?.id || '00000000-0000-0000-0000-000000000001',
    }

    try {
      if (knowledgeBase) {
        await updateKnowledgeBase(knowledgeBase.id, data)
      } else {
        await createKnowledgeBase(data)
      }
      onClose()
    } catch (error) {
      console.error('Failed to save knowledge base:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <Folder size={20} className="text-secondary-400" />
            <h2 className="text-lg font-semibold text-white">
              {knowledgeBase ? '编辑知识库' : '创建知识库'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              知识库名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如：产品文档、技术手册"
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="描述这个知识库的用途..."
              rows={3}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">所属分组</label>
            <select
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">可见性</label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="private">私有</option>
              <option value="team">团队</option>
              <option value="readonly">只读</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end p-4 border-t border-dark-100 bg-dark-200/50 gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !formData.name.trim()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface GroupModalProps {
  isOpen: boolean
  onClose: () => void
  group?: KnowledgeGroup | null
}

const GroupModal: React.FC<GroupModalProps> = ({ isOpen, onClose, group }) => {
  const { createGroup, updateGroup, isLoading } = useKnowledgeStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name)
      setDescription(group.description || '')
    } else if (!isOpen) {
      setName('')
      setDescription('')
    }
  }, [group, isOpen])

  const handleSubmit = async () => {
    if (!name.trim()) return
    try {
      if (group) {
        await updateGroup(group.id, name.trim(), description.trim())
      } else {
        await createGroup(name.trim(), description.trim())
      }
      onClose()
    } catch (error) {
      console.error('Failed to save group:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold text-white">{group ? '编辑分组' : '创建分组'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">分组名称 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分组名称"
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入分组描述（可选）"
              rows={3}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end p-4 border-t border-dark-100 bg-dark-200/50 gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface DocumentModalProps {
  isOpen: boolean
  onClose: () => void
  document?: Document | null
}

const DocumentModal: React.FC<DocumentModalProps> = ({ isOpen, onClose, document }) => {
  const { updateDocument, isLoading } = useKnowledgeStore()
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (isOpen && document) {
      setTitle(document.title)
      setContent(document.content || '')
    } else if (!isOpen) {
      setTitle('')
      setContent('')
    }
  }, [document, isOpen])

  const handleSubmit = async () => {
    if (!document) return
    try {
      await updateDocument(document.id, { title, content })
      onClose()
    } catch (error) {
      console.error('Failed to update document:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold text-white">{document ? '编辑文档' : '查看文档'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">文档标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">文档内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-end p-4 border-t border-dark-100 bg-dark-200/50 gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const KnowledgePage: React.FC = () => {
  const {
    knowledgeBases, currentKnowledgeBase, documents, groups, trashItems,
    fetchKnowledgeBases, deleteKnowledgeBase, selectKnowledgeBase,
    fetchDocuments, uploadDocument, deleteDocument, moveToTrash, restoreFromTrash,
    permanentDelete, emptyTrash, fetchGroups, isLoading, activeView, setActiveView,
    createGroup, deleteGroup, moveKnowledgeToGroup
  } = useKnowledgeStore()
  const { workspaces, currentWorkspace, fetchWorkspaces, selectWorkspace } = useWorkspaceStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<KnowledgeGroup | null>(null)
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<Document | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['default']))
  const [showKbMenu, setShowKbMenu] = useState<string | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [movingKb, setMovingKb] = useState<KnowledgeBase | null>(null)

  useEffect(() => {
    fetchWorkspaces()
    fetchGroups()
  }, [fetchWorkspaces, fetchGroups])

  useEffect(() => {
    if (!currentWorkspace && workspaces.length > 0) {
      selectWorkspace(workspaces[0])
    }
  }, [workspaces, currentWorkspace, selectWorkspace])

  useEffect(() => {
    const workspaceId = currentWorkspace?.id || '00000000-0000-0000-0000-000000000001'
    fetchKnowledgeBases(workspaceId, 'default-user')
  }, [currentWorkspace, fetchKnowledgeBases])

  useEffect(() => {
    if (currentKnowledgeBase) {
      fetchDocuments(currentKnowledgeBase.id, 'default-user')
    }
  }, [currentKnowledgeBase])

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }

  const handleCreateKnowledgeBase = () => {
    setEditingKnowledgeBase(null)
    setIsModalOpen(true)
  }

  const handleEditKnowledgeBase = (kb: KnowledgeBase) => {
    setEditingKnowledgeBase(kb)
    setIsModalOpen(true)
    setShowKbMenu(null)
  }

  const handleDeleteKnowledgeBase = async (kb: KnowledgeBase) => {
    if (confirm(`确定要将知识库 "${kb.name}" 移到回收站吗？`)) {
      await moveToTrash(kb.id)
    }
  }

  const handleMoveKnowledgeBase = (kb: KnowledgeBase) => {
    setMovingKb(kb)
    setShowMoveModal(true)
    setShowKbMenu(null)
  }

  const handleConfirmMove = async (groupId: string) => {
    if (movingKb) {
      await moveKnowledgeToGroup(movingKb.id, groupId)
      setShowMoveModal(false)
      setMovingKb(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleFileUpload = async () => {
    if (selectedFile && currentKnowledgeBase) {
      await uploadDocument(currentKnowledgeBase.id, selectedFile, 'default-user')
      setSelectedFile(null)
    }
  }

  const handleDeleteDocument = async (doc: Document) => {
    if (confirm(`确定要删除文档 "${doc.title}" 吗？此操作不可撤销。`)) {
      await deleteDocument(doc.id, 'default-user')
    }
  }

  const handleEditDocument = (doc: Document) => {
    setEditingDocument(doc)
    setIsDocumentModalOpen(true)
  }

  const handleCreateGroup = () => {
    setEditingGroup(null)
    setIsGroupModalOpen(true)
  }

  const handleEditGroup = (group: KnowledgeGroup) => {
    setEditingGroup(group)
    setIsGroupModalOpen(true)
  }

  const handleDeleteGroup = async (group: KnowledgeGroup) => {
    if (group.id === 'default') {
      alert('默认分组不能删除')
      return
    }
    if (confirm(`确定要删除分组 "${group.name}" 吗？该分组下的知识库将移到默认分组。`)) {
      await deleteGroup(group.id)
    }
  }

  const handleRestoreFromTrash = async (kb: KnowledgeBase) => {
    await restoreFromTrash(kb.id)
  }

  const handlePermanentDelete = async (kb: KnowledgeBase) => {
    if (confirm(`确定要永久删除知识库 "${kb.name}" 吗？此操作不可撤销。`)) {
      await permanentDelete(kb.id)
    }
  }

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) return
    if (confirm(`确定要清空回收站吗？${trashItems.length} 个知识库将被永久删除。`)) {
      emptyTrash()
    }
  }

  const getKnowledgeByGroup = (groupId: string) => {
    return knowledgeBases.filter(kb => kb.groupId === groupId)
  }

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (kb.description && kb.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredTrashItems = trashItems.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-dark-100 bg-dark-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Folder size={24} className="text-secondary-400" />
              知识库
            </h1>
            <div className="flex items-center gap-1 bg-dark-200 rounded-lg p-1">
              <button
                onClick={() => setActiveView('list')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${activeView === 'list' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                知识库
              </button>
              <button
                onClick={() => setActiveView('trash')}
                className={`px-3 py-1 text-sm rounded-md transition-colors flex items-center gap-1 ${activeView === 'trash' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <Trash size={14} />
                回收站
                {trashItems.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{trashItems.length}</span>
                )}
              </button>
            </div>
          </div>
          {activeView === 'list' && (
            <button
              onClick={handleCreateKnowledgeBase}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              创建知识库
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeView === 'list' ? '搜索知识库...' : '搜索回收站...'}
            className="w-full pl-10 pr-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {activeView === 'list' ? (
          <>
            {/* Left sidebar - Groups */}
            <div className="w-64 border-r border-dark-100 bg-dark-400 flex flex-col">
              <div className="p-4 border-b border-dark-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-400">分组</h2>
                <button
                  onClick={handleCreateGroup}
                  className="p-1.5 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-white"
                  title="创建分组"
                >
                  <FolderPlus size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {groups.map((group) => {
                  const kbsInGroup = getKnowledgeByGroup(group.id)
                  const isExpanded = expandedGroups.has(group.id)
                  return (
                    <div key={group.id}>
                      <div
                        className="flex items-center justify-between px-4 py-2 hover:bg-dark-200/50 cursor-pointer group"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                          <Folder size={14} className="text-secondary-400" />
                          <span className="text-sm text-white truncate">{group.name}</span>
                          <span className="text-xs text-gray-500">({kbsInGroup.length})</span>
                        </div>
                        {group.id !== 'default' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }}
                              className="p-1 hover:bg-dark-100 rounded transition-colors text-gray-400 hover:text-white"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                              className="p-1 hover:bg-dark-100 rounded transition-colors text-gray-400 hover:text-red-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      {isExpanded && kbsInGroup.length > 0 && (
                        <div className="bg-dark-300/50">
                          {kbsInGroup.map((kb) => (
                            <div
                              key={kb.id}
                              onClick={() => selectKnowledgeBase(kb)}
                              className={`ml-8 mr-2 my-1 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm flex items-center justify-between group ${
                                currentKnowledgeBase?.id === kb.id ? 'bg-primary-600/20 text-white' : 'hover:bg-dark-100 text-gray-300'
                              }`}
                            >
                              <span className="truncate">{kb.name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveKnowledgeBase(kb); }}
                                  className="p-1 hover:bg-dark-200 rounded transition-colors text-gray-400 hover:text-white"
                                  title="移动到其他分组"
                                >
                                  <Folder size={12} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteKnowledgeBase(kb); }}
                                  className="p-1 hover:bg-dark-200 rounded transition-colors text-red-400 hover:text-red-300"
                                  title="删除"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Knowledge base list */}
            <div className="flex-1 bg-dark-400 overflow-y-auto">
              {filteredKnowledgeBases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                  <Folder size={48} className="mb-4 opacity-50" />
                  <p className="text-sm mb-2">还没有知识库</p>
                  <p className="text-xs text-gray-500">选择一个分组或创建新的知识库</p>
                </div>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-4">
                  {filteredKnowledgeBases.map((kb) => (
                    <div
                      key={kb.id}
                      onClick={() => selectKnowledgeBase(kb)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${currentKnowledgeBase?.id === kb.id ? 'bg-primary-600/20 border-primary-500' : 'bg-dark-300 border-dark-100 hover:border-primary-500/50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Folder size={18} className="text-secondary-400" />
                          <span className="font-medium text-white truncate">{kb.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditKnowledgeBase(kb); }}
                            className="p-1.5 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-white"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteKnowledgeBase(kb); }}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 truncate">{kb.description || '无描述'}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className={`flex items-center gap-1 ${kb.visibility === 'private' ? 'text-gray-400' : 'text-blue-400'}`}>
                          {kb.visibility === 'private' ? <EyeOff size={12} /> : <Eye size={12} />}
                          {kb.visibility === 'private' ? '私有' : '公开'}
                        </span>
                        <span>{new Date(kb.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document list */}
            <div className="w-80 border-l border-dark-100 bg-dark-400 overflow-y-auto">
              {currentKnowledgeBase ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">{currentKnowledgeBase.name}</h3>
                    <div>
                      <input type="file" onChange={handleFileChange} className="hidden" id="file-upload" />
                      <label htmlFor="file-upload" className="px-3 py-1.5 bg-secondary-600 hover:bg-secondary-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                        <Upload size={12} />
                        上传
                      </label>
                    </div>
                  </div>
                  {selectedFile && (
                    <div className="mb-4 p-3 bg-dark-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-white truncate">{selectedFile.name}</span>
                      <button onClick={handleFileUpload} disabled={isLoading} className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg">
                        保存
                      </button>
                    </div>
                  )}
                  {documents.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <FileText size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无文档</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="p-3 bg-dark-200 rounded-lg hover:bg-dark-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => handleEditDocument(doc)}>
                              <FileText size={14} className="text-secondary-400" />
                              <span className="text-sm text-white truncate">{doc.title}</span>
                            </div>
                            <button onClick={() => handleDeleteDocument(doc)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Folder size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">选择一个知识库</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Trash view */
          <div className="flex-1 bg-dark-400 overflow-y-auto p-6">
            {trashItems.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">回收站中的项目将在 30 天后自动删除</p>
                <button
                  onClick={handleEmptyTrash}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  清空回收站
                </button>
              </div>
            )}
            {filteredTrashItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Trash size={48} className="mb-4 opacity-50" />
                <p className="text-sm mb-2">回收站是空的</p>
                <p className="text-xs text-gray-500">删除的知识库将出现在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTrashItems.map((kb) => (
                  <div key={kb.id} className="p-4 bg-dark-300 border border-dark-100 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Trash size={18} className="text-gray-500" />
                        <div>
                          <h4 className="font-medium text-white">{kb.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">删除于 {kb.deletedAt ? new Date(kb.deletedAt).toLocaleString() : '未知'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestoreFromTrash(kb)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                          <RotateCcw size={12} />
                          恢复
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(kb)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          永久删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <KnowledgeBaseModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingKnowledgeBase(null); }}
        knowledgeBase={editingKnowledgeBase}
        groups={groups}
      />

      <GroupModal
        isOpen={isGroupModalOpen}
        onClose={() => { setIsGroupModalOpen(false); setEditingGroup(null); }}
        group={editingGroup}
      />

      <DocumentModal
        isOpen={isDocumentModalOpen}
        onClose={() => { setIsDocumentModalOpen(false); setEditingDocument(null); }}
        document={editingDocument}
      />

      {/* Move to group modal */}
      {showMoveModal && movingKb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowMoveModal(false); setMovingKb(null); }} />
          <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-dark-100">
            <div className="flex items-center justify-between p-4 border-b border-dark-100">
              <h2 className="text-lg font-semibold text-white">移动到分组</h2>
              <button onClick={() => { setShowMoveModal(false); setMovingKb(null); }} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleConfirmMove(group.id)}
                  className={`w-full p-3 rounded-lg transition-colors flex items-center gap-2 ${movingKb.groupId === group.id ? 'bg-primary-600/20 border border-primary-500' : 'bg-dark-200 hover:bg-dark-100 border border-transparent'}`}
                >
                  <Folder size={16} className="text-secondary-400" />
                  <span className="text-white">{group.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}