import type { FilterState, Item } from "../types.js";
import { createItemCard } from "./itemCard.js";
import { toggleFavorite } from "../data/systemStore.js";
import { showToast } from "./feedback.js";

export function filterItems(items: Item[], { category, query, listingType, condition }: Partial<FilterState> & { category: string; query: string }): Item[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (item.hidden) return false;

    const matchesCategory = category === "All" || item.category === category;
    const matchesQuery =
      q === "" ||
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q) ||
      (item.exchangeFor && item.exchangeFor.toLowerCase().includes(q));

    const matchesType = !listingType || listingType === "All" || item.listingType === listingType;
    const matchesCondition = !condition || condition === "All" || item.condition === condition;

    return matchesCategory && matchesQuery && matchesType && matchesCondition;
  });
}

export function renderItemGrid(
  grid: HTMLElement,
  counter: HTMLElement,
  items: Item[],
  onViewItem?: (item: Item) => void,
): void {
  grid.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "grid__empty-container";
    empty.innerHTML = `
      <p class="grid__empty">No items match your selected filters.</p>
      <small style="color:var(--c-muted); display:block; margin-top:6px;">Try clearing filters or search for another item.</small>
    `;
    grid.append(empty);
  } else {
    items.forEach((item) => {
      const card = createItemCard(item);
      const btn = card.querySelector<HTMLButtonElement>('[data-action="view-item"]');
      if (btn && onViewItem) {
        btn.addEventListener("click", () => onViewItem(item));
      }
      const favBtn = card.querySelector<HTMLButtonElement>('[data-action="fav-item"]');
      if (favBtn) {
        favBtn.addEventListener("click", async () => {
          try {
            const favorites = await toggleFavorite(item.id);
            const saved = favorites.includes(item.id);
            favBtn.classList.toggle("card__fav--active", saved);
            favBtn.setAttribute("aria-pressed", String(saved));
            showToast(saved ? `"${item.title}" saved to your favorites.` : `"${item.title}" removed from favorites.`, "info");
          } catch {
            showToast("Could not update favorites. Please try again.", "error");
          }
        });
      }
      grid.append(card);
    });
  }

  counter.textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
}
