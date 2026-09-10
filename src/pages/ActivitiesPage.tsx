import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { PageContent } from "../components/layout/PageContent";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useLanguage } from "../i18n/useLanguage";
import {
  changeActivityStatus,
  createActivity,
  deleteActivity,
  getAdminActivities,
  updateActivity,
} from "../services/adminService";
import type { ActivityStatus, AdminActivity } from "../types/domain";

type ActivitiesPageProps = { token: string };
type ActivityForm = { title: string; description: string; options: string[] };

const emptyForm: ActivityForm = {
  title: "",
  description: "",
  options: ["", ""],
};

type PendingAction =
  | { type: "create"; form: ActivityForm }
  | { type: "edit"; activity: AdminActivity; form: ActivityForm }
  | { type: "delete"; activity: AdminActivity }
  | {
      type: "publish" | "close" | "reopen";
      activity: AdminActivity;
      status: ActivityStatus;
    };

export function ActivitiesPage({ token }: ActivitiesPageProps) {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [form, setForm] = useState<ActivityForm>(emptyForm);
  const [editingActivity, setEditingActivity] = useState<AdminActivity | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useAutoDismiss(message, setMessage);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setActivities(await getAdminActivities(token));
    } catch {
      setError(t("activityActionFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    // Initial API hydration is an intentional state synchronization.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadActivities();
  }, [loadActivities]);

  function openCreate() {
    setEditingActivity(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEdit(activity: AdminActivity) {
    setEditingActivity(activity);
    setForm({
      title: activity.title,
      description: activity.description,
      options: activity.options.map((option) => option.label),
    });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = form.options.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      setError(t("options"));
      return;
    }
    setMessage("");
    setError("");
    const input = { ...form, options };
    if (editingActivity) {
      setPendingAction({
        type: "edit",
        activity: editingActivity,
        form: input,
      });
      return;
    }

    setPendingAction({ type: "create", form: input });
  }

  function updateStatus(activity: AdminActivity, status: ActivityStatus) {
    setMessage("");
    setError("");
    const type = activity.status === "OPEN" ? "close" : "reopen";
    setPendingAction({ type, activity, status });
  }

  function remove(activity: AdminActivity) {
    setMessage("");
    setError("");
    setPendingAction({ type: "delete", activity });
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (action.type === "create") {
        await createActivity(token, action.form);
        setMessage(t("activityCreated"));
        setShowForm(false);
        setEditingActivity(null);
      } else if (action.type === "edit") {
        await updateActivity(token, action.activity.id, action.form);
        setMessage(t("activityUpdated"));
        setShowForm(false);
        setEditingActivity(null);
      } else if (action.type === "delete") {
        await deleteActivity(token, action.activity.id);
        setMessage(t("activityDeleted"));
      } else {
        await changeActivityStatus(token, action.activity.id, action.status);
        setMessage(t("activityUpdated"));
      }
      await loadActivities();
      setPendingAction(null);
    } catch {
      setPendingAction(null);
      setError(t("activityActionFailed"));
    } finally {
      setSaving(false);
    }
  }

  function updateOption(index: number, value: string) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    }));
  }

  return (
    <PageContent>
      <div className="section-title">
        <div>
          <span className="eyebrow">{t("accessManagement")}</span>
          <h2>{t("activities")}</h2>
          <p className="muted">{t("manageRoleAccounts")}</p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="outline-button"
            onClick={() => void loadActivities()}
          >
            ↻ {t("refresh")}
          </button>
          <button type="button" className="dark-button" onClick={openCreate}>
            ＋ {t("createActivity")}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-layout">
          <div className="panel create-panel">
            <button
              type="button"
              className="outline-button panel-cancel"
              onClick={() => setShowForm(false)}
            >
              {t("cancel")}
            </button>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  {editingActivity ? t("editAccount") : t("newAccount")}
                </span>
                <h3>
                  {editingActivity ? t("editActivity") : t("createActivity")}
                </h3>
              </div>
            </div>
            <form
              className={`admin-form ${editingActivity ? "stacked-form" : ""}`}
              onSubmit={submit}
            >
              <label>
                {t("activityTitle")}
                <input
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder={t("activityTitlePlaceholder")}
                />
              </label>
              <label>
                {t("description")}
                <textarea
                  maxLength={500}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder={t("descriptionPlaceholder")}
                />
              </label>
              <fieldset className="options-fieldset">
                <legend>{t("options")}</legend>
                {form.options.map((option, index) => (
                  <div className="option-row" key={index}>
                    <input
                      required
                      maxLength={160}
                      value={option}
                      onChange={(event) =>
                        updateOption(index, event.target.value)
                      }
                      placeholder={t("optionPlaceholder")}
                    />
                    {form.options.length > 2 && (
                      <button
                        type="button"
                        className="table-action danger"
                        onClick={() =>
                          setForm({
                            ...form,
                            options: form.options.filter(
                              (_, optionIndex) => optionIndex !== index,
                            ),
                          })
                        }
                      >
                        {t("removeOption")}
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setForm({ ...form, options: [...form.options, ""] })
                  }
                >
                  ＋ {t("addOption")}
                </button>
              </fieldset>
              {error && <div className="form-error">{error}</div>}
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? t("creating")
                  : editingActivity
                    ? t("updateAccount")
                    : t("createActivity")}
                <span>→</span>
              </button>
            </form>
          </div>
          <div className="note-block">
            <span className="eyebrow">{t("securityNote")}</span>
            <h3>{t("activities")}</h3>
            <p>{t("manageRoleAccounts")}</p>
          </div>
        </div>
      )}

      {message && (
        <div className="success-message page-message" role="status">
          {message}
        </div>
      )}
      {error && !showForm && (
        <div className="form-error page-message" role="alert">
          {error}
        </div>
      )}

      <div className="panel table-panel">
        <div className="table-toolbar">
          <strong>
            {activities.length} {t("activities")}
          </strong>
          <span>{t("sortedByCreation")}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("activityTitle")}</th>
                <th>{t("status")}</th>
                <th>{t("options")}</th>
                <th>{t("accountActions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {t("signingIn")}
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    {t("emptyUsers")}
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.id}>
                    <td data-label={t("activityTitle")}>
                      <strong>{activity.title}</strong>
                      <span className="table-secondary">
                        {activity.description}
                      </span>
                    </td>
                    <td data-label={t("status")}>
                      <span
                        className={`status status-${activity.status.toLowerCase()}`}
                      >
                        <i />
                        {t(activity.status === "OPEN" ? "open" : "closed")}
                      </span>
                    </td>
                    <td data-label={t("options")}>
                      <div className="option-summary">
                        {activity.options.map((option) => (
                          <span key={option.id}>
                            {option.label}: {option.percentage}% ({option.votes}
                            )
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label={t("accountActions")}>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action table-action-edit"
                          onClick={() => openEdit(activity)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className="table-action table-action-status"
                          disabled={saving}
                          onClick={() =>
                            void updateStatus(
                              activity,
                              activity.status === "OPEN" ? "CLOSED" : "OPEN",
                            )
                          }
                        >
                          {activity.status === "OPEN"
                            ? t("close")
                            : t("reopen")}
                        </button>
                        <button
                          type="button"
                          className="table-action danger"
                          disabled={saving}
                          onClick={() => void remove(activity)}
                        >
                          {t("deleteSurvey")}
                        </button>
                      </div>
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
          action={pendingAction.type}
          subject={
            pendingAction.type === "create"
              ? pendingAction.form.title
              : pendingAction.activity.title
          }
          busy={saving}
          title={
            pendingAction.type === "create"
              ? t("confirmCreateActivityTitle")
              : pendingAction.type === "edit"
                ? t("confirmEditActivityTitle")
                : pendingAction.type === "delete"
                  ? t("confirmDeleteActivityTitle")
                  : undefined
          }
          message={
            pendingAction.type === "create"
              ? t("confirmCreateActivityAction")
              : pendingAction.type === "edit"
                ? t("confirmEditActivityAction")
                : pendingAction.type === "delete"
                  ? t("confirmDeleteActivityAction")
                  : undefined
          }
          onCancel={() => {
            if (!saving) setPendingAction(null);
          }}
          onConfirm={() => void confirmPendingAction()}
        />
      )}
    </PageContent>
  );
}
