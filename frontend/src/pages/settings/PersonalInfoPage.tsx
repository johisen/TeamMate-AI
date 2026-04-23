import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Save, X, Camera } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

export const PersonalInfoPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (user) {
      setUsername(user.username)
      setEmail(user.email || '')
      setAvatar(user.avatar || null)
    }
  }, [user])

  const handleSave = () => {
    updateUser({
      username,
      email,
      avatar: avatar || undefined,
    })
    setHasChanges(false)
    alert('个人信息已保存')
    navigate('/settings')
  }

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('有未保存的更改，确定要放弃吗？')) {
        navigate('/settings')
      }
    } else {
      navigate('/settings')
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setAvatar(result)
        setHasChanges(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value)
    setHasChanges(true)
  }

  return (
    <div className="h-full bg-dark-400 overflow-y-auto">
      <div className="px-6 py-4 border-b border-dark-100 bg-dark-300 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">个人信息</h1>
              <p className="text-sm text-gray-400">
                管理个人信息设置
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-dark-300 border border-dark-100 rounded-xl p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                姓名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => handleInputChange(setUsername)(e.target.value)}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleInputChange(setEmail)(e.target.value)}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                头像
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="用户头像"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-secondary-600 rounded-full flex items-center justify-center">
                      <User size={24} className="text-white" />
                    </div>
                  )}
                  <button
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center border-2 border-dark-300 hover:bg-primary-700 transition-colors"
                  >
                    <Camera size={12} className="text-white" />
                  </button>
                </div>
                <button
                  onClick={handleAvatarClick}
                  className="px-4 py-2 bg-dark-200 hover:bg-dark-100 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  更换头像
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={!hasChanges}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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