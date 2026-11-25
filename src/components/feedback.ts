// In-app feedback — replaces the browser's alert() / confirm() popups on
// the main flows with a small toast and a styled confirm dialog that match
// the site's design system (see css/components/feedback.css).

export function showToast(message: string, variant: "success" | "error" | "info" = "success"): void {
  let stack = document.querySelector<HTMLElement>(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.append(stack);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  stack.append(toast);
  window.setTimeout(() => toast.classList.add("toast--out"), 3400);
  window.setTimeout(() => toast.remove(), 3900);
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** Styled replacement for confirm(): resolves true when confirmed. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay modal-overlay--open confirm-overlay";
    overlay.innerHTML = `
      <div class="modal-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="confirm-dialog__body">
          <h2 class="confirm-dialog__title" id="confirm-title"></h2>
          <p class="confirm-dialog__message"></p>
          <div class="confirm-dialog__actions">
            <button type="button" class="btn btn--ghost" data-confirm-cancel></button>
            <button type="button" class="btn ${options.danger ? "btn--danger-solid" : "btn--solid"}" data-confirm-ok></button>
          </div>
        </div>
      </div>
    `;
    const title = overlay.querySelector<HTMLElement>("#confirm-title");
    const message = overlay.querySelector<HTMLElement>(".confirm-dialog__message");
    const okBtn = overlay.querySelector<HTMLButtonElement>("[data-confirm-ok]");
    const cancelBtn = overlay.querySelector<HTMLButtonElement>("[data-confirm-cancel]");
    if (title) title.textContent = options.title;
    if (message) message.textContent = options.message;
    if (okBtn) okBtn.textContent = options.confirmLabel || "Confirm";
    if (cancelBtn) cancelBtn.textContent = options.cancelLabel || "Cancel";

    function close(result: boolean): void {
      overlay.remove();
      document.body.style.overflow = "";
      resolve(result);
    }
    okBtn?.addEventListener("click", () => close(true));
    cancelBtn?.addEventListener("click", () => close(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    document.body.style.overflow = "hidden";
    document.body.append(overlay);
    cancelBtn?.focus();
  });
}
