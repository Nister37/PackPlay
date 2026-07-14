import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { JoinPage } from '@/pages/auth/JoinPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ResendVerificationPage } from '@/pages/auth/ResendVerificationPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { GroupsListPage } from '@/pages/groups/GroupsListPage';
import { CreateGroupPage } from '@/pages/groups/CreateGroupPage';
import { GroupDetailPage } from '@/pages/groups/GroupDetailPage';
import { InvitePage } from '@/pages/groups/InvitePage';
import { EquipmentManifestPage } from '@/pages/equipment/EquipmentManifestPage';
import { SharedItemPage } from '@/pages/equipment/SharedItemPage';
import { PackingSessionPage } from '@/pages/packing/PackingSessionPage';
import { GeneralPackingPage } from '@/pages/packing/GeneralPackingPage';
import { ChecklistsPage } from '@/pages/checklists/ChecklistsPage';
import { ChecklistDetailPage } from '@/pages/checklists/ChecklistDetailPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const hasToken = !!localStorage.getItem('accessToken');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/resend-verification" element={<ResendVerificationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/join/:token" element={<JoinPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <GroupsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/new"
        element={
          <ProtectedRoute>
            <CreateGroupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:groupId"
        element={
          <ProtectedRoute>
            <GroupDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:groupId/invite"
        element={
          <ProtectedRoute>
            <InvitePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:groupId/equipment"
        element={
          <ProtectedRoute>
            <EquipmentManifestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:groupId/equipment/:itemId"
        element={
          <ProtectedRoute>
            <SharedItemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:groupId/packing"
        element={
          <ProtectedRoute>
            <PackingSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checklists"
        element={<ProtectedRoute><ChecklistsPage /></ProtectedRoute>}
      />
      <Route
        path="/checklists/:checklistId"
        element={<ProtectedRoute><ChecklistDetailPage /></ProtectedRoute>}
      />
      <Route
        path="/packing"
        element={
          <ProtectedRoute>
            <GeneralPackingPage />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
