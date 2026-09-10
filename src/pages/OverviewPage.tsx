import { useEffect, useState } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { Metric } from "../components/Metric";
import { PageContent } from "../components/layout/PageContent";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useLanguage } from "../i18n/useLanguage";
import { setUserEnabled } from "../services/adminService";
import type { User } from "../types/domain";

type OverviewPageProps = {
  token: string;
  users: User[];
  loading: boolean;
  currentUsername: string;
  onEmployees: () => void;
  onHr: () => void;
  onRefresh: () => Promise<void> | void;
};

export function OverviewPage({
  token,
  users,
  loading,
  currentUsername,
  onEmployees,
  onHr,
  onRefresh,
}: OverviewPageProps) {
  const { language, t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [pendingEnableUser, setPendingEnableUser] = useState<User | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const active = users.filter((user) => user.enabled).length;
  const disabledUsers = users.filter((user) => !user.enabled);
  const employees = users.filter((user) => user.role === "EMPLOYEE").length;
  const hrMembers = users.filter((user) => user.role === "HR_MEMBER").length;

  useAutoDismiss(actionMessage, setActionMessage);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const date = new Intl.DateTimeFormat(language === "es" ? "es-PE" : "en-US", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(currentTime)
    .toUpperCase();
  const hour = currentTime.getHours();
  const greetingKey =
    hour >= 5 && hour < 12
      ? "goodMorning"
      : hour >= 12 && hour < 18
        ? "goodAfternoon"
        : "goodNight";

  function requestEnable(user: User) {
    setActionMessage("");
    setActionError("");
    setPendingEnableUser(user);
  }

  async function confirmEnable() {
    if (!pendingEnableUser) return;

    setEnabling(true);
    setActionError("");
    try {
      await setUserEnabled(token, pendingEnableUser.id, true);
      setPendingEnableUser(null);
      setActionMessage(t("accountEnabled"));
      await onRefresh();
    } catch {
      setPendingEnableUser(null);
      setActionError(t("accountStatusFailed"));
    } finally {
      setEnabling(false);
    }
  }

  return (
    <>
      <PageContent>
        <div className="welcome-row">
          <div>
            <p className="kicker">{date}</p>
            <h2>{t(greetingKey)}</h2>
            <p className="muted">{t("workspacePulse")}</p>
          </div>
          <button
            type="button"
            className="outline-button"
            onClick={onEmployees}
          >
            {t("viewAllUsers")} <span>→</span>
          </button>
        </div>
        <div className="metric-grid">
          <Metric
            label={t("totalAccounts")}
            value={loading ? "—" : users.length}
            note={t("acrossWorkspace")}
          />
          <Metric
            label={t("employees")}
            value={loading ? "—" : employees}
            note={t("registeredWorkers")}
            accent="coral"
          />
          <Metric
            label={t("hrMembers")}
            value={loading ? "—" : hrMembers}
            note={t("hrMembersNote")}
            accent="gold"
          />
          <Metric
            label={t("activeAccountsLabel")}
            value={loading ? "—" : active}
            note={t("currentlyEnabled")}
            accent="sage"
          />
        </div>
        <div className="content-grid">
          <div className="panel quick-panel">
            <span className="eyebrow">{t("quickAction")}</span>
            <h3>{t("growHrTeam")}</h3>
            <p>{t("createHrIntro")}</p>
            <button type="button" className="dark-button" onClick={onHr}>
              {t("createHrMember")}
            </button>
          </div>
        </div>
        {actionMessage && (
          <div className="success-message page-message" role="status">
            {actionMessage}
          </div>
        )}
        {actionError && (
          <div className="form-error page-message" role="alert">
            {actionError}
          </div>
        )}
        <div className="panel table-panel">
          <div className="table-toolbar">
            <div className="table-toolbar-info">
              <strong>
                {disabledUsers.length} {t("disabledAccounts")}
              </strong>
              <span>{t("disabledAccountsNote")}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("person")}</th>
                  <th>{t("username")}</th>
                  <th>{t("role")}</th>
                  <th>{t("status")}</th>
                  <th>{t("email")}</th>
                  <th>{t("accountActions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      {t("signingIn")}
                    </td>
                  </tr>
                ) : disabledUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      {t("noDisabledAccounts")}
                    </td>
                  </tr>
                ) : (
                  disabledUsers.map((user) => {
                    const isProtectedOwner =
                      user.systemOwner && user.username !== currentUsername;

                    return (
                      <tr key={user.id}>
                        <td data-label={t("person")}>
                          <div className="person-cell">
                            <span className="mini-avatar">
                              {user.displayName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <strong>{user.displayName}</strong>
                              {user.systemOwner && (
                                <span className="table-secondary owner-label">
                                  {t("systemOwner")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="mono" data-label={t("username")}>
                          @{user.username}
                        </td>
                        <td data-label={t("role")}>
                          <span
                            className={`role role-${user.role.toLowerCase()}`}
                          >
                            {t(
                              user.role === "EMPLOYEE"
                                ? "roleEmployee"
                                : user.role === "HR_MEMBER"
                                  ? "roleHrMember"
                                  : "roleSystemAdmin",
                            )}
                          </span>
                        </td>
                        <td data-label={t("status")}>
                          <span className="status disabled">
                            <i />
                            {t("disabled")}
                          </span>
                        </td>
                        <td className="muted" data-label={t("email")}>
                          {user.email}
                        </td>
                        <td data-label={t("accountActions")}>
                          <div className="table-actions overview-table-actions">
                            <button
                              type="button"
                              className="table-action table-action-status"
                              disabled={enabling || isProtectedOwner}
                              title={
                                isProtectedOwner
                                  ? t("ownerProtectedAccount")
                                  : undefined
                              }
                              onClick={() => requestEnable(user)}
                            >
                              {t("enableAccount")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContent>
      {pendingEnableUser && (
        <ConfirmationDialog
          action="enable"
          subject={pendingEnableUser.displayName}
          busy={enabling}
          onCancel={() => setPendingEnableUser(null)}
          onConfirm={() => void confirmEnable()}
        />
      )}
    </>
  );
}
