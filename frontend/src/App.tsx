import { Navigate, BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./layouts/MainLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { MatchesPage } from "./pages/MatchesPage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminInvitesPage } from "./pages/admin/AdminInvitesPage";
import { AdminSyncPage } from "./pages/admin/AdminSyncPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminGroupsPage } from "./pages/admin/AdminGroupsPage";

export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route index element={<Navigate to="/matches" replace />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/matches/:id" element={<MatchDetailPage />} />
                <Route path="/calendar" element={<CalendarPage />} />

                <Route element={<ProtectedRoute adminOnly />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="/admin/invites" replace />} />
                    <Route path="invites" element={<AdminInvitesPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="groups" element={<AdminGroupsPage />} />
                    <Route path="sync" element={<AdminSyncPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  );
}
