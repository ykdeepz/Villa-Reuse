import { getReports, resolveReport, addAuditLog, initStore } from "./data/systemStore.js";
import { initSession } from "./data/profileData.js";
import { syncNavigation } from "./components/navigation.js";
import { mountLogout } from "./components/auth.js";
import { showToast, confirmAction } from "./components/feedback.js";

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function bootstrap(): Promise<void> {
  await initSession();
  await initStore();
  const activeUser = syncNavigation();
  mountLogout();

  const mainContainer = document.querySelector<HTMLElement>(".content.page-shell-wide");
  if (!mainContainer) return;

  // ACCESS CONTROL: ONLY Community Moderator can access this page
  if (activeUser.role !== "Community Moderator") {
    mainContainer.innerHTML = `
      <div class="access-denied-wrapper">
        <div class="access-denied-card">
          <div class="access-denied-card__icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <span class="access-denied-card__badge">Access Restricted</span>
          <h1 class="access-denied-card__title">Community Moderator Portal</h1>
          <p class="access-denied-card__text">
            This page is strictly reserved for verified <strong>Community Moderators</strong>. Only moderators have permission to review reported listings, inspect user flags, and take enforcement actions.
          </p>
          <div class="access-denied-card__current">
            <span>Signed in as: <strong>${escapeHtml(activeUser.name)}</strong> (${escapeHtml(activeUser.role)})</span>
          </div>
          <div class="access-denied-card__actions">
            <a class="btn btn--solid" href="login-moderator.html">Sign In as Moderator</a>
            <a class="btn btn--ghost" href="index.html">Return to Home</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Active user IS a Community Moderator
  const statOpen = document.getElementById("stat-open-reports") as HTMLElement;
  const statDismissed = document.getElementById("stat-dismissed-reports") as HTMLElement;
  const statRemoved = document.getElementById("stat-removed-reports") as HTMLElement;
  const tbody = document.getElementById("reports-tbody") as HTMLTableSectionElement;

  function render(): void {
    const reports = getReports();

    const openCount = reports.filter((r) => r.status === "Open").length;
    const dismissedCount = reports.filter((r) => r.status === "Dismissed").length;
    const removedCount = reports.filter((r) => r.status === "Listing Removed").length;

    if (statOpen) statOpen.textContent = String(openCount);
    if (statDismissed) statDismissed.textContent = String(dismissedCount);
    if (statRemoved) statRemoved.textContent = String(removedCount);

    if (!tbody) return;
    tbody.replaceChildren();

    if (reports.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" style="text-align:center; padding: 30px; color:var(--c-muted);">No reports on record. All listings are clean!</td>`;
      tbody.append(tr);
      return;
    }

    reports.forEach((rep) => {
      const tr = document.createElement("tr");

      let badgeClass = "badge--req-pending";
      if (rep.status === "Dismissed") badgeClass = "badge--req-accepted";
      else if (rep.status === "Listing Removed") badgeClass = "badge--req-rejected";

      tr.innerHTML = `
        <td>
          <strong>${escapeHtml(rep.itemTitle)}</strong><br/>
          <small style="color:var(--c-muted); font-size:10.5px;">${escapeHtml(rep.itemId)}</small>
        </td>
        <td>
          ${escapeHtml(rep.reporterName)}<br/>
          <small style="color:var(--c-muted); font-size:10.5px;">${escapeHtml(rep.createdAt)}</small>
        </td>
        <td>
          <span style="font-weight:600; color:#c0392b;">${escapeHtml(rep.reason)}</span>
        </td>
        <td style="max-width:240px; font-size:12px; line-height:1.4;">
          ${escapeHtml(rep.details)}
        </td>
        <td>
          <span class="card__type-pill ${badgeClass}">${escapeHtml(rep.status)}</span>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          ${
            rep.status === "Open"
              ? `
            <button class="btn--sm btn--success" data-action="dismiss" data-id="${rep.id}">Dismiss</button>
            <button class="btn--sm btn--danger" data-action="remove" data-id="${rep.id}">Remove Listing</button>
            <button class="btn--sm btn--secondary" data-action="warn" data-id="${rep.id}">Warn</button>
          `
              : `
            <span style="font-size:11.5px; color:var(--c-muted); font-weight:600;">Resolved</span>
          `
          }
        </td>
      `;

      const dismissBtn = tr.querySelector<HTMLButtonElement>('[data-action="dismiss"]');
      const removeBtn = tr.querySelector<HTMLButtonElement>('[data-action="remove"]');
      const warnBtn = tr.querySelector<HTMLButtonElement>('[data-action="warn"]');

      if (dismissBtn) {
        dismissBtn.addEventListener("click", async () => {
          try {
            await resolveReport(rep.id, "Dismissed", activeUser.name);
            showToast(`Report on "${rep.itemTitle}" dismissed. The listing remains active.`, "info");
          } catch (err) {
            showToast(err instanceof Error ? err.message : "Could not dismiss that report.", "error");
          }
          render();
        });
      }

      if (removeBtn) {
        removeBtn.addEventListener("click", async () => {
          if (await confirmAction({ title: "Remove this listing?", message: `Remove "${rep.itemTitle}" from the community discover feed? Members will no longer see it.`, confirmLabel: "Remove listing", danger: true })) {
            try {
              await resolveReport(rep.id, "Listing Removed", activeUser.name);
              showToast(`Listing "${rep.itemTitle}" removed and hidden from community search.`);
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Could not remove that listing.", "error");
            }
            render();
          }
        });
      }

      if (warnBtn) {
        warnBtn.addEventListener("click", async () => {
          await addAuditLog({
            actor: activeUser.name,
            role: "Community Moderator",
            action: "Provider Warning Issued",
            details: `Issued warning for listing #${rep.itemId} based on report: ${rep.reason}`,
          });
          showToast("A formal reminder about listing guidelines has been logged for the item provider.", "info");
        });
      }

      tbody.append(tr);
    });
  }

  render();
}

void bootstrap();
