import { useCallback, useEffect, useState } from "react";
import "../App.css";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { useLanguage } from "../i18n/useLanguage";
import { ActivitiesPage } from "../pages/ActivitiesPage";
import { LoginPage } from "../pages/LoginPage";
import { OverviewPage } from "../pages/OverviewPage";
import { PaymentsPage } from "../pages/PaymentsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { SurveysPage } from "../pages/SurveysPage";
import { UserManagementPage } from "../pages/UserManagementPage";
import { ApiError } from "../services/api";
import { getUsers } from "../services/adminService";
import {
  clearAdminSession,
  readAdminSession,
  saveAdminSession,
} from "../services/sessionStorage";
import type { AuthResponse, PageKey, User } from "../types/domain";

export function App() {
  const { t } = useLanguage();
  const [session, setSession] = useState<AuthResponse | null>(() =>
    readAdminSession(),
  );
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openHrCreate, setOpenHrCreate] = useState(false);

  const loadUsers = useCallback(
    async (token: string) => {
      setLoading(true);
      setError("");
      try {
        setUsers(await getUsers(token));
        setApiConnected(true);
      } catch (errorValue) {
        if (
          errorValue instanceof ApiError &&
          (errorValue.status === 401 || errorValue.status === 403)
        ) {
          clearAdminSession();
          setSession(null);
          setUsers([]);
          setApiConnected(false);
          setActivePage("overview");
          return;
        }

        setApiConnected(false);
        setError(t("backendUnavailable"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (session) {
      // Session hydration is an intentional synchronization with the API.
      // oxlint-disable-next-line react/set-state-in-effect
      void loadUsers(session.token);
    }
  }, [loadUsers, session]);

  useEffect(() => {
    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, []);

  function handleLogin(auth: AuthResponse) {
    saveAdminSession(auth);
    setSession(auth);
  }

  function logout() {
    clearAdminSession();
    setSession(null);
    setUsers([]);
    setApiConnected(false);
    setActivePage("overview");
    setMobileMenuOpen(false);
  }

  function changePage(page: PageKey) {
    setActivePage(page);
    setOpenHrCreate(false);
    setMobileMenuOpen(false);
  }

  function openHrMemberCreation() {
    setActivePage("hrMembers");
    setOpenHrCreate(true);
    setMobileMenuOpen(false);
  }

  if (!session) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        counts={{
          administrators: users.filter((user) => user.role === "SYSTEM_ADMIN")
            .length,
          employees: users.filter((user) => user.role === "EMPLOYEE").length,
          hrMembers: users.filter((user) => user.role === "HR_MEMBER").length,
        }}
        displayName={session.displayName}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onPageChange={changePage}
        onLogout={logout}
      />
      <main className="main-content">
        <Topbar
          activePage={activePage}
          apiConnected={apiConnected}
          mobileMenuOpen={mobileMenuOpen}
          onMenuToggle={() => setMobileMenuOpen((current) => !current)}
        />
        {error && (
          <div className="alert" role="alert">
            {error}
            <button type="button" onClick={() => void loadUsers(session.token)}>
              {t("retry")}
            </button>
          </div>
        )}
        {activePage === "overview" && (
          <OverviewPage
            token={session.token}
            users={users}
            loading={loading}
            currentUsername={session.username}
            onEmployees={() => setActivePage("employees")}
            onHr={openHrMemberCreation}
            onRefresh={() => loadUsers(session.token)}
          />
        )}
        {activePage === "administrators" && (
          <UserManagementPage
            key="administrators"
            token={session.token}
            users={users}
            loading={loading}
            role="SYSTEM_ADMIN"
            currentUsername={session.username}
            onRefresh={() => void loadUsers(session.token)}
          />
        )}
        {activePage === "employees" && (
          <UserManagementPage
            key="employees"
            token={session.token}
            users={users}
            loading={loading}
            role="EMPLOYEE"
            currentUsername={session.username}
            onRefresh={() => void loadUsers(session.token)}
          />
        )}
        {activePage === "hrMembers" && (
          <UserManagementPage
            key="hrMembers"
            token={session.token}
            users={users}
            loading={loading}
            role="HR_MEMBER"
            currentUsername={session.username}
            onRefresh={() => void loadUsers(session.token)}
            initialShowCreate={openHrCreate}
          />
        )}
        {activePage === "surveys" && <SurveysPage token={session.token} />}
        {activePage === "activities" && (
          <ActivitiesPage token={session.token} />
        )}
        {activePage === "reports" && <ReportsPage token={session.token} />}
        {activePage === "payments" && <PaymentsPage token={session.token} />}
      </main>
    </div>
  );
}
