import React, { useState, useEffect } from 'react'
import { Bot, X, Loader2 } from 'lucide-react'
import { useAgentStore } from '@/stores'
import { useWorkspaceStore } from '@/stores'
import { useKnowledgeStore } from '@/stores'
import type { Agent } from '@/stores'

interface AgentModalProps {
  isOpen: boolean
  onClose: () => void
  agent?: Agent | null
}

const AVATARS = ['🤖', '👤', '🎯', '💡', '🔧', '📊', '🎨', '🚀', '🌟', '🎉', '💼', '🌱']

export const AgentModal: React.FC<AgentModalProps> = ({ isOpen, onClose, agent }) => {
  const { createAgent, updateAgent, isLoading } = useAgentStore()
  const { currentWorkspace } = useWorkspaceStore()
  const { knowledgeBases, fetchKnowledgeBases } = useKnowledgeStore()

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    systemPrompt: '',
    avatar: AVATARS[0],
    workspaceId: '',
    knowledgeBaseIds: [] as string[],
    model: '',
  })
  const [models, setModels] = useState<Array<{id: string, name: string, provider: string}>>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  // 12个不同行业的AI员工模板
  const industryTemplates = [
    {
      id: 'tech-engineer',
      industry: '科技行业',
      role: '软件工程师',
      systemPrompt: '你是一位专业的软件工程师，擅长前端和后端开发，精通各种编程语言和框架。你能够快速解决技术问题，提供清晰的代码建议，并且善于解释复杂的技术概念。',
      avatar: '🤖'
    },
    {
      id: 'finance-analyst',
      industry: '金融行业',
      role: '财务分析师',
      systemPrompt: '你是一位资深的财务分析师，精通财务报表分析、投资评估和风险管理。你能够提供专业的财务建议，帮助企业做出明智的财务决策。',
      avatar: '📊'
    },
    {
      id: 'medical-advisor',
      industry: '医疗行业',
      role: '医疗顾问',
      systemPrompt: '你是一位专业的医疗顾问，具备丰富的医学知识和临床经验。你能够提供健康咨询，解释医学概念，并且给出合理的健康建议。',
      avatar: '👤'
    },
    {
      id: 'education-mentor',
      industry: '教育行业',
      role: '教育导师',
      systemPrompt: '你是一位经验丰富的教育导师，擅长教学设计和学习方法指导。你能够激发学生的学习兴趣，提供个性化的学习建议，帮助学生实现学习目标。',
      avatar: '🎓'
    },
    {
      id: 'marketing-expert',
      industry: '营销行业',
      role: '数字营销专家',
      systemPrompt: '你是一位专业的数字营销专家，精通社交媒体营销、内容营销和SEO优化。你能够制定有效的营销策略，提高品牌知名度和用户转化率。',
      avatar: '🚀'
    },
    {
      id: 'legal-consultant',
      industry: '法律行业',
      role: '法律顾问',
      systemPrompt: '你是一位资深的法律顾问，熟悉各种法律法规和案例。你能够提供专业的法律建议，解答法律问题，并且帮助制定合法合规的解决方案。',
      avatar: '⚖️'
    },
    {
      id: 'creative-director',
      industry: '创意行业',
      role: '创意总监',
      systemPrompt: '你是一位富有创意的创意总监，擅长品牌设计、广告创意和内容策划。你能够提供独特的创意方案，帮助企业打造独特的品牌形象。',
      avatar: '🎨'
    },
    {
      id: 'retail-operation',
      industry: '零售行业',
      role: '零售运营专家',
      systemPrompt: '你是一位专业的零售运营专家，精通店铺管理、库存控制和客户服务。你能够优化零售运营流程，提高店铺业绩和客户满意度。',
      avatar: '🛍️'
    },
    {
      id: 'hr-consultant',
      industry: '人力资源',
      role: 'HR顾问',
      systemPrompt: '你是一位专业的HR顾问，擅长人才招聘、员工培训和绩效管理。你能够帮助企业建立高效的人力资源管理体系，吸引和留住优秀人才。',
      avatar: '👥'
    },
    {
      id: 'architect-designer',
      industry: '建筑行业',
      role: '建筑设计师',
      systemPrompt: '你是一位专业的建筑设计师，擅长建筑设计、空间规划和可持续发展设计。你能够创建美观实用的建筑设计方案，满足客户的需求和预算。',
      avatar: '🏗️'
    },
    {
      id: 'supply-chain',
      industry: '物流行业',
      role: '供应链专家',
      systemPrompt: '你是一位专业的供应链专家，精通物流管理、库存优化和供应商关系管理。你能够优化供应链流程，降低运营成本，提高供应链效率。',
      avatar: '📦'
    },
    {
      id: 'content-strategist',
      industry: '媒体行业',
      role: '内容策略师',
      systemPrompt: '你是一位专业的内容策略师，擅长内容创作、内容规划和内容营销。你能够创建有吸引力的内容，提高品牌影响力和用户 engagement。',
      avatar: '📝'
    }
  ]

  useEffect(() => {
    if (isOpen) {
      fetchKnowledgeBases(currentWorkspace?.id || '00000000-0000-0000-0000-000000000001', 'default-user')
      fetchModels()
    }
  }, [isOpen, currentWorkspace])

  const fetchModels = async () => {
    setIsLoadingModels(true)
    try {
      const response = await fetch('/api/v1/llm/models')
      if (response.ok) {
        const data = await response.json()
        const modelsData = data.models || {}
        const allModels = Object.entries(modelsData).flatMap(([provider, providerModels]: [string, any[]]) => {
          return (providerModels as string[]).map((model: string) => ({
            id: model,
            name: model,
            provider
          }))
        })
        setModels(allModels)
      }
    } catch (error) {
      console.error('获取模型列表失败:', error)
    } finally {
      setIsLoadingModels(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    if (agent) {
      setStep(2)
      
      // 编辑时保持员工的原始数据不变
      setFormData({
        name: agent.name || '',
        role: agent.role || '',
        systemPrompt: agent.systemPrompt || '',
        avatar: agent.avatar || AVATARS[0],
        workspaceId: agent.workspaceId || currentWorkspace?.id || '',
        knowledgeBaseIds: agent.knowledgeBaseIds || [],
        model: agent.model || '',
      })
    } else {
      setStep(1)
      setFormData({
        name: '',
        role: '',
        systemPrompt: '',
        avatar: AVATARS[0],
        workspaceId: currentWorkspace?.id || '',
        knowledgeBaseIds: [],
        model: '',
      })
    }
  }, [agent, isOpen, currentWorkspace])



  const handleSelectTemplate = (template: typeof industryTemplates[0]) => {
    setFormData((prev) => ({
      ...prev,
      role: template.role,
      systemPrompt: template.systemPrompt,
      avatar: template.avatar,
    }))
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      alert('请填写姓名和岗位')
      return
    }

    const agentData = {
      name: formData.name.trim(),
      role: formData.role.trim(),
      systemPrompt: formData.systemPrompt || `你是一位 ${formData.role}，乐于助人，擅长解决问题。`,
      avatar: formData.avatar,
      workspaceId: formData.workspaceId || '00000000-0000-0000-0000-000000000001',
      knowledgeBaseIds: formData.knowledgeBaseIds,
      model: formData.model,
    }

    if (agent) {
      await updateAgent(agent.id, agentData)
    } else {
      await createAgent(agentData)
    }

    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-300 rounded-2xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-secondary-400" />
            <h2 className="text-lg font-semibold text-white">
              {agent ? '编辑 AI 员工' : '创建 AI 员工'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {step === 1 && !agent && (
            <>
              <p className="text-sm text-gray-400 mb-4">
                选择一个行业模板，或跳过直接创建自定义 AI 员工
              </p>
              <div className="grid grid-cols-3 gap-3">
                {industryTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="p-4 bg-dark-200 hover:bg-dark-100 rounded-lg text-left transition-colors border border-transparent hover:border-primary-500 flex flex-col gap-2"
                  >
                    <div className="text-2xl">{template.avatar}</div>
                    <div className="text-sm font-medium text-white">{template.role}</div>
                    <div className="text-xs text-gray-500">{template.industry}</div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {template.systemPrompt.substring(0, 50)}...
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full mt-6 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                跳过，直接创建
              </button>
            </>
          )}

          {(step === 2 || agent) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  AI 员工名称
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="给 AI 员工起个名字"
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>



              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  角色描述
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="AI 员工在团队中的角色"
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  系统提示词
                </label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="定义 AI 员工的行为模式和专业能力..."
                  rows={4}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  头像
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => setFormData({ ...formData, avatar })}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        formData.avatar === avatar
                          ? 'bg-primary-600 ring-2 ring-primary-400'
                          : 'bg-dark-200 hover:bg-dark-100'
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  选择大模型
                </label>
                {isLoadingModels ? (
                  <div className="flex items-center justify-center p-4 bg-dark-200 rounded-lg">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-400">加载模型列表...</span>
                  </div>
                ) : models.length > 0 ? (
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">选择大模型</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-dark-200 rounded-lg text-sm text-gray-400">
                    暂无可用的大模型
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  关联知识库
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {knowledgeBases.map((kb) => (
                    <label key={kb.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-dark-100">
                      <input
                        type="checkbox"
                        checked={formData.knowledgeBaseIds.includes(kb.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              knowledgeBaseIds: [...formData.knowledgeBaseIds, kb.id]
                            })
                          } else {
                            setFormData({
                              ...formData,
                              knowledgeBaseIds: formData.knowledgeBaseIds.filter(id => id !== kb.id)
                            })
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-dark-200 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-white">{kb.name}</span>
                    </label>
                  ))}
                  {knowledgeBases.length === 0 && (
                    <p className="text-sm text-gray-500">暂无可用知识库</p>
                  )}
                </div>
              </div>

              {!agent && (
                <button
                  onClick={() => setStep(1)}
                  className="w-full mb-2 px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white rounded-lg transition-colors"
                >
                  上一步
                </button>
              )}
            </>
          )}
        </div>

        {step === 2 && (
          <div className="p-4 border-t border-dark-100">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>保存</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}