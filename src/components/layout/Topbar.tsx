import { LanguageSwitcher } from "../LanguageSwitcher";
import { useLanguage } from "../../i18n/useLanguage";
import type { PageKey } from "../../types/domain";

type TopbarProps = {
  activePage: PageKey;
  apiConnected: boolean;
  mobileMenuOpen: boolean;
  onMenuToggle: () => void;
};

export function Topbar({
  activePage,
  apiConnected,
  mobileMenuOpen,
  onMenuToggle,
}: TopbarProps) {
  const { t } = useLanguage();
  const pageTitle = {
    overview: "overview",
    administrators: "administrators",
    employees: "employees",
    hrMembers: "hrMembers",
    surveys: "surveys",
    activities: "activities",
    reports: "reports",
    payments: "payments",
  } satisfies Record<
    PageKey,
    keyof typeof import("../../i18n/translations").translations.en
  >;

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label={t("openMenu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-navigation"
          onClick={onMenuToggle}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <span className="eyebrow">{t("systemAdministration")}</span>
          <h1>{t(pageTitle[activePage])}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="api-status">
          <i className={apiConnected ? "connected" : "disconnected"} />
          {apiConnected ? t("apiConnected") : t("apiUnavailable")}
        </span>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
