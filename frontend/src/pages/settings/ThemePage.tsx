import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Palette, Save, X } from 'lucide-react'

export const ThemePage: React.FC = () => {
  const navigate = useNavigate()
  const [selectedTheme, setSelectedTheme] = useState('dark')

  const themes = [
    { value: 'dark', label: '深色主题', description: '适合夜间使用' },
    { value: 'light', label: '浅色主题', description: '适合白天使用' },
    { value: 'system', label: '跟随系统', description: '根据系统设置自动切换' },
  ]

  const handleSave = () => {
    // 这里可以添加保存逻辑
    alert('主题设置已保存')
    navigate('/settings')
  }

  const handleCancel = () => {
    navigate('/settings')
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
              <h1 className="text-xl font-semibold text-white">主题</h1>
              <p className="text-sm text-gray-400">
                管理主题设置
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6">

        <div className="bg-dark-300 border border-dark-100 rounded-xl p-6">
          <div className="space-y-4">
            {themes.map((theme) => (
              <div
                key={theme.value}
                onClick={() => setSelectedTheme(theme.value)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedTheme === theme.value ? 'bg-primary-600/20 border-primary-500' : 'bg-dark-200 border-dark-100 hover:border-primary-500/50'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{theme.label}</div>
                    <div className="text-xs text-gray-500">{theme.description}</div>
                  </div>
                  {selectedTheme === theme.value && (
                    <div className="w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

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