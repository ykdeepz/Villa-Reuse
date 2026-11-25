import { refreshItems } from "./data/items.js";
import { initStore } from "./data/systemStore.js";
import { initSession } from "./data/profileData.js";
import { mountFilterChips } from "./components/filterChips.js";
import { mountSearchBar } from "./components/searchBar.js";
import { filterItems, renderItemGrid } from "./components/itemGrid.js";
import { openItemModal } from "./components/itemModal.js";
import { syncNavigation } from "./components/navigation.js";
import { mountLogout } from "./components/auth.js";
import { getMode } from "./components/modeSwitch.js";
import type { CategoryFilter, Item } from "./types.js";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

async function bootstrap(): Promise<void> {
  await initSession();
  await initStore();
  const activeUser = syncNavigation();
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

  // Arriving from the top-bar search on another page: index.html?q=…
  const urlQuery = new URLSearchParams(window.location.search).get("q");
  if (urlQuery) {
    currentQuery = urlQuery;
    search.value = urlQuery;
  }

  // Browsing / Posting mode (sidebar switch, kept in localStorage).
  // Browsing shows the whole community feed; Posting turns the feed into
  // "your listings" so the same account can manage what it posted.
  const feedTitle = document.querySelector<HTMLElement>(".section-head__title");
  const feedSubtitle = document.querySelector<HTMLElement>(".section-head__subtitle");
  const feedEyebrow = document.querySelector<HTMLElement>(".discover .eyebrow");

  function applyModeChrome(): void {
    const posting = getMode() === "posting";
    if (feedTitle) feedTitle.textContent = posting ? "Your listings" : "Discover something useful";
    if (feedSubtitle) {
      feedSubtitle.textContent = posting
        ? "Items you posted for the community — tap one to review it."
        : "Pre-loved items, ready for their next chapter.";
    }
    if (feedEyebrow) feedEyebrow.textContent = posting ? "POSTED BY YOU" : "AVAILABLE NEAR YOU";
    const heroBtn = document.getElementById("donate-btn");
    if (heroBtn) {
      heroBtn.innerHTML = posting
        ? `<span class="btn__plus">+</span> Post another item`
        : `<span class="btn__plus">+</span> Donate an item`;
    }
  }

  function render(): void {
    applyModeChrome();
    const allItems = refreshItems();
    const visible = getMode() === "posting"
      ? allItems.filter((i) => i.donorId === activeUser.id)
      : allItems;
    const filtered = filterItems(visible, {
      category: currentCategory,
      query: currentQuery,
      listingType: currentType,
      condition: currentCondition,
    });

    renderItemGrid(grid, counter, filtered, (item: Item) => {
      openItemModal(item, () => {
        render();
      });
    }, () => {
      // "Clear filters" from the friendly empty state
      currentCategory = "All";
      currentQuery = "";
      currentType = "All";
      currentCondition = "All";
      search.value = "";
      typeFilter.value = "All";
      conditionFilter.value = "All";
      setActiveChip("All");
      render();
    });
  }

  window.addEventListener("vr-mode-change", () => render());

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
