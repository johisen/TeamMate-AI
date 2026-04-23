import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Save, X } from 'lucide-react'

export const NotificationPage: React.FC = () => {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState({
    messageNotifications: true,
    emailNotifications: true,
    systemNotifications: true,
  })

  const handleSave = () => {
    // 这里可以添加保存逻辑
    alert('通知设置已保存')
    navigate('/settings')
  }

  const handleCancel = () => {
    navigate('/settings')
  }

  const handleToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
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
              <h1 className="text-xl font-semibold text-white">消息通知</h1>
              <p className="text-sm text-gray-400">
                管理消息通知设置
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
                <div className="text-white">消息通知</div>
                <div className="text-xs text-gray-500">接收新消息通知</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.messageNotifications}
                  onChange={() => handleToggle('messageNotifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">邮件通知</div>
                <div className="text-xs text-gray-500">接收邮件提醒</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-dark-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-white">系统通知</div>
                <div className="text-xs text-gray-500">接收系统更新和重要通知</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.systemNotifications}
                  onChange={() => handleToggle('systemNotifications')}
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