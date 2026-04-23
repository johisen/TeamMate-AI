import React, { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Users, Settings, BookOpen, BarChart2, LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

export const Layout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { path: '/', icon: Home, label: '首页' },
    { path: '/agents', icon: Users, label: 'AI 员工' },
    { path: '/knowledge', icon: BookOpen, label: '知识库' },
    { path: '/analytics', icon: BarChart2, label: '用量统计' },
    { path: '/settings', icon: Settings, label: '设置' },
  ]

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout()
      navigate('/login')
    }
  }

  // 点击外部关闭用户菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="flex h-screen bg-dark-400">
      {/* Sidebar */}
      <nav className="w-16 bg-dark-300 border-r border-dark-100 flex flex-col items-center py-4">
        {/* Logo */}
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mb-6">
          <span className="text-white font-bold text-lg">T</span>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-dark-100'
                }`}
                title={item.label}
              >
                <item.icon size={20} />
              </Link>
            )
          })}
        </div>

        {/* User avatar at bottom */}
        <div className="relative mt-auto">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-10 h-10 rounded-full bg-secondary-600 flex items-center justify-center text-white font-medium hover:bg-secondary-500 transition-colors"
            title={user?.username || '用户'}
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </button>

          {showUserMenu && (
            <div ref={userMenuRef} className="absolute left-full ml-2 bottom-0 w-48 bg-dark-200 border border-dark-100 rounded-lg shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-dark-100">
                <p className="text-sm text-white font-medium">{user?.username || '用户'}</p>
                <p className="text-xs text-gray-400">{user?.email || '已登录'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-dark-100 flex items-center gap-2 transition-colors"
              >
                <LogOut size={14} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}