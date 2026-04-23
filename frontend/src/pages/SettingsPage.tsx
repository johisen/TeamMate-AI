import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, User, Bell, Lock, Palette, Globe, Cpu, ClipboardList, Building } from 'lucide-react'

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate()

  const settingsSections = [
    {
      title: '账户设置',
      icon: User,
      items: [
        { label: '个人信息', description: '管理你的账户信息', path: 'personal-info' },
        { label: '安全问题', description: '修改密码和安全设置', path: 'security' },
      ],
    },
    {
      title: '通知',
      icon: Bell,
      items: [
        { label: '消息通知', description: '配置消息提醒方式', path: 'notifications' },
        { label: '邮件通知', description: '管理邮件提醒偏好', path: 'email-notifications' },
      ],
    },
    {
      title: '隐私与安全',
      icon: Lock,
      items: [
        { label: '数据隐私', description: '管理你的数据隐私设置', path: 'privacy' },
        { label: 'API 密钥', description: '管理 LLM API 密钥', path: 'api-keys' },
      ],
    },
    {
      title: '外观',
      icon: Palette,
      items: [
        { label: '主题', description: '选择应用外观主题', path: 'theme' },
        { label: '语言', description: '选择界面语言', path: 'language' },
      ],
    },
    {
      title: '系统',
      icon: ClipboardList,
      items: [
        { label: '操作日志', description: '查看系统操作记录', path: 'operation-logs' },
        { label: '部门管理', description: '管理部门信息', path: 'department-management' },
      ],
    },
    {
      title: '集成',
      icon: Cpu,
      items: [
        { label: 'OpenClaw 集成', description: '连接本地OpenClaw实例', path: 'openclaw' },
      ],
    },
  ]

  const handleNavigate = (path: string) => {
    navigate(`/settings/${path}`)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold text-white mb-6">设置</h1>

      <div className="space-y-6">
        {settingsSections.map((section) => (
          <div
            key={section.title}
            className="bg-dark-300 border border-dark-100 rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-dark-100 flex items-center gap-2">
              <section.icon size={18} className="text-gray-400" />
              <span className="font-medium text-white">{section.title}</span>
            </div>
            <div className="divide-y divide-dark-100">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  onClick={() => handleNavigate(item.path)}
                  className="px-4 py-3 flex items-center justify-between hover:bg-dark-200/50 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="text-white">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                  <span className="text-gray-500">→</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-dark-100 text-center">
        <p className="text-sm text-gray-500">
          TeamMateAI v1.0.0 · Made with ❤️ by TeamMateAI Team
        </p>
      </div>
    </div>
  )
}