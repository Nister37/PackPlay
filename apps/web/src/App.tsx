import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { JoinPage } from '@/pages/auth/JoinPage';
import { WelcomePage } from '@/pages/auth/WelcomePage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { GroupsListPage } from '@/pages/groups/GroupsListPage';
import { CreateGroupPage } from '@/pages/groups/CreateGroupPage';
import { GroupDetailPage } from '@/pages/groups/GroupDetailPage';
import { InvitePage } from '@/pages/groups/InvitePage';
import { EquipmentManifestPage } from '@/pages/equipment/EquipmentManifestPage';
import { SharedItemPage } from '@/pages/equipment/SharedItemPage';
import { PackingSessionPage } from '@/pages/packing/PackingSessionPage';
import { GeneralPackingPage } from '@/pages/packing/GeneralPackingPage';
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
        path="/packing"
        element={
          <ProtectedRoute>
            <GeneralPackingPage />
          </ProtectedRoute>
        }
      />

      {/* Default: welcome for guests, dashboard for authenticated */}
      <Route path="/" element={<WelcomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
