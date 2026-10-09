import { useState } from "react";
import type { FormEvent } from "react";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PasswordField } from "../components/PasswordField";
import { useLanguage } from "../i18n/useLanguage";
import { login } from "../services/authService";
import { isSystemAdmin } from "../services/adminService";
import type { AuthResponse } from "../types/domain";

type LoginPageProps = {
  onLogin: (auth: AuthResponse) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const auth = await login(identifier.trim(), password);
      if (!isSystemAdmin(auth.role)) {
        throw new Error("ADMIN_ONLY");
      }
      onLogin(auth);
    } catch {
      setError(t("loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-aside">
        <div className="brand-mark light">
          <img
            className="brand-logo"
            src="/safe-space-logo.jpeg"
            alt="SafeSpace"
          />
          <div>
            <strong>{t("brandTitle")}</strong>
          </div>
        </div>
        <div className="login-message">
          <span className="eyebrow">{t("controlCenter")}</span>
          <h1>{t("growHrTeam")}</h1>
          <p>{t("createHrIntro")}</p>
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-language-switcher">
          <LanguageSwitcher />
        </div>
        <form
          id="admin-login-form"
          className="login-form"
          onSubmit={submit}
          aria-busy={loading}
        >
          <span className="eyebrow">{t("welcomeBack")}</span>
          <h2>{t("signInTitle")}</h2>
          <p className="form-intro">{t("signInIntro")}</p>
          <label htmlFor="admin-login-identifier">
            {t("username")}
            <input
              id="admin-login-identifier"
              name="identifier"
              type="text"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
            />
          </label>
          <PasswordField
            id="admin-login-password"
            name="password"
            label={t("password")}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          {error && (
            <div id="admin-login-error" className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            id="admin-login-submit"
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? t("signingIn") : t("enterConsole")}
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}
