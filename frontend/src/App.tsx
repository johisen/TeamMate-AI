import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout, HomePage, AgentsPage, KnowledgePage, SettingsPage, AnalyticsPage, ConfigVersionPage, WorkspaceSettingsPage, DeploymentPage, ModelSettingsPage, OnboardingPage, LobsterOfficePage } from '@/pages'
import { PersonalInfoPage, SecurityPage, NotificationPage, EmailNotificationPage, PrivacyPage, ApiKeysPage, ThemePage, LanguagePage, OpenClawPage, OperationLogsPage, DepartmentManagementPage } from '@/pages/settings'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="config-versions" element={<ConfigVersionPage />} />
            <Route path="workspace-settings" element={<WorkspaceSettingsPage />} />
            <Route path="deployment" element={<DeploymentPage />} />
            <Route path="lobster-office" element={<LobsterOfficePage />} />
            <Route path="settings">
              <Route index element={<SettingsPage />} />
              <Route path="personal-info" element={<PersonalInfoPage />} />
              <Route path="security" element={<SecurityPage />} />
              <Route path="notifications" element={<NotificationPage />} />
              <Route path="email-notifications" element={<EmailNotificationPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
              <Route path="theme" element={<ThemePage />} />
              <Route path="language" element={<LanguagePage />} />
              <Route path="openclaw" element={<OpenClawPage />} />
              <Route path="operation-logs" element={<OperationLogsPage />} />
              <Route path="department-management" element={<DepartmentManagementPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App