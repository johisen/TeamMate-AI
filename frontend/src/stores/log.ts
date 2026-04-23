import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  id: string
  level: LogLevel
  message: string
  timestamp: Date
  source?: string
  details?: string
}

interface LogState {
  logs: LogEntry[]
  addLog: (level: LogLevel, message: string, source?: string, details?: string) => void
  clearLogs: () => void
  getLogsByLevel: (level: LogLevel) => LogEntry[]
  getFilteredLogs: (levels: LogLevel[]) => LogEntry[]
}

const generateId = () => `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],

  addLog: (level, message, source, details) => {
    const newLog: LogEntry = {
      id: generateId(),
      level,
      message,
      timestamp: new Date(),
      source,
      details,
    }
    set((state) => ({
      logs: [...state.logs.slice(-99), newLog],
    }))
  },

  clearLogs: () => {
    set({ logs: [] })
  },

  getLogsByLevel: (level) => {
    return get().logs.filter((log) => log.level === level)
  },

  getFilteredLogs: (levels) => {
    return get().logs.filter((log) => levels.includes(log.level))
  },
}))