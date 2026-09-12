import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { PageContent } from "../components/layout/PageContent";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useLanguage } from "../i18n/useLanguage";
import {
  changeSurveyStatus,
  createSurvey,
  deleteSurvey,
  getAdminSurveys,
  getSurveyAnswers,
  getSurveyComments,
  type SurveyTransition,
  updateSurvey,
} from "../services/adminService";
import type {
  AdminSurvey,
  SurveyAnswer,
  SurveyComment,
  SurveyType,
} from "../types/domain";

type SurveysPageProps = { token: string };
type SurveyForm = {
  title: string;
  question: string;
  type: SurveyType;
  allowComments: boolean;
};

const emptyForm: SurveyForm = {
  title: "",
  question: "",
  type: "DAILY",
  allowComments: true,
};

type PendingAction =
  | { type: "create"; form: SurveyForm }
  | { type: "edit"; survey: AdminSurvey; form: SurveyForm }
  | { type: "delete"; survey: AdminSurvey }
  | { type: SurveyTransition; survey: AdminSurvey };

function statusTranslation(status: AdminSurvey["status"]) {
  return status === "DRAFT"
    ? "draft"
    : status === "PUBLISHED"
      ? "published"
      : "closed";
}

export function SurveysPage({ token }: SurveysPageProps) {
  const { t } = useLanguage();
  const [surveys, setSurveys] = useState<AdminSurvey[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswer[]>([]);
  const [comments, setComments] = useState<SurveyComment[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersError, setAnswersError] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [selectedSurvey, setSelectedSurvey] = useState<AdminSurvey | null>(
    null,
  );
  const [form, setForm] = useState<SurveyForm>(emptyForm);
  const [editingSurvey, setEditingSurvey] = useState<AdminSurvey | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useAutoDismiss(message, setMessage);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSurveys(await getAdminSurveys(token));
    } catch {
      setError(t("surveysFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, token]);

  useEffect(() => {
    // Initial API hydration is an intentional state synchronization.
    // oxlint-disable-next-line react/set-state-in-effect
    void loadSurveys();
  }, [loadSurveys]);

  function openCreate() {
    setEditingSurvey(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function openEdit(survey: AdminSurvey) {
    setEditingSurvey(survey);
    setForm({
      title: survey.title,
      question: survey.question,
      type: survey.type,
      allowComments: survey.allowComments,
    });
    setShowForm(true);
    setMessage("");
    setError("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingSurvey(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (editingSurvey) {
      setPendingAction({
        type: "edit",
        survey: editingSurvey,
        form: { ...form },
      });
      return;
    }

    setPendingAction({ type: "create", form: { ...form } });
  }

  function updateStatus(survey: AdminSurvey) {
    setMessage("");
    setError("");
    const transition: SurveyTransition =
      survey.status === "DRAFT"
        ? "publish"
        : survey.status === "PUBLISHED"
          ? "close"
          : "reopen";
    setPendingAction({ type: transition, survey });
  }

  function remove(survey: AdminSurvey) {
    setMessage("");
    setError("");
    setPendingAction({ type: "delete", survey });
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;

    setSaving(true);
    setMessage("");
    setError("");
    try {
      if (action.type === "create") {
        await createSurvey(token, action.form);
        setMessage(t("surveyCreated"));
        closeForm();
      } else if (action.type === "edit") {
        await updateSurvey(token, action.survey.id, action.form);
        setMessage(t("surveyUpdated"));
        closeForm();
      } else if (action.type === "delete") {
        await deleteSurvey(token, action.survey.id);
        setMessage(t("surveyDeleted"));
        if (selectedSurvey?.id === action.survey.id) {
          setSelectedSurvey(null);
          setAnswers([]);
          setComments([]);
          setAnswersError("");
          setCommentsError("");
        }
      } else {
        await changeSurveyStatus(token, action.survey.id, action.type);
        setMessage(t("surveyUpdated"));
      }
      await loadSurveys();
      setPendingAction(null);
    } catch {
      setPendingAction(null);
      setError(t("surveyActionFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function showAnswers(survey: AdminSurvey) {
    setSelectedSurvey(survey);
    setAnswers([]);
    setComments([]);
    setAnswersError("");
    setCommentsError("");
    setAnswersLoading(true);
    setCommentsLoading(true);

    const [answersResult, commentsResult] = await Promise.allSettled([
      getSurveyAnswers(token, survey.id),
      getSurveyComments(token, survey.id),
    ]);

    if (answersResult.status === "fulfilled") {
      setAnswers(answersResult.value);
    } else {
      setAnswersError(t("answersFailed"));
    }
    if (commentsResult.status === "fulfilled") {
      setComments(commentsResult.value);
    } else {
      setCommentsError(t("commentsFailed"));
    }
    setAnswersLoading(false);
    setCommentsLoading(false);
  }

  return (
    <PageContent>
      <div className="section-title">
        <div>
          <span className="eyebrow">{t("contentManagement")}</span>
          <h2>{t("surveys")}</h2>
          <p className="muted">{t("surveysIntro")}</p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="outline-button"
            onClick={() => void loadSurveys()}
            disabled={loading}
            aria-busy={loading}
          >
            ↻ {t("refresh")}
          </button>
          <button
            type="button"
            className="dark-button"
            onClick={openCreate}
            disabled={saving}
          >
            ＋ {t("createSurvey")}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="form-layout">
          <div className="panel create-panel">
            <button
              type="button"
              className="outline-button panel-cancel"
              onClick={closeForm}
            >
              {t("cancel")}
            </button>
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{t("surveyEditor")}</span>
                <h3>{editingSurvey ? t("editSurvey") : t("createSurvey")}</h3>
              </div>
            </div>
            <form
              className={`admin-form ${editingSurvey ? "stacked-form" : ""}`}
              onSubmit={submit}
            >
              <label>
                {t("surveyTitle")}
                <input
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder={t("surveyTitlePlaceholder")}
                />
              </label>
              <label>
                {t("question")}
                <textarea
                  required
                  maxLength={500}
                  value={form.question}
                  onChange={(event) =>
                    setForm({ ...form, question: event.target.value })
                  }
                  placeholder={t("questionPlaceholder")}
                />
              </label>
              <label>
                {t("surveyType")}
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value as SurveyType })
                  }
                >
                  <option value="DAILY">{t("daily")}</option>
                  <option value="WEEKLY">{t("weekly")}</option>
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.allowComments}
                  onChange={(event) =>
                    setForm({ ...form, allowComments: event.target.checked })
                  }
                />
                {t("allowComments")}
              </label>
              {error && <div className="form-error">{error}</div>}
              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? t("saving")
                  : editingSurvey
                    ? t("updateAccount")
                    : t("createSurvey")}
                <span>→</span>
              </button>
            </form>
          </div>
          <div className="note-block">
            <span className="eyebrow">{t("surveyEditor")}</span>
            <h3>{t("surveyLifecycle")}</h3>
            <p>{t("surveysIntro")}</p>
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
          <div className="table-toolbar-info">
            <strong>
              {surveys.length} {t("surveys")}
            </strong>
            <span>{t("sortedByCreation")}</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("surveyTitle")}</th>
                <th>{t("surveyType")}</th>
                <th>{t("status")}</th>
                <th>{t("answerCount")}</th>
                <th>{t("accountActions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t("signingIn")}
                  </td>
                </tr>
              ) : surveys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {t("noSurveys")}
                  </td>
                </tr>
              ) : (
                surveys.map((survey) => (
                  <tr key={survey.id}>
                    <td data-label={t("surveyTitle")}>
                      <strong>{survey.title}</strong>
                      <span className="table-secondary">{survey.question}</span>
                    </td>
                    <td className="mono" data-label={t("surveyType")}>
                      {t(survey.type === "DAILY" ? "daily" : "weekly")}
                    </td>
                    <td data-label={t("status")}>
                      <span
                        className={`status status-${survey.status.toLowerCase()}`}
                      >
                        <i />
                        {t(statusTranslation(survey.status))}
                      </span>
                    </td>
                    <td className="mono" data-label={t("answerCount")}>
                      {survey.answers}
                    </td>
                    <td data-label={t("accountActions")}>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="table-action table-action-edit"
                          onClick={() => openEdit(survey)}
                        >
                          {t("edit")}
                        </button>
                        <button
                          type="button"
                          className="table-action table-action-view"
                          disabled={saving || answersLoading || commentsLoading}
                          onClick={() => void showAnswers(survey)}
                        >
                          {t("viewAnswers")}
                        </button>
                        {survey.status === "DRAFT" && (
                          <button
                            type="button"
                            className="table-action table-action-status"
                            disabled={saving}
                            onClick={() => void updateStatus(survey)}
                          >
                            {t("publish")}
                          </button>
                        )}
                        {survey.status === "PUBLISHED" && (
                          <button
                            type="button"
                            className="table-action table-action-status"
                            disabled={saving}
                            onClick={() => void updateStatus(survey)}
                          >
                            {t("close")}
                          </button>
                        )}
                        {survey.status === "CLOSED" && (
                          <button
                            type="button"
                            className="table-action table-action-status"
                            disabled={saving}
                            onClick={() => void updateStatus(survey)}
                          >
                            {t("reopen")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="table-action danger"
                          disabled={saving}
                          onClick={() => void remove(survey)}
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

      {selectedSurvey && (
        <div className="panel answer-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{t("surveyAnswers")}</span>
              <h3>{selectedSurvey.title}</h3>
            </div>
            <button
              type="button"
              className="outline-button answer-panel-close"
              onClick={() => {
                setSelectedSurvey(null);
                setAnswers([]);
                setComments([]);
                setAnswersError("");
                setCommentsError("");
              }}
              aria-label={t("closeAnswers")}
            >
              {t("closeAnswers")}
            </button>
          </div>
          <SurveyAnswerList
            answers={answers}
            error={answersError}
            loading={answersLoading}
            onRetry={() => void showAnswers(selectedSurvey)}
          />
          <SurveyCommentList
            comments={comments}
            error={commentsError}
            loading={commentsLoading}
            onRetry={() => void showAnswers(selectedSurvey)}
          />
        </div>
      )}
      {pendingAction && (
        <ConfirmationDialog
          action={pendingAction.type}
          subject={
            pendingAction.type === "create"
              ? pendingAction.form.title
              : pendingAction.survey.title
          }
          busy={saving}
          title={
            pendingAction.type === "create"
              ? t("confirmCreateSurveyTitle")
              : pendingAction.type === "edit"
                ? t("confirmEditSurveyTitle")
                : pendingAction.type === "delete"
                  ? t("confirmDeleteSurveyTitle")
                  : undefined
          }
          message={
            pendingAction.type === "create"
              ? t("confirmCreateSurveyAction")
              : pendingAction.type === "edit"
                ? t("confirmEditSurveyAction")
                : pendingAction.type === "delete"
                  ? t("confirmDeleteSurveyAction")
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

function SurveyAnswerList({
  answers,
  error,
  loading,
  onRetry,
}: {
  answers: SurveyAnswer[];
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="answer-section" aria-labelledby="survey-answer-list">
      <div className="answer-section-heading">
        <div>
          <span className="eyebrow">{t("surveyAnswers")}</span>
          <strong id="survey-answer-list">
            {answers.length} {t("answerCount").toLowerCase()}
          </strong>
        </div>
      </div>
      {loading ? (
        <div className="answer-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          {t("answersLoading")}
        </div>
      ) : error ? (
        <div className="answer-error" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-button" onClick={onRetry}>
            {t("retry")}
          </button>
        </div>
      ) : answers.length === 0 ? (
        <p className="muted">{t("noAnswers")}</p>
      ) : (
        <div className="answer-list">
          {answers.map((answer) => (
            <article className="answer-item" key={answer.id}>
              <div>
                <strong>{answer.displayName || t("anonymous")}</strong>
                <span className="table-secondary">{answer.email}</span>
              </div>
              <p>{answer.answerText}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SurveyCommentList({
  comments,
  error,
  loading,
  onRetry,
}: {
  comments: SurveyComment[];
  error: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const { t } = useLanguage();

  return (
    <section
      className="answer-section survey-comments-section"
      aria-labelledby="survey-comment-list"
    >
      <div className="answer-section-heading">
        <div>
          <span className="eyebrow">{t("surveyComments")}</span>
          <strong id="survey-comment-list">
            {comments.length} {t("commentsCount")}
          </strong>
        </div>
        <span className="answer-section-note">{t("anonymousOnly")}</span>
      </div>
      {loading ? (
        <div className="answer-loading" role="status" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          {t("commentsLoading")}
        </div>
      ) : error ? (
        <div className="answer-error" role="alert">
          <span>{error}</span>
          <button type="button" className="outline-button" onClick={onRetry}>
            {t("retry")}
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p className="muted">{t("noComments")}</p>
      ) : (
        <div className="survey-comment-list">
          {comments.map((comment) => (
            <SurveyCommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </section>
  );
}

function SurveyCommentItem({
  comment,
  depth = 0,
}: {
  comment: SurveyComment;
  depth?: number;
}) {
  const { t } = useLanguage();

  return (
    <article
      className={
        depth > 0
          ? "survey-comment-item survey-comment-reply"
          : "survey-comment-item"
      }
    >
      <div className="survey-comment-content">
        <span className="survey-comment-label">
          {depth > 0 ? t("anonymousReply") : t("anonymousComment")}
        </span>
        <p>{comment.content}</p>
      </div>
      <div className="survey-comment-meta">
        <span>
          {comment.likes} {t("likes")}
        </span>
        {comment.replies.length > 0 && (
          <span>
            {comment.replies.length} {t("replies")}
          </span>
        )}
      </div>
      {comment.replies.length > 0 && (
        <div className="survey-comment-replies">
          {comment.replies.map((reply) => (
            <SurveyCommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </article>
  );
}
