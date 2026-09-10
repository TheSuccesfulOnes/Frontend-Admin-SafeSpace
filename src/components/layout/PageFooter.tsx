import { useLanguage } from "../../i18n/useLanguage";

export function PageFooter() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="page-footer">
      <span>
        {t("copyright")} {year} SafeSpace. {t("allRightsReserved")}
      </span>
    </footer>
  );
}
