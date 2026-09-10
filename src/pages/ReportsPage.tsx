import { useCallback, useEffect, useState } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { PageContent } from "../components/layout/PageContent";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useLanguage } from "../i18n/useLanguage";
import { getReports, updateReportStatus } from "../services/adminService";
import type { Report, ReportPriority, ReportStatus } from "../types/domain";

type ReportsPageProps = { token: string };
type PendingAction = {
  id: number;
  title: string;
  status: ReportStatus;
};

function priorityTranslation(priority: ReportPriority) {
  return priority.toLowerCase() as "low" | "normal" | "high" | "urgent";
}

function statusTranslation(status: ReportStatus) {
  return status === "NEW"
    ? "new"
    : status === "IN_REVIEW"
      ? "inReview"
      : status === "ADDRESSED"
        ? "addressed"
        : "closed";
}

export function ReportsPage({ token }: ReportsPageProps) {
  const { t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useAutoDismiss(message, setMessage);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReports(await getReports(token));
    } catch {
      setError(t("reportsFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    // Initial API hydration is an intentional state synchronization.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadReports();
  }, [loadReports]);

  function changeStatus(id: number, status: ReportStatus, title: string) {
    setMessage("");
    setError("");
    setPendingAction({ id, title, status });
  }

  async function confirmStatusChange() {
    const action = pendingAction;
    if (!action) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await updateReportStatus(token, action.id, action.status);
      setReports((current) =>
        current.map((report) => (report.id === action.id ? updated : report)),
      );
      setMessage(t("reportStatusUpdated"));
      setPendingAction(null);
    } catch {
      setPendingAction(null);
      setError(t("reportsFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContent>
      <div className="section-title">
        <div>
          <span className="eyebrow">{t("accessManagement")}</span>
          <h2>{t("reports")}</h2>
          <p className="muted">{t("reportsIntro")}</p>
        </div>
        <button
          type="button"
          className="outline-button"
          onClick={() => void loadReports()}
        >
          ↻ {t("refresh")}
        </button>
      </div>
      {message && (
        <div className="success-message page-message" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="form-error page-message" role="alert">
          {error}
        </div>
      )}
      <div className="panel table-panel">
        <div className="table-toolbar">
          <strong>
            {reports.length} {t("reports")}
          </strong>
          <span>{t("sortedByCreation")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("reportTitle")}</th>
                <th>{t("reportCategory")}</th>
                <th>{t("priority")}</th>
                <th>{t("reportStatus")}</th>
                <th>{t("reportDescription")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t("signingIn")}
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t("emptyUsers")}
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td data-label={t("reportTitle")}>
                      <strong>{report.title}</strong>
                      <span className="table-secondary">
                        {report.anonymous ? t("anonymous") : t("person")}
                      </span>
                    </td>
                    <td data-label={t("reportCategory")}>{report.category}</td>
                    <td data-label={t("priority")}>
                      <span
                        className={`priority priority-${report.priority.toLowerCase()}`}
                      >
                        {t(priorityTranslation(report.priority))}
                      </span>
                    </td>
                    <td data-label={t("reportStatus")}>
                      <select
                        className="table-select"
                        value={report.status}
                        disabled={saving}
                        onChange={(event) =>
                          void changeStatus(
                            report.id,
                            event.target.value as ReportStatus,
                            report.title,
                          )
                        }
                        aria-label={`${t("reportStatus")}: ${report.title}`}
                      >
                        <option value="NEW">
                          {t(statusTranslation("NEW"))}
                        </option>
                        <option value="IN_REVIEW">
                          {t(statusTranslation("IN_REVIEW"))}
                        </option>
                        <option value="ADDRESSED">
                          {t(statusTranslation("ADDRESSED"))}
                        </option>
                        <option value="CLOSED">
                          {t(statusTranslation("CLOSED"))}
                        </option>
                      </select>
                    </td>
                    <td
                      className="report-description"
                      data-label={t("reportDescription")}
                    >
                      {report.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {pendingAction && (
        <ConfirmationDialog
          action="status"
          subject={pendingAction.title}
          busy={saving}
          onCancel={() => {
            if (!saving) setPendingAction(null);
          }}
          onConfirm={() => void confirmStatusChange()}
        />
      )}
    </PageContent>
  );
}
