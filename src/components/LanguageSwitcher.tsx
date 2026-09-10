import { useLanguage } from "../i18n/useLanguage";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="language-switcher" aria-label={t("languageSwitcherLabel")}>
      <button
        type="button"
        className={language === "en" ? "selected" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        title={t("english")}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "es" ? "selected" : ""}
        onClick={() => setLanguage("es")}
        aria-pressed={language === "es"}
        title={t("spanish")}
      >
        ES
      </button>
    </div>
  );
}
