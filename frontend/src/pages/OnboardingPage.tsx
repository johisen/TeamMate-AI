import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Sparkles, BookOpen, Users, MessageSquare, CheckCircle, ArrowRight, Play, Zap, Star, ChevronRight, ChevronLeft } from 'lucide-react'

interface OnboardingStep {
  id: number
  title: string
  description: string
  icon: React.ReactNode
  action?: string
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: '欢迎使用 TeamMateAI',
    description: 'TeamMateAI 是一款面向团队的原生即时通讯 × 多 AI Agent 协作平台。让 AI 员工成为你团队的一部分！',
    icon: <Sparkles size={48} className="text-primary-400" />,
  },
  {
    id: 2,
    title: '创建你的第一个 AI 员工',
    description: '只需几步，你就可以创建一个具备特定角色、记忆和工具调用能力的 AI 员工。',
    icon: <Bot size={48} className="text-secondary-400" />,
    action: '创建 AI 员工'
  },
  {
    id: 3,
    title: '组建项目组',
    description: '将多个 AI 员工组成项目组，让它们协作完成任务。群主 AI 会智能分配任务给合适的成员。',
    icon: <Users size={48} className="text-green-400" />,
    action: '创建项目组'
  },
  {
    id: 4,
    title: '上传知识库',
    description: '为 AI 员工配置专属知识库，让它们能够理解和利用你的团队文档和数据。',
    icon: <BookOpen size={48} className="text-yellow-400" />,
    action: '上传文档'
  },
  {
    id: 5,
    title: '开始对话',
    description: '直接在 IM 界面中 @ 你的 AI 员工，开始协作。AI 之间可以互相沟通协作完成任务。',
    icon: <MessageSquare size={48} className="text-purple-400" />,
    action: '开始对话'
  }
]

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setCompletedSteps([...completedSteps, currentStep])
    navigate('/')
  }

  const handleSkip = () => {
    navigate('/')
  }

  const handleAction = () => {
    const currentStepData = steps[currentStep]
    switch (currentStepData.action) {
      case '创建 AI 员工':
        navigate('/agents')
        break
      case '创建项目组':
        navigate('/')
        break
      case '上传文档':
        navigate('/knowledge')
        break
      case '开始对话':
        navigate('/')
        break
      default:
        break
    }
  }

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1

  return (
    <div className="min-h-screen bg-dark-400 flex flex-col">
      {/* Header */}
      <div className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <span className="font-semibold text-white">TeamMateAI</span>
        </div>
        <button
          onClick={handleSkip}
          className="text-gray-400 hover:text-white text-sm"
        >
          跳过引导
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4">
        <div className="flex gap-1">
          {steps.map((s, index) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentStep ? 'bg-primary-500' : 'bg-dark-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl text-center">
          {/* Icon */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 bg-dark-300 rounded-2xl flex items-center justify-center">
              {step.icon}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4">
            {step.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-400 mb-8">
            {step.description}
          </p>

          {/* Action button */}
          {step.action && (
            <button
              onClick={handleAction}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors flex items-center gap-2 mx-auto mb-8"
            >
              <Play size={18} />
              {step.action}
            </button>
          )}

          {/* Features list */}
          {currentStep === 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-dark-300 rounded-xl p-4">
                <Bot size={24} className="text-primary-400 mx-auto mb-2" />
                <div className="text-sm text-white font-medium">AI 员工</div>
                <div className="text-xs text-gray-400">零代码创建</div>
              </div>
              <div className="bg-dark-300 rounded-xl p-4">
                <Users size={24} className="text-secondary-400 mx-auto mb-2" />
                <div className="text-sm text-white font-medium">项目组</div>
                <div className="text-xs text-gray-400">多 Agent 协作</div>
              </div>
              <div className="bg-dark-300 rounded-xl p-4">
                <BookOpen size={24} className="text-green-400 mx-auto mb-2" />
                <div className="text-sm text-white font-medium">知识库</div>
                <div className="text-xs text-gray-400">RAG 检索</div>
              </div>
            </div>
          )}

          {/* Quick stats */}
          {currentStep === 0 && (
            <div className="flex justify-center gap-8 text-center">
              <div>
                <div className="text-2xl font-bold text-white">5 分钟</div>
                <div className="text-xs text-gray-400">快速上手</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">零代码</div>
                <div className="text-xs text-gray-400">无需编程</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">100+</div>
                <div className="text-xs text-gray-400">模型支持</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="p-8 flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="p-3 bg-dark-300 hover:bg-dark-200 rounded-xl text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex gap-2">
          {steps.map((s, index) => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-primary-500' : 'bg-dark-200'
              }`}
            />
          ))}
        </div>

        {isLastStep ? (
          <button
            onClick={handleComplete}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors flex items-center gap-2"
          >
            完成引导
            <CheckCircle size={18} />
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="p-3 bg-primary-600 hover:bg-primary-700 rounded-xl text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  )
}
