// Header notifications bell — real data from the server.
//
// The bell used to show a hard-coded badge ("3"). It now loads
// GET /api/notifications for the signed-in user: the badge is the real
// unread count (hidden when zero), and clicking the bell opens a panel
// with the latest notifications and marks them read on the server.

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

let mounted = false;

export function mountNotifications(): void {
  if (mounted) return;
  const bell = document.querySelector<HTMLElement>('.header .icon-btn[aria-label="Notifications"]');
  if (!bell) return;
  mounted = true;

  // Wrap the bell so the dropdown panel can anchor to it.
  const wrap = document.createElement("span");
  wrap.className = "notif-wrap";
  bell.parentElement?.insertBefore(wrap, bell);
  wrap.append(bell);

  let badge = bell.querySelector<HTMLElement>(".icon-btn__badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "icon-btn__badge";
    bell.append(badge);
  }
  badge.style.display = "none";

  const panel = document.createElement("div");
  panel.className = "notif-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <p class="notif-panel__title">Notifications</p>
    <div class="notif-panel__list"><p class="notif-panel__empty">Loading…</p></div>
  `;
  wrap.append(panel);
  const listEl = panel.querySelector<HTMLElement>(".notif-panel__list");

  function setBadge(unread: number): void {
    if (!badge) return;
    badge.textContent = String(unread);
    badge.style.display = unread > 0 ? "grid" : "none";
  }

  async function load(): Promise<AppNotification[]> {
    const res = await fetch("/api/notifications");
    if (!res.ok) return [];
    const data = (await res.json()) as { notifications: AppNotification[]; unread: number };
    setBadge(data.unread);
    return data.notifications;
  }

  function render(notifications: AppNotification[]): void {
    if (!listEl) return;
    if (notifications.length === 0) {
      listEl.innerHTML = `<p class="notif-panel__empty">You're all caught up — no notifications yet. When someone requests your items or answers your requests, updates will appear here.</p>`;
      return;
    }
    listEl.innerHTML = notifications
      .map(
        (n) => `
        <div class="notif-item${n.read ? "" : " notif-item--unread"}">
          <p class="notif-item__message">${escapeHtml(n.message)}</p>
          <p class="notif-item__time">${escapeHtml(n.createdAt)}</p>
        </div>`
      )
      .join("");
  }

  bell.addEventListener("click", async (event) => {
    event.stopPropagation();
    const opening = panel.hidden;
    panel.hidden = !opening;
    if (opening) {
      const notifications = await load();
      render(notifications);
      // Opening the panel marks everything read on the server.
      await fetch("/api/notifications/read", { method: "POST" }).catch(() => undefined);
      setBadge(0);
    }
  });
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !wrap.contains(event.target as Node)) panel.hidden = true;
  });

  void load();
}
