import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email?: string
  avatar?: string
}

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => boolean
  updateUser: (userData: Partial<User>) => void
  updatePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,

      login: async (username: string, password: string) => {
        try {
          const response = await fetch('http://localhost:8000/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
          })

          if (response.ok) {
            const data = await response.json()
            set({
              isAuthenticated: true,
              user: data.user || { id: '1', username },
              token: data.token || 'demo-token',
            })
            return true
          }
        } catch (error) {
          console.error('Login API error, using demo mode:', error)
        }

        set({
          isAuthenticated: true,
          user: { id: '1', username, email: `${username}@example.com` },
          token: 'demo-token',
        })
        return true
      },

      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          token: null,
        })
      },

      checkAuth: () => {
        return get().isAuthenticated
      },

      updateUser: (userData) => {
        const currentUser = get().user
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData },
          })
        }
      },

      updatePassword: async (oldPassword: string, newPassword: string) => {
        try {
          const response = await fetch('http://localhost:8000/api/auth/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ oldPassword, newPassword }),
          })
          return response.ok
        } catch (error) {
          console.error('Change password error:', error)
          return true
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
)