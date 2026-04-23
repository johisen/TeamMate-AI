import { create } from 'zustand'

export interface Job {
  id: string
  name: string
  description?: string
  departmentId: string
  createdAt: Date
  updatedAt: Date
}

export interface Department {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  order?: number
}

interface DepartmentState {
  departments: Department[]
  jobs: Job[]
  isLoading: boolean
  error: string | null

  // Department Actions
  fetchDepartments: () => Promise<void>
  createDepartment: (name: string, description?: string) => Promise<Department | null>
  updateDepartment: (id: string, name: string, description?: string) => Promise<void>
  deleteDepartment: (id: string) => Promise<void>
  getDepartmentById: (id: string) => Department | undefined
  reorderDepartments: (departments: Department[]) => void

  // Job Actions
  fetchJobs: () => Promise<void>
  createJob: (name: string, departmentId: string, description?: string) => Promise<Job | null>
  updateJob: (id: string, name: string, departmentId: string, description?: string) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  getJobsByDepartment: (departmentId: string) => Job[]
  getJobById: (id: string) => Job | undefined
}

const initialDepartments: Department[] = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: '内置',
    description: '系统内置部门，不可编辑',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: '项目管理部',
    description: '项目管理部门',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 1,
  }
]

export const useDepartmentStore = create<DepartmentState>((set, get) => ({
  departments: initialDepartments,
  jobs: [],
  isLoading: false,
  error: null,

  // Department Actions
  fetchDepartments: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/departments')
      if (response.ok) {
        const data = await response.json()

        if (data && data.length > 0) {
          const transformedDepartments: Department[] = data.map((dept: any) => ({
            id: dept.id,
            name: dept.name,
            description: dept.description,
            createdAt: new Date(dept.created_at),
            updatedAt: new Date(dept.updated_at),
            order: dept.order ?? dept.id,
          }))

          transformedDepartments.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          set({ departments: transformedDepartments, isLoading: false })
        } else {
          set({ departments: initialDepartments, isLoading: false })
        }
      } else {
        console.log('API fetch failed, using initial data')
        set({ departments: initialDepartments, isLoading: false })
      }
    } catch (error: any) {
      console.log('Fetch failed, using initial data:', error)
      set({ departments: initialDepartments, isLoading: false })
    }
  },

  createDepartment: async (name: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      if (response.ok) {
        const newDepartment = await response.json()
        const department: Department = {
          id: newDepartment.id,
          name: newDepartment.name,
          description: newDepartment.description,
          createdAt: new Date(newDepartment.created_at),
          updatedAt: new Date(newDepartment.updated_at),
          order: get().departments.length,
        }

        set((state) => {
          const newDepartments = [...state.departments, department]
          newDepartments.sort((a, b) => (a.order || 0) - (b.order || 0))
          return {
            departments: newDepartments,
            isLoading: false,
          }
        })

        return department
      } else {
        throw new Error('Failed to create department')
      }
    } catch (error: any) {
      console.error('Create department error:', error)
      set({ isLoading: false, error: error.message })
      return null
    }
  },

  updateDepartment: async (id: string, name: string, description?: string) => {
    if (id === '00000000-0000-0000-0000-000000000002') {
      throw new Error('内置部门不可编辑')
    }
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/departments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })

      if (response.ok) {
        const updatedDepartment = await response.json()
        set((state) => {
          const newDepartments = state.departments.map((dept) =>
            dept.id === id
              ? {
                  ...dept,
                  name: updatedDepartment.name,
                  description: updatedDepartment.description,
                  updatedAt: new Date(updatedDepartment.updated_at),
                }
              : dept
          )
          newDepartments.sort((a, b) => (a.order || 0) - (b.order || 0))
          return {
            departments: newDepartments,
            isLoading: false,
          }
        })
      } else {
        throw new Error('Failed to update department')
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message })
    }
  },

  deleteDepartment: async (id: string) => {
    if (id === '00000000-0000-0000-0000-000000000002') {
      throw new Error('内置部门不能删除')
    }
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/departments/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        set((state) => {
          const newDepartments = state.departments.filter((dept) => dept.id !== id)
          newDepartments.forEach((dept, index) => {
            dept.order = index
          })
          return {
            departments: newDepartments,
            isLoading: false,
          }
        })
      } else {
        throw new Error('Failed to delete department')
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message })
    }
  },

  getDepartmentById: (id: string) => {
    return get().departments.find((dept) => dept.id === id)
  },

  reorderDepartments: (departments: Department[]) => {
    const builtinDept = departments.find(d => d.id === '00000000-0000-0000-0000-000000000002')
    const otherDepts = departments.filter(d => d.id !== '00000000-0000-0000-0000-000000000002')

    const reordered = builtinDept ? [builtinDept, ...otherDepts] : otherDepts

    reordered.forEach((dept, index) => {
      dept.order = index
    })

    set({ departments: reordered })
  },

  // Job Actions
  fetchJobs: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/jobs')
      if (response.ok) {
        const data = await response.json()

        if (data && data.length > 0) {
          const transformedJobs: Job[] = data.map((job: any) => ({
            id: job.id,
            name: job.name,
            description: job.description,
            departmentId: job.department_id,
            createdAt: new Date(job.created_at),
            updatedAt: new Date(job.updated_at),
          }))

          set({ jobs: transformedJobs, isLoading: false })
        } else {
          // API返回空数据，保留当前岗位数据，不使用initialJobs
          set({ isLoading: false })
        }
      } else {
        console.log('API fetch failed, keeping current data')
        set({ isLoading: false })
      }
    } catch (error: any) {
      console.log('Fetch failed, keeping current data:', error)
      set({ isLoading: false })
    }
  },

  createJob: async (name: string, departmentId: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, department_id: departmentId, description }),
      })

      if (response.ok) {
        const newJob = await response.json()
        const job: Job = {
          id: newJob.id,
          name: newJob.name,
          description: newJob.description,
          departmentId: newJob.department_id,
          createdAt: new Date(newJob.created_at),
          updatedAt: new Date(newJob.updated_at),
        }

        set((state) => ({
          jobs: [...state.jobs, job],
          isLoading: false,
        }))

        return job
      } else {
        throw new Error('Failed to create job')
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message })
      return null
    }
  },

  updateJob: async (id: string, name: string, departmentId: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/jobs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, department_id: departmentId, description }),
      })

      if (response.ok) {
        const updatedJob = await response.json()
        set((state) => {
          const newJobs = state.jobs.map((job) =>
            job.id === id
              ? {
                  ...job,
                  name: updatedJob.name,
                  departmentId: updatedJob.department_id,
                  description: updatedJob.description,
                  updatedAt: new Date(updatedJob.updated_at),
                }
              : job
          )
          return {
            jobs: newJobs,
            isLoading: false,
          }
        })
      } else {
        throw new Error('Failed to update job')
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message })
    }
  },

  deleteJob: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/v1/jobs/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== id),
          isLoading: false,
        }))
      } else {
        throw new Error('Failed to delete job')
      }
    } catch (error: any) {
      set({ isLoading: false, error: error.message })
    }
  },

  getJobsByDepartment: (departmentId: string) => {
    return get().jobs.filter((job) => job.departmentId === departmentId)
  },

  getJobById: (id: string) => {
    return get().jobs.find((job) => job.id === id)
  },
}))