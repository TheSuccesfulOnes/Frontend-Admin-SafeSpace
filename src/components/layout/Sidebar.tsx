import type { PageKey } from "../../types/domain";
import { useLanguage } from "../../i18n/useLanguage";

type SidebarProps = {
  activePage: PageKey;
  counts: {
    administrators: number;
    employees: number;
    hrMembers: number;
  };
  displayName: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onPageChange: (page: PageKey) => void;
  onLogout: () => void;
};

const navigation: {
  key: PageKey;
  translation:
    | "overview"
    | "administrators"
    | "employees"
    | "hrMembers"
    | "surveys"
    | "activities"
    | "reports"
    | "payments";
  icon: string;
}[] = [
  { key: "overview", translation: "overview", icon: "dashboard" },
  {
    key: "administrators",
    translation: "administrators",
    icon: "admin_panel_settings",
  },
  { key: "employees", translation: "employees", icon: "groups" },
  { key: "hrMembers", translation: "hrMembers", icon: "support_agent" },
  { key: "surveys", translation: "surveys", icon: "poll" },
  { key: "activities", translation: "activities", icon: "event" },
  { key: "reports", translation: "reports", icon: "assignment" },
  { key: "payments", translation: "payments", icon: "payments" },
];

function getInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "AD";
}

export function Sidebar({
  activePage,
  counts,
  displayName,
  mobileOpen,
  onCloseMobile,
  onPageChange,
  onLogout,
}: SidebarProps) {
  const { t } = useLanguage();

  return (
    <>
      <button
        type="button"
        className={`mobile-menu-backdrop ${mobileOpen ? "visible" : ""}`}
        aria-label={t("closeMenu")}
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onCloseMobile}
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-mobile-header">
          <div className="brand-mark">
            <img
              className="brand-logo"
              src="/safe-space-logo.jpeg"
              alt="SafeSpace"
            />
            <div>
              <strong>{t("brandTitle")}</strong>
            </div>
          </div>
          <button
            type="button"
            className="mobile-menu-close"
            aria-label={t("closeMenu")}
            onClick={onCloseMobile}
          >
            ×
          </button>
        </div>
        <div className="workspace-label">{t("workspace")}</div>
        <nav id="admin-navigation" aria-label={t("workspace")}>
          {navigation.map((item) => (
            <button
              type="button"
              className={`nav-item ${activePage === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => onPageChange(item.key)}
            >
              <span
                className="nav-icon material-symbols-rounded"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {t(item.translation)}
              {item.key === "administrators" && (
                <span className="nav-count">{counts.administrators}</span>
              )}
              {item.key === "employees" && (
                <span className="nav-count">{counts.employees}</span>
              )}
              {item.key === "hrMembers" && (
                <span className="nav-count">{counts.hrMembers}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-account-actions">
            <span
              className="mini-avatar sidebar-account-avatar"
              aria-hidden="true"
            >
              {getInitials(displayName)}
            </span>
            <strong className="sidebar-account-name" title={displayName}>
              {displayName}
            </strong>
            <button type="button" className="logout-button" onClick={onLogout}>
              {t("signOut")}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
