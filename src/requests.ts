import { getRequests, updateRequestStatus, initStore } from "./data/systemStore.js";
import { initSession } from "./data/profileData.js";
import { syncNavigation } from "./components/navigation.js";
import { mountLogout } from "./components/auth.js";
import { showToast, confirmAction } from "./components/feedback.js";
import { cancelRequest } from "./data/systemStore.js";

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


  const tabIncoming = document.getElementById("tab-incoming") as HTMLButtonElement;
  const tabSent = document.getElementById("tab-sent") as HTMLButtonElement;
  const countIncoming = document.getElementById("count-incoming") as HTMLElement;
  const countSent = document.getElementById("count-sent") as HTMLElement;
  const listContainer = document.getElementById("requests-list") as HTMLElement;

  let currentTab: "incoming" | "sent" = "incoming";

  function render(): void {
    const allRequests = getRequests();

    // Unified accounts: "incoming" = requests for items I posted,
    // "sent" = requests I made. Staff roles see all incoming for oversight.
    const isStaff = activeUser.role === "Community Moderator" || activeUser.role === "System Administrator";
    const incoming = allRequests.filter((r) => r.donorId === activeUser.id || isStaff);
    const sent = allRequests.filter((r) => r.requesterId === activeUser.id);

    countIncoming.textContent = String(incoming.length);
    countSent.textContent = String(sent.length);

    listContainer.replaceChildren();

    const displayList = currentTab === "incoming" ? incoming : sent;

    if (displayList.length === 0) {
      const empty = document.createElement("div");
      empty.className = "grid__empty-container";
      empty.innerHTML = `
        <p class="grid__empty">No ${currentTab === "incoming" ? "incoming requests yet" : "requests sent yet"} — nothing to feel bad about, it just means a quiet day in the neighborhood.</p>
        <small style="color:var(--c-muted); display:block; margin-top:6px;">
          ${currentTab === "incoming" ? "Post an item and neighbors can send you donation claims or exchange proposals." : "Find something useful on the Home page and send your first request."}
        </small>
        <div class="empty-actions">
          ${currentTab === "incoming"
            ? `<a class="btn btn--solid" href="donate.html">Post an item</a>`
            : `<a class="btn btn--solid" href="index.html">Browse items</a>`}
        </div>
      `;
      listContainer.append(empty);
      return;
    }

    displayList.forEach((req) => {
      const card = document.createElement("article");
      card.className = "request-card";

      const statusBadge = `<span class="card__type-pill badge--req-${req.status.toLowerCase()}">${req.status}</span>`;
      const isIncoming = currentTab === "incoming";

      card.innerHTML = `
        <div class="request-card__main">
          <div class="request-card__header">
            <h3 class="request-card__title">${escapeHtml(req.itemTitle)}</h3>
            <span class="card__type-pill ${req.type.includes("Exchange") ? "badge--exchange" : "badge--donation"}">${escapeHtml(req.type)}</span>
            ${statusBadge}
          </div>

          <p class="request-card__meta">
            ${isIncoming ? `Requested by <strong>${escapeHtml(req.requesterName)}</strong>` : `Requested from <strong>${escapeHtml(req.donorName)}</strong>`} · <small>${escapeHtml(req.createdAt)}</small>
          </p>

          ${
            req.exchangeOffer
              ? `
            <div class="request-card__proposal">
              <strong>Exchange Item Offered:</strong> ${escapeHtml(req.exchangeOffer)}
            </div>
          `
              : ""
          }

          <p class="request-card__note">"${escapeHtml(req.note)}"</p>
          <p class="request-card__pickup"><strong>Pickup window:</strong> ${escapeHtml(req.pickupTime)}</p>
        </div>

        <div class="request-card__actions">
          ${
            isIncoming
              ? `
            ${
              req.status === "Pending"
                ? `
              <button class="btn--sm btn--success" data-action="accept" data-id="${req.id}">Accept Request</button>
              <button class="btn--sm btn--danger" data-action="reject" data-id="${req.id}">Decline</button>
            `
                : ""
            }
            ${
              req.status === "Accepted"
                ? `
              <button class="btn--sm btn--success" data-action="complete" data-id="${req.id}">Mark Completed</button>
            `
                : ""
            }
            ${
              req.status === "Completed"
                ? `
              <span style="font-size:11px; color:var(--c-green-700); font-weight:700;">Handoff Complete</span>
            `
                : ""
            }
            ${
              req.status === "Rejected"
                ? `
              <span style="font-size:11px; color:#9b1c1c; font-weight:700;">Declined</span>
            `
                : ""
            }
          `
              : `
            <span style="font-size:12px; color:var(--c-muted); display:block; margin-bottom:8px;">
              ${req.status === "Pending" ? "Awaiting provider response" : req.status === "Accepted" ? "Approved! Ready for pickup" : req.status === "Completed" ? "Exchange complete" : "Declined by provider"}
            </span>
            ${
              req.requesterId === activeUser.id && req.status === "Pending"
                ? `<button class="btn--sm btn--danger" data-action="cancel" data-id="${req.id}">Cancel Request</button>`
                : ""
            }
          `
          }
        </div>
      `;

      // Bind actions for donor
      if (isIncoming) {
        const acceptBtn = card.querySelector<HTMLButtonElement>('[data-action="accept"]');
        const rejectBtn = card.querySelector<HTMLButtonElement>('[data-action="reject"]');
        const completeBtn = card.querySelector<HTMLButtonElement>('[data-action="complete"]');

        if (acceptBtn) {
          acceptBtn.addEventListener("click", async () => {
            try {
              await updateRequestStatus(req.id, "Accepted", activeUser.name);
              showToast(`Request for "${req.itemTitle}" accepted! The item is now Reserved.`);
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Could not accept that request.", "error");
            }
            render();
          });
        }

        if (rejectBtn) {
          rejectBtn.addEventListener("click", async () => {
            if (await confirmAction({ title: "Decline this request?", message: `Decline the request from ${req.requesterName} for "${req.itemTitle}"? The item will become Available again.`, confirmLabel: "Decline request", danger: true })) {
              try {
                await updateRequestStatus(req.id, "Rejected", activeUser.name);
                showToast(`Request for "${req.itemTitle}" declined.`, "info");
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Could not decline that request.", "error");
              }
              render();
            }
          });
        }

        if (completeBtn) {
          completeBtn.addEventListener("click", async () => {
            try {
              await updateRequestStatus(req.id, "Completed", activeUser.name);
              showToast(`Great work! Transfer for "${req.itemTitle}" marked Completed. ReUse impact recorded!`);
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Could not complete that request.", "error");
            }
            render();
          });
        }
      }

      // Bind "cancel my own request" on the Sent tab
      const cancelBtn = card.querySelector<HTMLButtonElement>('[data-action="cancel"]');
      if (cancelBtn) {
        cancelBtn.addEventListener("click", async () => {
          const ok = await confirmAction({
            title: "Cancel this request?",
            message: `Cancel your request for "${req.itemTitle}"? The item will become available for others.`,
            confirmLabel: "Cancel request",
            danger: true,
          });
          if (!ok) return;
          try {
            await cancelRequest(req.id);
            showToast(`Your request for "${req.itemTitle}" was cancelled.`, "info");
          } catch {
            showToast("Could not cancel that request. It may no longer be pending.", "error");
          }
          render();
        });
      }

      listContainer.append(card);
    });
  }

  tabIncoming.addEventListener("click", () => {
    currentTab = "incoming";
    tabIncoming.classList.add("tab-btn--active");
    tabSent.classList.remove("tab-btn--active");
    tabIncoming.setAttribute("aria-selected", "true");
    tabSent.setAttribute("aria-selected", "false");
    render();
  });

  tabSent.addEventListener("click", () => {
    currentTab = "sent";
    tabSent.classList.add("tab-btn--active");
    tabIncoming.classList.remove("tab-btn--active");
    tabSent.setAttribute("aria-selected", "true");
    tabIncoming.setAttribute("aria-selected", "false");
    render();
  });

  render();
}

void bootstrap();
