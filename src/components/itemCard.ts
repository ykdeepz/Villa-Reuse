import type { Item } from "../types.js";
import { getFavorites } from "../data/systemStore.js";

const HEART_ICON = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z"/></svg>`;

const PIN_ICON = `<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
const COIN_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></svg>`;

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function createItemCard(item: Item): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.itemId = item.id;

  const statusClass = `badge--status-${(item.status || "available").toLowerCase()}`;
  const isExchange = item.listingType === "Exchange";
  const typeBadgeClass = isExchange ? "badge--exchange" : "badge--donation";

  card.innerHTML = `
    <div class="card__media">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
      <button class="card__fav${getFavorites().includes(item.id) ? " card__fav--active" : ""}" type="button" data-action="fav-item" data-id="${item.id}" aria-label="Save ${escapeHtml(item.title)} to favorites" aria-pressed="${getFavorites().includes(item.id)}">${HEART_ICON}</button>
      <span class="card__distance">${PIN_ICON} ${item.distanceKm} km</span>
      <span class="card__status ${statusClass}">${escapeHtml(item.status || "Available")}</span>
    </div>
    <div class="card__body">
      <div class="card__meta">
        <span class="card__tag">${escapeHtml(item.category)}</span>
        <span class="card__type-pill ${typeBadgeClass}">${isExchange ? "Exchange" : "Free Donation"}</span>
        <span>${escapeHtml(item.postedAgo)}</span>
      </div>
      <h3 class="card__title">${escapeHtml(item.title)}</h3>
      <p class="card__details">${escapeHtml(item.details || `${item.condition} condition`)}</p>
      ${isExchange && item.exchangeFor ? `<p class="card__exchange-for"><strong>Looking for:</strong> ${escapeHtml(item.exchangeFor)}</p>` : ""}
      <div class="card__donor-info">
        <small>Shared by <strong>${escapeHtml(item.donorName)}</strong></small>
      </div>
      <div class="card__footer">
        <span class="card__price">${COIN_ICON} ${item.coins} Coins</span>
        <button class="card__action-btn" type="button" data-action="view-item" data-id="${item.id}">
          View & Request <span>›</span>
        </button>
      </div>
    </div>
  `;
  return card;
}
