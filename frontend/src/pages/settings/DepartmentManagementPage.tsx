import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building, Plus, Edit, Trash2, Save, X, Loader2, AlertCircle, CheckCircle, Briefcase, ChevronRight, GripVertical } from 'lucide-react'
import { useDepartmentStore, Department, Job } from '@/stores/department'
import { useAgentStore } from '@/stores'

export const DepartmentManagementPage: React.FC = () => {
  const navigate = useNavigate()
  const { departments, jobs, fetchDepartments, fetchJobs, createDepartment, updateDepartment, deleteDepartment, createJob, updateJob, deleteJob, reorderDepartments } = useDepartmentStore()
  const { fetchAgents } = useAgentStore()

  const [activeTab, setActiveTab] = useState<'departments' | 'jobs'>('departments')
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [showAddDepartmentModal, setShowAddDepartmentModal] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [showAddJobModal, setShowAddJobModal] = useState(false)
  const [departmentFormData, setDepartmentFormData] = useState({ name: '', description: '' })
  const [jobFormData, setJobFormData] = useState({ name: '', departmentId: '00000000-0000-0000-0000-000000000003', description: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItem, setDraggedItem] = useState<Department | null>(null)
  const [draggedOverItem, setDraggedOverItem] = useState<Department | null>(null)

  useEffect(() => {
    fetchDepartments()
    fetchJobs()
  }, [])

  // Department handlers
  const handleAddDepartment = async () => {
    setError('')
    setSuccess('')
    if (!departmentFormData.name.trim()) {
      setError('请输入部门名称')
      return
    }
    try {
      await createDepartment(departmentFormData.name, departmentFormData.description)
      await fetchDepartments()
      setSuccess('部门创建成功')
      setDepartmentFormData({ name: '', description: '' })
      setShowAddDepartmentModal(false)
    } catch (err) {
      setError('部门创建失败，请重试')
    }
  }

  const handleUpdateDepartment = async () => {
    setError('')
    setSuccess('')
    if (!departmentFormData.name.trim()) {
      setError('请输入部门名称')
      return
    }
    if (!editingDepartment) return
    try {
      await updateDepartment(editingDepartment.id, departmentFormData.name, departmentFormData.description)
      await fetchDepartments()
      setSuccess('部门更新成功')
      setEditingDepartment(null)
      setDepartmentFormData({ name: '', description: '' })
    } catch (err) {
      setError('部门更新失败，请重试')
    }
  }

  const handleDeleteDepartment = async (id: string) => {
    if (id === '00000000-0000-0000-0000-000000000002') {
      alert('内置部门不能删除')
      return
    }
    if (confirm('确定要删除这个部门吗？该部门的员工将被移动到"内置"部门。')) {
      try {
        const savedAgents = localStorage.getItem('teamilyAgents')
        if (savedAgents) {
          const agents = JSON.parse(savedAgents)
          const updatedAgents = agents.map((agent: any) => {
            if (agent.departmentId === id) {
              return { ...agent, departmentId: '00000000-0000-0000-0000-000000000002' }
            }
            return agent
          })
          localStorage.setItem('teamilyAgents', JSON.stringify(updatedAgents))
          useAgentStore.setState({ agents: updatedAgents })
        }
        await deleteDepartment(id)
        await fetchAgents()
        await fetchDepartments()
      } catch (err) {
        alert('删除失败，请重试')
      }
    }
  }

  const openEditDepartmentModal = (department: Department) => {
    setEditingDepartment(department)
    setDepartmentFormData({ name: department.name, description: department.description || '' })
  }

  // Job handlers
  const handleAddJob = async () => {
    setError('')
    setSuccess('')
    if (!jobFormData.name.trim()) {
      setError('请输入岗位名称')
      return
    }
    try {
      await createJob(jobFormData.name, jobFormData.departmentId, jobFormData.description)
      await fetchJobs()
      setSuccess('岗位创建成功')
      setJobFormData({ name: '', departmentId: '00000000-0000-0000-0000-000000000003', description: '' })
      setShowAddJobModal(false)
    } catch (err) {
      setError('岗位创建失败，请重试')
    }
  }

  const handleUpdateJob = async () => {
    setError('')
    setSuccess('')
    if (!jobFormData.name.trim()) {
      setError('请输入岗位名称')
      return
    }
    if (!editingJob) return
    try {
      await updateJob(editingJob.id, jobFormData.name, jobFormData.departmentId, jobFormData.description)
      await fetchJobs()
      setSuccess('岗位更新成功')
      setEditingJob(null)
      setJobFormData({ name: '', departmentId: '00000000-0000-0000-0000-000000000003', description: '' })
    } catch (err) {
      setError('岗位更新失败，请重试')
    }
  }

  const handleDeleteJob = async (id: string) => {
    if (confirm('确定要删除这个岗位吗？')) {
      try {
        await deleteJob(id)
        await fetchJobs()
      } catch (err) {
        alert('删除失败，请重试')
      }
    }
  }

  const openEditJobModal = (job: Job) => {
    setEditingJob(job)
    setJobFormData({ name: job.name, departmentId: job.departmentId, description: job.description || '' })
  }

  const handleCancel = () => {
    setEditingDepartment(null)
    setShowAddDepartmentModal(false)
    setEditingJob(null)
    setShowAddJobModal(false)
    setDepartmentFormData({ name: '', description: '' })
    setJobFormData({ name: '', departmentId: '00000000-0000-0000-0000-000000000003', description: '' })
    setError('')
    setSuccess('')
  }

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find(d => d.id === departmentId)
    return dept ? dept.name : '未知部门'
  }

  // 拖拽排序相关
  const handleDragStart = (e: React.DragEvent, department: Department) => {
    if (department.id === '00000000-0000-0000-0000-000000000002') {
      e.preventDefault()
      return
    }
    setIsDragging(true)
    setDraggedItem(department)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, department: Department) => {
    e.preventDefault()
    if (department.id === '00000000-0000-0000-0000-000000000002') {
      return
    }
    setDraggedOverItem(department)
  }

  const handleDrop = (e: React.DragEvent, targetDepartment: Department) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.id === targetDepartment.id || targetDepartment.id === '00000000-0000-0000-0000-000000000002') {
      setIsDragging(false)
      setDraggedItem(null)
      setDraggedOverItem(null)
      return
    }

    const newDepartments = [...departments]
    const draggedIndex = newDepartments.findIndex(d => d.id === draggedItem.id)
    const targetIndex = newDepartments.findIndex(d => d.id === targetDepartment.id)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newDepartments.splice(draggedIndex, 1)
      newDepartments.splice(targetIndex, 0, draggedItem)
      reorderDepartments(newDepartments)
    }

    setIsDragging(false)
    setDraggedItem(null)
    setDraggedOverItem(null)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDraggedItem(null)
    setDraggedOverItem(null)
  }

  return (
    <div className="h-full bg-dark-400 overflow-y-auto">
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/settings')} className="p-2 hover:bg-dark-200 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">部门与岗位管理</h1>
              <p className="text-sm text-gray-400">管理部门和岗位信息</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'departments'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-300 text-gray-400 hover:text-white'
            }`}
          >
            <Building size={16} className="inline mr-2" />
            部门管理
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'jobs'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-300 text-gray-400 hover:text-white'
            }`}
          >
            <Briefcase size={16} className="inline mr-2" />
            岗位管理
          </button>
        </div>

        {activeTab === 'departments' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">部门列表</h2>
              <button
                onClick={() => { setShowAddDepartmentModal(true); setDepartmentFormData({ name: '', description: '' }); setError(''); setSuccess(''); }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                添加部门
              </button>
            </div>

            <div className="bg-dark-300 border border-dark-100 rounded-xl p-4">
              {departments.length === 0 ? (
                <p className="text-center text-gray-400 py-10">暂无部门数据</p>
              ) : (
                <div className="divide-y divide-dark-100">
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className={`py-4 flex items-center justify-between ${
                        isDragging && draggedOverItem?.id === dept.id
                          ? 'bg-primary-500/10 border-l-4 border-primary-500'
                          : ''
                      }`}
                      draggable={dept.id !== '00000000-0000-0000-0000-000000000002'}
                      onDragStart={(e) => handleDragStart(e, dept)}
                      onDragOver={(e) => handleDragOver(e, dept)}
                      onDrop={(e) => handleDrop(e, dept)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center gap-3">
                        {dept.id !== '00000000-0000-0000-0000-000000000002' && (
                          <div className="cursor-move text-gray-500">
                            <GripVertical size={16} />
                          </div>
                        )}
                        <div className="w-10 h-10 bg-secondary-600 rounded-lg flex items-center justify-center">
                          <Building size={20} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{dept.name}</h3>
                          {dept.description && <p className="text-sm text-gray-400 mt-1">{dept.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {dept.id !== '00000000-0000-0000-0000-000000000002' && (
                          <button onClick={() => openEditDepartmentModal(dept)} className="p-2 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-white">
                            <Edit size={16} />
                          </button>
                        )}
                        {dept.id !== '00000000-0000-0000-0000-000000000002' && (
                          <button onClick={() => handleDeleteDepartment(dept.id)} className="p-2 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-red-400">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-white">岗位列表</h2>
              <button
                onClick={() => { setShowAddJobModal(true); setJobFormData({ name: '', departmentId: '00000000-0000-0000-0000-000000000003', description: '' }); setError(''); setSuccess(''); }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                添加岗位
              </button>
            </div>

            <div className="bg-dark-300 border border-dark-100 rounded-xl p-4">
              {jobs.length === 0 ? (
                <p className="text-center text-gray-400 py-10">暂无岗位数据</p>
              ) : (
                <div className="divide-y divide-dark-100">
                  {jobs.map((job) => (
                    <div key={job.id} className="py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                            <Briefcase size={20} className="text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-medium">{job.name}</h3>
                            {job.description && <p className="text-sm text-gray-400 mt-1">{job.description}</p>}
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          <span className="px-2 py-0.5 bg-dark-200 rounded">部门: {getDepartmentName(job.departmentId)}</span>
                          <span>创建于: {new Date(job.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditJobModal(job)} className="p-2 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-white">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteJob(job.id)} className="p-2 hover:bg-dark-200 rounded-lg transition-colors text-gray-400 hover:text-red-400">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Department Modal */}
      {(showAddDepartmentModal || editingDepartment) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />
          <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-dark-100">
            <div className="flex items-center justify-between p-4 border-b border-dark-100">
              <h2 className="text-lg font-semibold text-white">
                {editingDepartment ? '编辑部门' : '添加部门'}
              </h2>
              <button onClick={handleCancel} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm mb-4">
                  <CheckCircle size={16} />
                  {success}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    部门名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={departmentFormData.name}
                    onChange={(e) => setDepartmentFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入部门名称"
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">部门描述</label>
                  <textarea
                    value={departmentFormData.description}
                    onChange={(e) => setDepartmentFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入部门描述（可选）"
                    rows={3}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end p-4 border-t border-dark-100 bg-dark-200/50 gap-2">
              <button onClick={handleCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium rounded-lg transition-colors">
                取消
              </button>
              <button
                onClick={editingDepartment ? handleUpdateDepartment : handleAddDepartment}
                disabled={!departmentFormData.name.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Modal */}
      {(showAddJobModal || editingJob) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancel} />
          <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-dark-100">
            <div className="flex items-center justify-between p-4 border-b border-dark-100">
              <h2 className="text-lg font-semibold text-white">
                {editingJob ? '编辑岗位' : '添加岗位'}
              </h2>
              <button onClick={handleCancel} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm mb-4">
                  <CheckCircle size={16} />
                  {success}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    岗位名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobFormData.name}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入岗位名称"
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    所属部门 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={jobFormData.departmentId}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">岗位描述</label>
                  <textarea
                    value={jobFormData.description}
                    onChange={(e) => setJobFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入岗位描述（可选）"
                    rows={3}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end p-4 border-t border-dark-100 bg-dark-200/50 gap-2">
              <button onClick={handleCancel} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium rounded-lg transition-colors">
                取消
              </button>
              <button
                onClick={editingJob ? handleUpdateJob : handleAddJob}
                disabled={!jobFormData.name.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save size={16} />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}