import { refreshItems } from "./data/items.js";
import { initStore } from "./data/systemStore.js";
import { initSession } from "./data/profileData.js";
import { mountFilterChips } from "./components/filterChips.js";
import { mountSearchBar } from "./components/searchBar.js";
import { filterItems, renderItemGrid } from "./components/itemGrid.js";
import { openItemModal } from "./components/itemModal.js";
import { syncNavigation } from "./components/navigation.js";
import { mountLogout } from "./components/auth.js";
import type { CategoryFilter, Item } from "./types.js";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

async function bootstrap(): Promise<void> {
  await initSession();
  await initStore();
  syncNavigation();
  mountLogout();
  const grid = requireElement<HTMLElement>("item-grid");
  const counter = requireElement<HTMLElement>("item-count");
  const chips = requireElement<HTMLElement>("filter-chips");
  const search = requireElement<HTMLInputElement>("search-input");
  const typeFilter = requireElement<HTMLSelectElement>("type-filter");
  const conditionFilter = requireElement<HTMLSelectElement>("condition-filter");

  let currentCategory: CategoryFilter = "All";
  let currentQuery = "";
  let currentType: any = "All";
  let currentCondition: any = "All";

  function render(): void {
    const allItems = refreshItems();
    const filtered = filterItems(allItems, {
      category: currentCategory,
      query: currentQuery,
      listingType: currentType,
      condition: currentCondition,
    });

    renderItemGrid(grid, counter, filtered, (item: Item) => {
      openItemModal(item, () => {
        render();
      });
    });
  }

  const setActiveChip = mountFilterChips(chips, (cat) => {
    currentCategory = cat;
    setActiveChip(cat);
    render();
  });

  mountSearchBar(search, (q) => {
    currentQuery = q;
    render();
  });

  typeFilter.addEventListener("change", () => {
    currentType = typeFilter.value;
    render();
  });

  conditionFilter.addEventListener("change", () => {
    currentCondition = conditionFilter.value;
    render();
  });

  // Navigate hero donate button to post item
  document.getElementById("donate-btn")?.addEventListener("click", () => {
    window.location.href = "donate.html";
  });

  // Hero impact number comes from the server too (same live figure as
  // the Impact page) instead of the prototype's fixed "1,200".
  void fetch("/api/impact")
    .then((r) => (r.ok ? r.json() : null))
    .then((impact: { kgDiverted?: number } | null) => {
      const el = document.getElementById("impact-kg");
      if (el && impact && typeof impact.kgDiverted === "number") {
        el.textContent = impact.kgDiverted.toLocaleString();
      }
    })
    .catch(() => undefined);

  // Initial render
  setActiveChip("All");
  render();
}

void bootstrap();
