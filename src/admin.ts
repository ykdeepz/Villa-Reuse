import { getUsers, getItems, getRequests, getAuditLogs, toggleUserStatus, initStore } from "./data/systemStore.js";
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

  // ACCESS CONTROL: ONLY System Administrator can access this page
  if (activeUser.role !== "System Administrator") {
    mainContainer.innerHTML = `
      <div class="access-denied-wrapper">
        <div class="access-denied-card">
          <div class="access-denied-card__icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <span class="access-denied-card__badge">Administrator Access Only</span>
          <h1 class="access-denied-card__title">System Administration Portal</h1>
          <p class="access-denied-card__text">
            This area requires <strong>System Administrator</strong> governance privileges. System metrics, user accounts, permissions, and audit logs are restricted from non-admin accounts.
          </p>
          <div class="access-denied-card__current">
            <span>Signed in as: <strong>${escapeHtml(activeUser.name)}</strong> (${escapeHtml(activeUser.role)})</span>
          </div>
          <div class="access-denied-card__actions">
            <a class="btn btn--solid" href="login-admin.html">Sign In as Administrator</a>
            <a class="btn btn--ghost" href="index.html">Return to Home</a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Active user IS a System Administrator
  const statTotalUsers = document.getElementById("stat-total-users") as HTMLElement;
  const statTotalItems = document.getElementById("stat-total-items") as HTMLElement;
  const statTotalRequests = document.getElementById("stat-total-requests") as HTMLElement;
  const statTotalWaste = document.getElementById("stat-total-waste") as HTMLElement;

  const tabUsers = document.getElementById("tab-users") as HTMLButtonElement;
  const tabLogs = document.getElementById("tab-logs") as HTMLButtonElement;
  const usersView = document.getElementById("users-view") as HTMLElement;
  const logsView = document.getElementById("logs-view") as HTMLElement;
  const usersTbody = document.getElementById("users-tbody") as HTMLTableSectionElement;
  const logsTbody = document.getElementById("logs-tbody") as HTMLTableSectionElement;

  function render(): void {
    const users = getUsers();
    const items = getItems();
    const requests = getRequests();
    const logs = getAuditLogs();

    if (statTotalUsers) statTotalUsers.textContent = String(users.length);
    if (statTotalItems) statTotalItems.textContent = String(items.filter((i) => !i.hidden).length);
    if (statTotalRequests) statTotalRequests.textContent = String(requests.length);
    if (statTotalWaste) statTotalWaste.textContent = "…";
    // Real diverted weight from the server (same figure as the Impact page).
    void fetch("/api/impact")
      .then((r) => (r.ok ? r.json() : null))
      .then((impact: { kgDiverted?: number } | null) => {
        if (statTotalWaste && impact && typeof impact.kgDiverted === "number") {
          statTotalWaste.textContent = `${impact.kgDiverted} kg`;
        }
      })
      .catch(() => undefined);

    // Render Users Table
    if (usersTbody) {
      usersTbody.replaceChildren();
      users.forEach((u) => {
        const tr = document.createElement("tr");
        const isSuspended = u.status === "Suspended";
        const isSelf = u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase();

        tr.innerHTML = `
          <td>
            <strong>${escapeHtml(u.name)}</strong>
            ${isSelf ? ` <span class="badge--protected">You</span>` : ""}<br/>
            <small style="color:var(--c-muted); font-size:11px;">${escapeHtml(u.email)}</small>
          </td>
          <td>
            <span class="card__type-pill" style="background:#eef1ef; font-size:11px;">${escapeHtml(u.role)}</span>
          </td>
          <td>${escapeHtml(u.neighborhood)}</td>
          <td>${u.itemsCount} items</td>
          <td>
            <span class="card__type-pill ${isSuspended ? "badge--req-rejected" : "badge--req-accepted"}">${escapeHtml(u.status)}</span>
          </td>
          <td style="text-align:right;">
            ${
              isSelf
                ? `<span class="self-account-note">Your account</span>`
                : `
              <button class="btn--sm ${isSuspended ? "btn--success" : "btn--danger"}" data-action="toggle-status" data-id="${u.id}">
                ${isSuspended ? "Reactivate" : "Suspend"}
              </button>
            `
            }
          </td>
        `;

        if (!isSelf) {
          const toggleBtn = tr.querySelector<HTMLButtonElement>('[data-action="toggle-status"]');
          if (toggleBtn) {
            toggleBtn.addEventListener("click", async () => {
              const suspending = u.status === "Active";
              const ok = await confirmAction({
                title: suspending ? "Suspend this account?" : "Reactivate this account?",
                message: suspending
                  ? `${u.name} will no longer be able to sign in or use the system until reactivated.`
                  : `${u.name} will be able to sign in and use the system again.`,
                confirmLabel: suspending ? "Suspend account" : "Reactivate account",
                danger: suspending,
              });
              if (!ok) return;
              try {
                await toggleUserStatus(u.id, activeUser.name, activeUser.id);
                showToast(`Resident ${u.name} is now ${suspending ? "Suspended" : "Active"}.`);
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Could not change that account's status.", "error");
              }
              render();
            });
          }
        }

        usersTbody.append(tr);
      });
    }

    // Render Logs Table
    if (logsTbody) {
      logsTbody.replaceChildren();
      logs.forEach((log) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="white-space:nowrap; font-size:12px; color:var(--c-muted);">${escapeHtml(log.timestamp)}</td>
          <td><strong>${escapeHtml(log.actor)}</strong></td>
          <td><small class="card__type-pill" style="background:#f3ece0; color:#8c5d08; font-size:10px;">${escapeHtml(log.role)}</small></td>
          <td><strong>${escapeHtml(log.action)}</strong></td>
          <td style="font-size:12px; color:var(--c-muted);">${escapeHtml(log.details)}</td>
        `;
        logsTbody.append(tr);
      });
    }
  }

  if (tabUsers && tabLogs && usersView && logsView) {
    tabUsers.addEventListener("click", () => {
      tabUsers.classList.add("tab-btn--active");
      tabLogs.classList.remove("tab-btn--active");
      usersView.style.display = "block";
      logsView.style.display = "none";
    });

    tabLogs.addEventListener("click", () => {
      tabLogs.classList.add("tab-btn--active");
      tabUsers.classList.remove("tab-btn--active");
      logsView.style.display = "block";
      usersView.style.display = "none";
    });
  }

  render();
}

void bootstrap();
