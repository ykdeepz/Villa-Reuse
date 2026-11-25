import type { Item, ItemRequest, ListingReport } from "../types.js";
import { createRequest, submitReport } from "../data/systemStore.js";
import { getActiveUser } from "../data/profileData.js";
import { showToast } from "./feedback.js";

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function openItemModal(item: Item, onUpdate?: () => void): void {
  const activeUser = getActiveUser();
  // Ownership is an id check, never a name check — two members can share a
  // name, and the wrong person would be told "you posted this item".
  const isDonor = activeUser.id === item.donorId;
  const isExchange = item.listingType === "Exchange";

  let modalOverlay = document.getElementById("item-modal-overlay");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "item-modal-overlay";
    modalOverlay.className = "modal-overlay";
    document.body.append(modalOverlay);
  }

  modalOverlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-item-title">
      <button class="modal-close" type="button" aria-label="Close dialog">&times;</button>
      
      <div class="modal-body">
        <div class="modal-media">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
          <div class="modal-badges">
            <span class="card__status badge--status-${(item.status || "available").toLowerCase()}">${escapeHtml(item.status)}</span>
            <span class="card__type-pill ${isExchange ? "badge--exchange" : "badge--donation"}">${isExchange ? "Exchange Item" : "Free Donation"}</span>
          </div>
        </div>

        <div class="modal-info">
          <div class="modal-header">
            <span class="card__tag">${escapeHtml(item.category)}</span>
            <span class="modal-condition">Condition: <strong>${escapeHtml(item.condition)}</strong></span>
            <span class="modal-distance">${typeof item.distanceKm === "number" ? `${item.distanceKm} km away` : "Nearby"}</span>
          </div>

          <h2 class="modal-title" id="modal-item-title">${escapeHtml(item.title)}</h2>
          <p class="modal-donor">Shared by <strong>${escapeHtml(item.donorName)}</strong> · <small>${escapeHtml(item.postedAgo)}</small></p>

          <p class="modal-description">${escapeHtml(item.description || item.details || "No extra description provided.")}</p>

          ${
            isExchange && item.exchangeFor
              ? `
            <div class="exchange-box">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4m0 0L3 8m4-4 4 4m6 4v12m0 0 4-4m-4 4-4-4"/></svg>
              <div>
                <strong>Donor's Exchange Wishlist:</strong>
                <p>${escapeHtml(item.exchangeFor)}</p>
              </div>
            </div>
          `
              : ""
          }

          <div class="modal-coin-row">
            <span class="modal-coin-value">ReUse Coin Value: <strong>${item.coins} Coins</strong></span>
            <small style="color:var(--c-muted);">No payment needed. Free community transfer.</small>
          </div>

          <!-- Request Section -->
          ${
            isDonor
              ? `
            <div class="modal-notice">
              <p>You posted this item as <strong>${escapeHtml(item.donorName)}</strong>. Manage incoming claims in <a href="requests.html">Request Management</a>.</p>
            </div>
          `
              : item.status !== "Available"
              ? `
            <div class="modal-notice modal-notice--warning">
              <p>This item is currently <strong>${escapeHtml(item.status)}</strong> and not accepting new requests.</p>
            </div>
          `
              : `
            <form class="request-form" id="item-request-form">
              <h3 class="form-heading">Request this item</h3>
              
              ${
                isExchange
                  ? `
                <div class="field">
                  <label class="field__label" for="exchange-offer">What will you offer in exchange? <span class="req">*</span></label>
                  <input class="field__input" id="exchange-offer" required placeholder="e.g. Desk lamp, set of art pens, etc." />
                </div>
              `
                  : ""
              }

              <div class="field">
                <label class="field__label" for="request-note">Message to Donor / Provider</label>
                <textarea class="field__input field__textarea" id="request-note" rows="2" placeholder="Hi! I'd love to give this item a new home..."></textarea>
              </div>

              <div class="field">
                <label class="field__label" for="request-pickup">Preferred Pickup / Meetup Window <span class="req">*</span></label>
                <input class="field__input" id="request-pickup" required placeholder="e.g. Tomorrow afternoon, weekend morning" value="This weekend at community center" />
              </div>

              <button class="btn btn--solid modal-submit-btn" type="submit">
                ${isExchange ? "Submit Exchange Proposal" : "Send Donation Request"}
              </button>
            </form>
          `
          }

          <!-- Report Listing Section -->
          <details class="report-details">
            <summary class="report-summary">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              Report listing to Community Moderator
            </summary>
            
            <form class="report-form" id="report-form">
              <div class="field">
                <label class="field__label" for="report-reason">Reason for report</label>
                <select class="field__input field__select" id="report-reason">
                  <option value="Misleading description">Misleading description</option>
                  <option value="Inappropriate content">Inappropriate content</option>
                  <option value="Damaged or unsafe item">Damaged or unsafe item</option>
                  <option value="Duplicate / spam">Duplicate / spam</option>
                </select>
              </div>

              <div class="field">
                <label class="field__label" for="report-details">Details</label>
                <textarea class="field__input" id="report-details" rows="2" placeholder="Explain the issue to help our moderators review..."></textarea>
              </div>

              <button class="btn btn--ghost" type="submit" style="font-size:12px; padding:8px 14px;">
                Submit Flag to Moderator
              </button>
            </form>
          </details>
        </div>
      </div>
    </div>
  `;

  modalOverlay.classList.add("modal-overlay--open");
  document.body.style.overflow = "hidden";

  function closeModal(): void {
    modalOverlay?.classList.remove("modal-overlay--open");
    document.body.style.overflow = "";
  }

  modalOverlay.querySelector(".modal-close")?.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Handle Request Submission
  const requestForm = modalOverlay.querySelector<HTMLFormElement>("#item-request-form");
  if (requestForm) {
    requestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const offerInput = modalOverlay?.querySelector<HTMLInputElement>("#exchange-offer");
      const noteInput = modalOverlay?.querySelector<HTMLTextAreaElement>("#request-note");
      const pickupInput = modalOverlay?.querySelector<HTMLInputElement>("#request-pickup");

      if (isExchange && offerInput && !offerInput.value.trim()) {
        showToast("Please describe what item you offer in exchange.", "error");
        offerInput.focus();
        return;
      }

      const newReq: ItemRequest = {
        id: `req_${Date.now()}`,
        itemId: item.id,
        itemTitle: item.title,
        requesterId: activeUser.id || "usr_member",
        requesterName: activeUser.name,
        donorId: item.donorId,
        donorName: item.donorName,
        type: isExchange ? "Exchange Proposal" : "Donation Request",
        exchangeOffer: offerInput?.value.trim() || undefined,
        note: noteInput?.value.trim() || "Interested in this item.",
        pickupTime: pickupInput?.value.trim() || "To be arranged",
        status: "Pending",
        createdAt: "Just now",
      };

      try {
        await createRequest(newReq);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not send that request. Please try again.", "error");
        return;
      }
      showToast(`Your ${newReq.type.toLowerCase()} has been sent to ${item.donorName}. Track its status in Request Management.`);
      closeModal();
      if (onUpdate) onUpdate();
    });
  }

  // Handle Report Submission
  const reportForm = modalOverlay.querySelector<HTMLFormElement>("#report-form");
  if (reportForm) {
    reportForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const reasonSelect = modalOverlay?.querySelector<HTMLSelectElement>("#report-reason");
      const detailsInput = modalOverlay?.querySelector<HTMLTextAreaElement>("#report-details");

      const newReport: ListingReport = {
        id: `rep_${Date.now()}`,
        itemId: item.id,
        itemTitle: item.title,
        reporterName: activeUser.name,
        reason: (reasonSelect?.value as any) || "Misleading description",
        details: detailsInput?.value.trim() || "Reported for community review.",
        status: "Open",
        createdAt: "Just now",
      };

      try {
        await submitReport(newReport);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Could not submit that report. Please try again.", "error");
        return;
      }
      showToast(`Thank you, ${activeUser.name}. Your report on "${item.title}" has been submitted to the Community Moderator queue.`);
      closeModal();
    });
  }
}
