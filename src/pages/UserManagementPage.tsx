import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { PageContent } from "../components/layout/PageContent";
import { useAutoDismiss } from "../hooks/useAutoDismiss";
import { useLanguage } from "../i18n/useLanguage";
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserEnabled,
  updateUser,
} from "../services/adminService";
import type { UpdateUserInput } from "../services/adminService";
import type { Role, User } from "../types/domain";

type UserManagementPageProps = {
  token: string;
  users: User[];
  loading: boolean;
  role: Role;
  currentUsername: string;
  onRefresh: () => Promise<void> | void;
  initialShowCreate?: boolean;
};

type UserForm = {
  displayName: string;
  username: string;
  email: string;
  password: string;
};

const emptyForm: UserForm = {
  displayName: "",
  username: "",
  email: "",
  password: "",
};

const roleOptions: Role[] = ["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"];

type PendingAction =
  | { type: "create"; input: UserForm; role: Role }
  | { type: "delete"; user: User }
  | { type: "disable"; user: User }
  | { type: "enable"; user: User }
  | { type: "edit"; user: User; input: UpdateUserInput }
  | { type: "password"; user: User };

function roleTranslation(role: Role) {
  return role === "EMPLOYEE"
    ? "roleEmployee"
    : role === "HR_MEMBER"
      ? "roleHrMember"
      : "roleSystemAdmin";
}

export function UserManagementPage({
  token,
  users,
  loading,
  role,
  currentUsername,
  onRefresh,
  initialShowCreate = false,
}: UserManagementPageProps) {
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(initialShowCreate);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useAutoDismiss(message, setMessage);

  const roleUsers = useMemo(
    () => users.filter((user) => user.role === role),
    [role, users],
  );
  const [usernameQuery, setUsernameQuery] = useState("");
  const filteredRoleUsers = useMemo(() => {
    const query = usernameQuery.trim().toLowerCase();
    if (!query) return roleUsers;

    return roleUsers.filter((user) =>
      user.username.toLowerCase().includes(query),
    );
  }, [roleUsers, usernameQuery]);

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function openCreate() {
    clearFeedback();
    setPendingAction(null);
    setEditingUser(null);
    setPasswordUser(null);
    setForm(emptyForm);
    setShowCreate(true);
  }

  function openEdit(user: User) {
    clearFeedback();
    setPendingAction(null);
    setPasswordUser(null);
    setShowCreate(false);
    setEditingUser(user);
    setForm({
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      password: "",
    });
  }

  function closeForms() {
    setShowCreate(false);
    setEditingUser(null);
    setPasswordUser(null);
    setNewPassword("");
    setConfirmNewPassword("");
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setPendingAction({ type: "create", input: { ...form }, role });
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;
    clearFeedback();
    setPendingAction({
      type: "edit",
      user: editingUser,
      input: {
        displayName: form.displayName,
        username: form.username,
        email: form.email,
        role: editingUser.role,
      },
    });
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordUser) return;
    clearFeedback();
    if (newPassword.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    setPendingAction({ type: "password", user: passwordUser });
  }

  function requestStatusChange(user: User) {
    clearFeedback();
    setPendingAction({
      type: user.enabled ? "disable" : "enable",
      user,
    });
  }

  function requestDelete(user: User) {
    clearFeedback();
    setPendingAction({ type: "delete", user });
  }

  async function confirmPendingAction() {
    const action = pendingAction;
    if (!action) return;

    setSaving(true);
    try {
      if (action.type === "create") {
        await createUser(token, { ...action.input, role: action.role });
        setMessage(t("accountCreated"));
        setForm(emptyForm);
        closeForms();
        await onRefresh();
      } else if (action.type === "edit") {
        await updateUser(token, action.user.id, action.input);
        setMessage(t("accountUpdated"));
        closeForms();
        await onRefresh();
      } else if (action.type === "password") {
        await resetUserPassword(token, action.user.id, newPassword);
        setMessage(t("passwordUpdated"));
        closeForms();
      } else if (action.type === "delete") {
        await deleteUser(token, action.user.id);
        setMessage(t("accountDeleted"));
        await onRefresh();
      } else {
        await setUserEnabled(token, action.user.id, action.type === "enable");
        setMessage(
          t(action.type === "enable" ? "accountEnabled" : "accountDisabled"),
        );
        await onRefresh();
      }
      setPendingAction(null);
    } catch (errorValue) {
      setPendingAction(null);
      if (action.type === "create") {
        setError(accountErrorMessage(errorValue, t("createAccountFailed")));
      } else if (action.type === "edit") {
        setError(accountErrorMessage(errorValue, t("updateAccountFailed")));
      } else if (action.type === "password") {
        setError(t("passwordUpdateFailed"));
      } else if (action.type === "delete") {
        setError(t("deleteAccountFailed"));
      } else {
        setError(t("accountStatusFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  function updateForm(field: keyof UserForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function accountErrorMessage(errorValue: unknown, fallback: string) {
    const message = errorValue instanceof Error ? errorValue.message : "";
    if (message === "Username is already in use") {
      return t("usernameAlreadyUsed");
    }
    if (message === "Email is already in use") {
      return t("emailAlreadyUsed");
    }
    return fallback;
  }

  return (
    <>
      <PageContent>
        <div className="section-title">
          <div>
            <span className="eyebrow">{t("identityDirectory")}</span>
            <h2>{t(roleTranslation(role))}</h2>
            <p className="muted">{t("manageRoleAccounts")}</p>
          </div>
          <div className="section-actions">
            <button
              type="button"
              className="outline-button"
              onClick={onRefresh}
            >
              ↻ {t("refresh")}
            </button>
            <button type="button" className="dark-button" onClick={openCreate}>
              ＋ {t("createAccount")}
            </button>
          </div>
        </div>

        {(showCreate || editingUser || passwordUser) && (
          <div className="form-layout">
            {(showCreate || editingUser) && (
              <div className="panel create-panel">
                <button
                  type="button"
                  className="outline-button panel-cancel"
                  onClick={closeForms}
                >
                  {t("cancel")}
                </button>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      {showCreate ? t("newAccount") : t("editAccount")}
                    </span>
                    <h3>
                      {showCreate ? t("createAccount") : t("editAccount")}
                    </h3>
                  </div>
                </div>
                <form
                  onSubmit={showCreate ? submitCreate : submitEdit}
                  className="admin-form"
                >
                  <label>
                    {t("displayName")}
                    <input
                      required
                      value={form.displayName}
                      onChange={(event) =>
                        updateForm("displayName", event.target.value)
                      }
                      placeholder={t("displayNamePlaceholder")}
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    {t("username")}
                    <input
                      required
                      value={form.username}
                      onChange={(event) =>
                        updateForm("username", event.target.value)
                      }
                      placeholder={t("usernamePlaceholder")}
                      autoComplete="username"
                    />
                  </label>
                  <label>
                    {t("email")}
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateForm("email", event.target.value)
                      }
                      placeholder={t("emailPlaceholder")}
                      autoComplete="email"
                    />
                  </label>
                  {showCreate && (
                    <label>
                      {t("temporaryPassword")}
                      <input
                        required
                        type="password"
                        minLength={8}
                        value={form.password}
                        onChange={(event) =>
                          updateForm("password", event.target.value)
                        }
                        placeholder={t("passwordPlaceholder")}
                        autoComplete="new-password"
                      />
                    </label>
                  )}
                  {editingUser && (
                    <label>
                      {t("role")}
                      <select
                        value={editingUser.role}
                        onChange={(event) =>
                          setEditingUser({
                            ...editingUser,
                            role: event.target.value as Role,
                          })
                        }
                      >
                        {roleOptions.map((option) => (
                          <option key={option} value={option}>
                            {t(roleTranslation(option))}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {message && <div className="success-message">{message}</div>}
                  {error && <div className="form-error">{error}</div>}
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={saving}
                  >
                    {saving
                      ? t("creating")
                      : showCreate
                        ? t("createAccount")
                        : t("updateAccount")}
                    <span>→</span>
                  </button>
                </form>
              </div>
            )}

            {passwordUser && (
              <div className="panel create-panel">
                <button
                  type="button"
                  className="outline-button panel-cancel"
                  onClick={closeForms}
                >
                  {t("cancel")}
                </button>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">{t("securityNote")}</span>
                    <h3>{t("resetPassword")}</h3>
                  </div>
                </div>
                <p className="muted">{passwordUser.displayName}</p>
                <form onSubmit={submitPassword} className="admin-form">
                  <label>
                    {t("newPassword")}
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    {t("confirmPassword")}
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(event) =>
                        setConfirmNewPassword(event.target.value)
                      }
                      placeholder={t("passwordPlaceholder")}
                      autoComplete="new-password"
                    />
                  </label>
                  {message && <div className="success-message">{message}</div>}
                  {error && <div className="form-error">{error}</div>}
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={saving}
                  >
                    {saving ? t("creating") : t("resetPassword")} <span>→</span>
                  </button>
                </form>
              </div>
            )}

            <div className="note-block">
              <span className="eyebrow">{t("securityNote")}</span>
              <h3>{t("keepAccessIntentional")}</h3>
              <p>{t("securityDescription")}</p>
            </div>
          </div>
        )}

        {message && !showCreate && !editingUser && !passwordUser && (
          <div className="success-message page-message" role="status">
            {message}
          </div>
        )}
        {error && !showCreate && !editingUser && !passwordUser && (
          <div className="form-error page-message" role="alert">
            {error}
          </div>
        )}

        <div className="panel table-panel">
          <div className="table-toolbar">
            <div className="table-toolbar-info">
              <strong>
                {filteredRoleUsers.length} {t("accounts")}
              </strong>
              <span>{t("sortedByCreation")}</span>
            </div>
            <div className="table-search">
              <label
                htmlFor={`username-search-${role.toLowerCase()}`}
                className="sr-only"
              >
                {t("searchByUsername")}
              </label>
              <input
                id={`username-search-${role.toLowerCase()}`}
                type="search"
                value={usernameQuery}
                onChange={(event) => setUsernameQuery(event.target.value)}
                placeholder={t("searchByUsername")}
                autoComplete="off"
                maxLength={50}
              />
              {usernameQuery && (
                <button
                  type="button"
                  className="table-search-clear"
                  aria-label={t("clearSearch")}
                  title={t("clearSearch")}
                  onClick={() => setUsernameQuery("")}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("person")}</th>
                  <th>{t("username")}</th>
                  <th>{t("status")}</th>
                  <th>{t("email")}</th>
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
                ) : filteredRoleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      {usernameQuery.trim()
                        ? t("noSearchMatches")
                        : t("noRoleAccounts")}
                    </td>
                  </tr>
                ) : (
                  filteredRoleUsers.map((user) => {
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
                        <td data-label={t("status")}>
                          <span
                            className={`status ${user.enabled ? "enabled" : "disabled"}`}
                          >
                            <i />
                            {user.enabled ? t("enabled") : t("disabled")}
                          </span>
                        </td>
                        <td className="muted" data-label={t("email")}>
                          {user.email}
                        </td>
                        <td data-label={t("accountActions")}>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="table-action table-action-edit"
                              disabled={isProtectedOwner}
                              title={
                                isProtectedOwner
                                  ? t("ownerProtectedAccount")
                                  : undefined
                              }
                              onClick={() => openEdit(user)}
                            >
                              {t("edit")}
                            </button>
                            <button
                              type="button"
                              className="table-action table-action-security"
                              disabled={isProtectedOwner}
                              title={
                                isProtectedOwner
                                  ? t("ownerProtectedAccount")
                                  : undefined
                              }
                              onClick={() => {
                                clearFeedback();
                                setPendingAction(null);
                                setShowCreate(false);
                                setEditingUser(null);
                                setPasswordUser(user);
                              }}
                            >
                              {t("resetPassword")}
                            </button>
                            <button
                              type="button"
                              className="table-action table-action-status"
                              disabled={
                                saving ||
                                user.username === currentUsername ||
                                isProtectedOwner
                              }
                              title={
                                isProtectedOwner
                                  ? t("ownerProtectedAccount")
                                  : undefined
                              }
                              onClick={() => requestStatusChange(user)}
                            >
                              {user.enabled
                                ? t("disableAccount")
                                : t("enableAccount")}
                            </button>
                            <button
                              type="button"
                              className="table-action danger"
                              disabled={
                                saving ||
                                user.username === currentUsername ||
                                isProtectedOwner
                              }
                              title={
                                isProtectedOwner
                                  ? t("ownerProtectedAccount")
                                  : undefined
                              }
                              onClick={() => requestDelete(user)}
                            >
                              {t("deleteAccount")}
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
      {pendingAction && (
        <ConfirmationDialog
          action={pendingAction.type}
          subject={
            "user" in pendingAction
              ? pendingAction.user.displayName
              : pendingAction.input.displayName
          }
          busy={saving}
          onCancel={() => {
            if (!saving) setPendingAction(null);
          }}
          onConfirm={() => void confirmPendingAction()}
        />
      )}
    </>
  );
}
