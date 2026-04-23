import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Save, X, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

export const SecurityPage: React.FC = () => {
  const navigate = useNavigate()
  const { updatePassword } = useAuthStore()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setError('')
    setSuccess('')

    if (!currentPassword) {
      setError('请输入当前密码')
      return
    }

    if (!newPassword) {
      setError('请输入新密码')
      return
    }

    if (newPassword.length < 6) {
      setError('新密码长度至少为6个字符')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setIsLoading(true)

    try {
      const result = await updatePassword(currentPassword, newPassword)
      if (result) {
        setSuccess('密码修改成功')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          navigate('/settings')
        }, 1500)
      } else {
        setError('当前密码错误')
      }
    } catch (err) {
      setError('密码修改失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (currentPassword || newPassword || confirmPassword) {
      if (confirm('有未保存的更改，确定要放弃吗？')) {
        navigate('/settings')
      }
    } else {
      navigate('/settings')
    }
  }

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    setError('')
    setSuccess('')
  }

  const hasChanges = currentPassword || newPassword || confirmPassword

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
              <h1 className="text-xl font-semibold text-white">安全设置</h1>
              <p className="text-sm text-gray-400">
                管理安全设置
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-dark-300 border border-dark-100 rounded-xl p-6">
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                <CheckCircle size={16} />
                {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                当前密码
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={handleInputChange(setCurrentPassword)}
                placeholder="输入当前密码"
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={handleInputChange(setNewPassword)}
                placeholder="输入新密码"
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={handleInputChange(setConfirmPassword)}
                placeholder="再次输入新密码"
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={isLoading || !hasChanges}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    保存更改
                  </>
                )}
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