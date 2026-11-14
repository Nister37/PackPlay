import { Navigate, Route, Routes, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { NavBar } from '@/components/layout/NavBar';
import { DesktopHeader } from '@/components/layout/DesktopHeader';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { JoinPage } from '@/pages/auth/JoinPage';
import { WelcomePage } from '@/pages/auth/WelcomePage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ResendVerificationPage } from '@/pages/auth/ResendVerificationPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
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
import { TeamInventoryPage } from '@/pages/inventory/TeamInventoryPage';
import { InventoryQrResolutionPage } from '@/pages/inventory/InventoryQrResolutionPage';
import { EventDetailPage } from '@/pages/events/EventDetailPage';
import { CalendarFeedsPage } from '@/pages/calendar/CalendarFeedsPage';
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

/**
 * Persistent application shell for all authenticated views.
 * DesktopHeader and NavBar remain permanently mounted across route changes,
 * guaranteeing uninterrupted GPU-accelerated sliding strip transitions.
 */
function AuthenticatedShell() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <DesktopHeader />
      <div className="relative w-full flex-1 flex flex-col">
        {/* Mobile-only header with Notification Bell (< 768px) */}
        <header className="md:hidden sticky top-0 z-40 flex justify-end px-4 pt-3 pointer-events-none">
          <div className="pointer-events-auto">
            <NotificationBell />
          </div>
        </header>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <NavBar />
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/resend-verification" element={<ResendVerificationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/invitations/:token" element={<JoinPage />} />
      <Route path="/invitations/:token/join" element={<JoinPage />} />
      <Route path="/groups/join/:token" element={<JoinPage />} />

      {/* Protected routes wrapped in persistent shell */}
      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedShell />
          </ProtectedRoute>
        }
      >
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupsListPage />} />
        <Route path="/groups/new" element={<CreateGroupPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/groups/:groupId/activities/:activityId" element={<EventDetailPage />} />
        <Route path="/groups/:groupId/events/:activityId" element={<EventDetailPage />} />
        <Route path="/groups/:groupId/inventory" element={<TeamInventoryPage />} />
        <Route path="/groups/:groupId/calendar" element={<CalendarFeedsPage />} />
        <Route path="/inventory-qr/:token" element={<InventoryQrResolutionPage />} />
        <Route path="/inventory/qr/:token" element={<InventoryQrResolutionPage />} />
        <Route path="/inventory/scan/:token" element={<InventoryQrResolutionPage />} />
        <Route path="/groups/:groupId/invite" element={<InvitePage />} />
        <Route path="/groups/:groupId/equipment" element={<EquipmentManifestPage />} />
        <Route path="/groups/:groupId/equipment/:itemId" element={<SharedItemPage />} />
        <Route path="/groups/:groupId/packing" element={<PackingSessionPage />} />
        <Route path="/checklists" element={<ChecklistsPage />} />
        <Route path="/checklists/:checklistId" element={<ChecklistDetailPage />} />
        <Route path="/packing" element={<GeneralPackingPage />} />
      </Route>

      {/* Default: welcome for guests, dashboard for authenticated */}
      <Route path="/" element={<WelcomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
