import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { PageContent } from "../components/layout/PageContent";
import { useLanguage } from "../i18n/useLanguage";
import type { TranslationKey } from "../i18n/translations";
import { getPaymentPlans, recordPayment } from "../services/adminService";
import type { PaymentPlan, PaymentPlanCode } from "../types/domain";

type PaymentsPageProps = {
  token: string;
};

type PendingPayment = {
  beneficiaryName: string;
  plan: PaymentPlanCode;
  voucher: File;
};

const MAX_VOUCHER_BYTES = 10 * 1024 * 1024;

function planName(
  plan: PaymentPlanCode,
  translate: (key: TranslationKey) => string,
) {
  return translate(plan === "MONTHLY" ? "monthlyPlan" : "annualPlan");
}

function planDescription(
  plan: PaymentPlanCode,
  translate: (key: TranslationKey) => string,
) {
  return translate(
    plan === "MONTHLY" ? "monthlyPlanDescription" : "annualPlanDescription",
  );
}

function durationLabel(durationMonths: number, language: "en" | "es") {
  if (language === "es") {
    return `${durationMonths} ${durationMonths === 1 ? "mes" : "meses"}`;
  }
  return `${durationMonths} ${durationMonths === 1 ? "month" : "months"}`;
}

export function PaymentsPage({ token }: PaymentsPageProps) {
  const { language, t } = useLanguage();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanCode | "">("");
  const [voucher, setVoucher] = useState<File | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [nextPaymentDate, setNextPaymentDate] = useState("");
  const [error, setError] = useState("");
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(
    null,
  );
  const voucherInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    // Plan loading is an intentional synchronization with the protected API.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoadingPlans(true);
    void getPaymentPlans(token)
      .then((availablePlans) => {
        if (mounted) setPlans(availablePlans);
      })
      .catch(() => {
        if (mounted) setError(t("paymentPlansFailed"));
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });

    return () => {
      mounted = false;
    };
  }, [t, token]);

  function clearFeedback() {
    setError("");
  }

  function dismissSuccess() {
    setMessage("");
    setNextPaymentDate("");
  }

  function clearVoucher() {
    clearFeedback();
    setVoucher(null);
    if (voucherInputRef.current) voucherInputRef.current.value = "";
  }

  function handleVoucherChange(file: File | undefined) {
    clearFeedback();
    // Keep the current voucher when the file picker is cancelled.
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf || file.size > MAX_VOUCHER_BYTES) {
      clearVoucher();
      setError(t("paymentVoucherInvalid"));
      return;
    }
    setVoucher(file);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!beneficiaryName.trim() || !selectedPlan || !voucher) {
      setError(t("paymentFormIncomplete"));
      return;
    }
    setPendingPayment({
      beneficiaryName: beneficiaryName.trim(),
      plan: selectedPlan,
      voucher,
    });
  }

  async function confirmPayment() {
    if (!pendingPayment) return;
    setSaving(true);
    clearFeedback();
    try {
      const payment = await recordPayment(token, {
        beneficiaryName: pendingPayment.beneficiaryName,
        plan: pendingPayment.plan,
        voucher: pendingPayment.voucher,
      });
      setMessage(t("paymentCreated"));
      setNextPaymentDate(payment.nextPaymentDate);
      setBeneficiaryName("");
      setSelectedPlan("");
      setVoucher(null);
      if (voucherInputRef.current) voucherInputRef.current.value = "";
      setPendingPayment(null);
    } catch (errorValue) {
      setPendingPayment(null);
      setError(
        errorValue instanceof Error ? errorValue.message : t("paymentFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const formattedNextPayment = nextPaymentDate
    ? new Intl.DateTimeFormat(language === "es" ? "es-PE" : "en-US", {
        dateStyle: "long",
      }).format(new Date(`${nextPaymentDate}T12:00:00`))
    : "";

  return (
    <PageContent>
      <div className="section-title">
        <div>
          <span className="eyebrow">{t("accessManagement")}</span>
          <h2>{t("payments")}</h2>
          <p className="muted">{t("paymentsIntro")}</p>
        </div>
      </div>

      {message && (
        <div
          className="success-message page-message payment-success"
          role="status"
        >
          <div className="payment-success-copy">
            <strong>{message}</strong>
            {formattedNextPayment && (
              <span>
                {t("nextPayment")}: {formattedNextPayment}
              </span>
            )}
          </div>
          <button
            type="button"
            className="payment-success-close"
            aria-label={t("dismissNotification")}
            title={t("dismissNotification")}
            onClick={dismissSuccess}
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="form-error page-message" role="alert">
          {error}
        </div>
      )}

      <div className="form-layout payment-layout">
        <section className="panel create-panel payment-panel">
          <div className="panel-heading">
            <span className="eyebrow">{t("paymentUpload")}</span>
            <h3>{t("paymentUpload")}</h3>
          </div>
          <form className="admin-form stacked-form" onSubmit={submit}>
            <label htmlFor="payment-user">
              {t("paymentBeneficiary")}
              <input
                id="payment-user"
                type="text"
                value={beneficiaryName}
                onChange={(event) => setBeneficiaryName(event.target.value)}
                onFocus={clearFeedback}
                placeholder={t("paymentBeneficiaryPlaceholder")}
                autoComplete="off"
                required
              />
            </label>

            <label htmlFor="payment-plan">
              {t("paymentPlan")}
              <select
                id="payment-plan"
                value={selectedPlan}
                onChange={(event) => {
                  clearFeedback();
                  setSelectedPlan(event.target.value as PaymentPlanCode | "");
                }}
                disabled={loadingPlans || plans.length === 0}
                required
              >
                <option value="">{t("paymentPlanPlaceholder")}</option>
                {plans.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {planName(plan.code, t)}
                  </option>
                ))}
              </select>
            </label>

            <div className="payment-file-field">
              <span className="payment-field-label">{t("paymentVoucher")}</span>
              <input
                id="payment-voucher"
                ref={voucherInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  handleVoucherChange(event.target.files?.[0])
                }
              />
              <div className="payment-file-actions">
                <label htmlFor="payment-voucher" className="file-picker-button">
                  {voucher ? t("changeVoucher") : t("chooseVoucher")}
                </label>
                {voucher && (
                  <button
                    type="button"
                    className="file-remove-button"
                    onClick={clearVoucher}
                  >
                    {t("removeVoucher")}
                  </button>
                )}
              </div>
              <span className="payment-file-help">
                {voucher
                  ? `${t("selectedVoucher")}: ${voucher.name}`
                  : t("paymentVoucherHelp")}
              </span>
            </div>

            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? t("paymentUploading") : t("paymentUpload")}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>

        <aside className="payment-plan-summary" aria-label={t("paymentPlan")}>
          <span className="eyebrow">{t("paymentPlan")}</span>
          <h3>{t("payments")}</h3>
          <div className="payment-plan-list">
            {plans.map((plan) => (
              <div className="payment-plan-card" key={plan.code}>
                <div>
                  <strong>{planName(plan.code, t)}</strong>
                  <p>{planDescription(plan.code, t)}</p>
                </div>
                <span>{durationLabel(plan.durationMonths, language)}</span>
              </div>
            ))}
          </div>
          <p className="payment-security-note">
            {t("paymentSecurityDescription")}
          </p>
        </aside>
      </div>

      {pendingPayment && (
        <ConfirmationDialog
          action="create"
          subject={pendingPayment.beneficiaryName}
          title={t("confirmPaymentTitle")}
          message={`${t("confirmPaymentAction")} ${planName(pendingPayment.plan, t)}.`}
          busy={saving}
          onCancel={() => {
            if (!saving) setPendingPayment(null);
          }}
          onConfirm={() => void confirmPayment()}
        />
      )}
    </PageContent>
  );
}
