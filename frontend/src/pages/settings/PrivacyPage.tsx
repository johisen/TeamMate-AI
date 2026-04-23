import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Save, X } from 'lucide-react'

export const PrivacyPage: React.FC = () => {
  const navigate = useNavigate()
  const [privacySettings, setPrivacySettings] = useState({
    dataCollection: true,
    analytics: true,
    thirdPartySharing: false,
  })

  const handleSave = () => {
    // 这里可以添加保存逻辑
    alert('隐私设置已保存')
    navigate('/settings')
  }

  const handleCancel = () => {
    navigate('/settings')
  }

  const handleToggle = (key: keyof typeof privacySettings) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  return (
    <div className="h-full bg-dark-400 overflow-y-auto">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">数据隐私</h1>
              <p className="text-sm text-gray-400">
                管理数据隐私设置
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">

        <div className="bg-dark-300 border border-dark-100 rounded-xl p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">数据收集</div>
                <div className="text-xs text-gray-500">允许收集使用数据以改进服务</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.dataCollection}
                  onChange={() => handleToggle('dataCollection')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">使用分析</div>
                <div className="text-xs text-gray-500">收集使用情况分析数据</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.analytics}
                  onChange={() => handleToggle('analytics')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">第三方共享</div>
                <div className="text-xs text-gray-500">与第三方共享匿名数据</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.thirdPartySharing}
                  onChange={() => handleToggle('thirdPartySharing')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                保存更改
              </button>
              <button 
                onClick={handleCancel}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <X size={16} />
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}