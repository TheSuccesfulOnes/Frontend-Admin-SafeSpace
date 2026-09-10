import { useEffect, useId } from "react";
import { useLanguage } from "../i18n/useLanguage";

export type ConfirmationAction =
  | "create"
  | "delete"
  | "disable"
  | "enable"
  | "edit"
  | "password"
  | "publish"
  | "close"
  | "reopen"
  | "status";

type ConfirmationDialogProps = {
  action: ConfirmationAction;
  subject: string;
  busy: boolean;
  title?: string;
  message?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmationDialog({
  action,
  subject,
  busy,
  title: customTitle,
  message: customMessage,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const { t } = useLanguage();
  const titleId = useId();
  const messageId = useId();
  const destructive = action === "delete" || action === "disable";
  const titleKey = {
    create: "confirmCreateTitle",
    delete: "confirmDeleteTitle",
    disable: "confirmDisableTitle",
    enable: "confirmEnableTitle",
    edit: "confirmEditTitle",
    password: "confirmPasswordTitle",
    publish: "confirmPublishTitle",
    close: "confirmCloseTitle",
    reopen: "confirmReopenTitle",
    status: "confirmStatusTitle",
  } as const;
  const messageKey = {
    create: "confirmCreateAction",
    delete: "confirmDeleteAccount",
    disable: "confirmDisableAccount",
    enable: "confirmEnableAccount",
    edit: "confirmEditAccount",
    password: "confirmPasswordAction",
    publish: "confirmPublishAction",
    close: "confirmCloseAction",
    reopen: "confirmReopenAction",
    status: "confirmStatusAction",
  } as const;
  const title = customTitle ?? t(titleKey[action]);
  const message = customMessage ?? t(messageKey[action]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop">
      <section
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <span className="eyebrow">{t("confirmationRequired")}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>
          {message} <strong>{subject}</strong>
        </p>
        <div className="confirmation-actions">
          <button
            type="button"
            className="outline-button"
            onClick={onCancel}
            disabled={busy}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`dark-button ${destructive ? "confirmation-danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? t("saving") : t("confirmAction")}
          </button>
        </div>
      </section>
    </div>
  );
}
