import { getActiveUser, ACTIVITY, initSession } from "./data/profileData.js";
import {
  initStore, getItems, getFavorites, toggleFavorite,
  updateOwnItem, deleteOwnItem,
} from "./data/systemStore.js";
import type { Item } from "./types.js";
import { confirmAction } from "./components/feedback.js";
import { renderProfile } from "./components/profileCard.js";
import { createActivityRow } from "./components/activityList.js";
import { syncNavigation } from "./components/navigation.js";
import { mountLogout } from "./components/auth.js";
import { showToast } from "./components/feedback.js";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

const CATEGORIES = ["Clothes", "Appliances", "Books", "School Supplies", "Household Items", "Furniture", "Others"];
const CONDITIONS = ["Like New", "Good", "Fair"];

async function bootstrap(): Promise<void> {
  await initSession();
  await initStore();
  const activeUser = getActiveUser();
  syncNavigation(activeUser);
  renderProfile(activeUser);
  mountLogout();


  const list = requireElement<HTMLUListElement>("activity-list");
  list.append(...ACTIVITY.map(createActivityRow));

  list.addEventListener("click", (event) => {
    const row = (event.target as HTMLElement).closest<HTMLButtonElement>(".activity-row");
    if (row) console.log("Open activity:", row.dataset.id);
  });

  requireElement<HTMLButtonElement>("edit-profile").addEventListener("click", () => {
    showToast("Profile details are fixed for the demo accounts — but you can manage your listings and favorites below.", "info");
  });

  // ------------------------------------------------------------ my listings
  const listingsEl = requireElement<HTMLElement>("my-listings");
  const favoritesEl = requireElement<HTMLElement>("my-favorites");

  function renderListings(): void {
    const mine = getItems().filter((i) => i.donorId === activeUser.id);
    listingsEl.replaceChildren();
    if (mine.length === 0) {
      listingsEl.innerHTML = `<p class="my-empty">You haven't posted any items yet. Share something you no longer need — it takes a minute, and you earn ReUse Coins for it.</p>`;
      return;
    }
    mine.forEach((item) => {
      const row = document.createElement("article");
      row.className = "my-item";
      row.innerHTML = `
        <img class="my-item__thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
        <div class="my-item__main">
          <h3 class="my-item__title">${escapeHtml(item.title)}</h3>
          <p class="my-item__meta">${escapeHtml(item.category)} · ${escapeHtml(item.condition)} · <strong>${escapeHtml(item.status)}</strong>${item.hidden ? " · Hidden by moderation" : ""}</p>
          <p class="my-item__desc">${escapeHtml(item.description || "")}</p>
        </div>
        <div class="my-item__actions">
          <button class="btn--sm btn--success" data-action="edit" type="button">Edit</button>
          <button class="btn--sm btn--danger" data-action="delete" type="button">Delete</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]')?.addEventListener("click", () => openEditForm(item));
      row.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
        const ok = await confirmAction({
          title: "Delete this listing?",
          message: `Delete "${item.title}" permanently? This cannot be undone.`,
          confirmLabel: "Delete listing",
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteOwnItem(item.id);
          showToast(`"${item.title}" was deleted.`, "info");
        } catch {
          showToast("Could not delete that listing.", "error");
        }
        renderListings();
        renderFavorites();
      });
      listingsEl.append(row);
    });
  }

  function openEditForm(item: Item): void {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay modal-overlay--open";
    overlay.innerHTML = `
      <div class="modal-dialog edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <button class="modal-close" type="button" aria-label="Close dialog">&times;</button>
        <form class="edit-form" id="edit-item-form">
          <h2 class="edit-form__title" id="edit-title">Edit listing</h2>
          <div class="field">
            <label class="field__label" for="edit-item-title">Title</label>
            <input class="field__input" id="edit-item-title" required />
          </div>
          <div class="field">
            <label class="field__label" for="edit-item-desc">Description</label>
            <textarea class="field__input field__textarea" id="edit-item-desc" rows="3"></textarea>
          </div>
          <div class="field">
            <label class="field__label" for="edit-item-category">Category</label>
            <select class="field__input field__select" id="edit-item-category">
              ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label class="field__label" for="edit-item-condition">Condition</label>
            <select class="field__input field__select" id="edit-item-condition">
              ${CONDITIONS.map((c) => `<option value="${c}">${c}</option>`).join("")}
            </select>
          </div>
          <div class="confirm-dialog__actions">
            <button type="button" class="btn btn--ghost" data-edit-cancel>Cancel</button>
            <button type="submit" class="btn btn--solid">Save changes</button>
          </div>
        </form>
      </div>
    `;
    const titleInput = overlay.querySelector<HTMLInputElement>("#edit-item-title");
    const descInput = overlay.querySelector<HTMLTextAreaElement>("#edit-item-desc");
    const catSelect = overlay.querySelector<HTMLSelectElement>("#edit-item-category");
    const condSelect = overlay.querySelector<HTMLSelectElement>("#edit-item-condition");
    if (titleInput) titleInput.value = item.title;
    if (descInput) descInput.value = item.description || "";
    if (catSelect) catSelect.value = item.category;
    if (condSelect) condSelect.value = item.condition;

    function close(): void {
      overlay.remove();
      document.body.style.overflow = "";
    }
    overlay.querySelector(".modal-close")?.addEventListener("click", close);
    overlay.querySelector("[data-edit-cancel]")?.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector<HTMLFormElement>("#edit-item-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await updateOwnItem(item.id, {
          title: titleInput?.value.trim(),
          description: descInput?.value.trim(),
          category: catSelect?.value as Item["category"],
          condition: condSelect?.value as Item["condition"],
        });
        showToast(`"${titleInput?.value.trim()}" updated.`);
        close();
        renderListings();
      } catch {
        showToast("Could not save those changes. You can only edit your own items.", "error");
      }
    });
    document.body.style.overflow = "hidden";
    document.body.append(overlay);
  }

  // -------------------------------------------------------------- favorites
  function renderFavorites(): void {
    const favIds = getFavorites();
    const favs = getItems().filter((i) => favIds.includes(i.id) && !i.hidden);
    favoritesEl.replaceChildren();
    if (favs.length === 0) {
      favoritesEl.innerHTML = `<p class="my-empty">No favorites yet. Tap the heart on any item on the Home page and it will wait for you here.</p>`;
      return;
    }
    favs.forEach((item) => {
      const row = document.createElement("article");
      row.className = "my-item";
      row.innerHTML = `
        <img class="my-item__thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />
        <div class="my-item__main">
          <h3 class="my-item__title">${escapeHtml(item.title)}</h3>
          <p class="my-item__meta">${escapeHtml(item.category)} · ${escapeHtml(item.condition)} · <strong>${escapeHtml(item.status)}</strong> · Shared by ${escapeHtml(item.donorName)}</p>
        </div>
        <div class="my-item__actions">
          <a class="btn--sm btn--success" href="index.html" style="text-decoration:none;">View</a>
          <button class="btn--sm btn--danger" data-action="unfav" type="button">Remove</button>
        </div>
      `;
      row.querySelector('[data-action="unfav"]')?.addEventListener("click", async () => {
        await toggleFavorite(item.id);
        showToast(`"${item.title}" removed from favorites.`, "info");
        renderFavorites();
      });
      favoritesEl.append(row);
    });
  }

  renderListings();
  renderFavorites();
}

void bootstrap();
