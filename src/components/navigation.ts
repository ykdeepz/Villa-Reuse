import type { Profile } from "../data/profileData.js";
import { getActiveUser } from "../data/profileData.js";
import { mountNotifications } from "./notifications.js";
import { mountModeSwitch } from "./modeSwitch.js";

// Top-bar search: one search behavior for the whole app. On the Home page
// it drives the feed's own search box (same filter, no duplicate logic);
// from any other page it jumps to Home with the query in the URL, and the
// Home page picks it up on load.
function mountHeaderSearch(): void {
  const header = document.querySelector<HTMLElement>(".header");
  const actions = header?.querySelector<HTMLElement>(".header__actions");
  if (!header || !actions || header.querySelector(".header__search")) return;

  const form = document.createElement("form");
  form.className = "header__search";
  form.setAttribute("role", "search");
  form.innerHTML = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    <input type="search" placeholder="Search items…" aria-label="Search items" />
  `;
  const input = form.querySelector<HTMLInputElement>("input");
  if (!input) return;

  const onHome = (window.location.pathname.split("/").pop() || "index.html") === "index.html";
  if (onHome) {
    const feedSearch = document.getElementById("search-input") as HTMLInputElement | null;
    if (feedSearch) {
      input.value = feedSearch.value;
      input.addEventListener("input", () => {
        feedSearch.value = input.value;
        feedSearch.dispatchEvent(new Event("input", { bubbles: true }));
      });
      feedSearch.addEventListener("input", () => {
        if (input.value !== feedSearch.value) input.value = feedSearch.value;
      });
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (onHome) {
      document.querySelector(".discover")?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = q ? `index.html?q=${encodeURIComponent(q)}` : "index.html";
    }
  });

  header.insertBefore(form, actions);
}

export function syncNavigation(user?: Profile): Profile {
  const activeUser = user || getActiveUser();

  // Real notification badge + dropdown on the header bell (no-op on
  // pages without a bell, and when nobody is signed in).
  mountNotifications();

  // Signed-in extras: the Browsing/Posting mode switch (community
  // accounts only — staff roles have their own portals) and the
  // top-bar search. Both are no-ops on pages without the app chrome
  // (e.g. the sign-in pages have no header actions or sidebar).
  const hasAppChrome = Boolean(document.querySelector(".header__actions"));
  if (hasAppChrome) {
    if (activeUser.role === "Community Member") mountModeSwitch();
    mountHeaderSearch();
  }

  // 1. Sync Header Avatar & Balance
  const avatarEl = document.querySelector<HTMLElement>(".header .avatar");
  if (avatarEl) {
    avatarEl.textContent = activeUser.initials;
    avatarEl.title = `${activeUser.name} (${activeUser.role}) · Click to open Profile`;
    avatarEl.style.cursor = "pointer";
    avatarEl.onclick = () => {
      window.location.href = "profile.html";
    };
  }

  const balanceEl = document.getElementById("header-balance") || document.getElementById("coin-balance");
  if (balanceEl) {
    balanceEl.textContent = String(activeUser.coins);
  }

  // 2. Role-based Navigation Access Control:
  // ONLY Community Moderator can see the Moderation link in sidebar
  const modLinks = document.querySelectorAll<HTMLElement>(
    'a[href="moderation.html"], [data-nav="moderation"]'
  );
  modLinks.forEach((el) => {
    if (activeUser.role === "Community Moderator") {
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  });

  // ONLY System Administrator can see the Admin link in sidebar
  const adminLinks = document.querySelectorAll<HTMLElement>(
    'a[href="admin.html"], [data-nav="admin"]'
  );
  adminLinks.forEach((el) => {
    if (activeUser.role === "System Administrator") {
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  });

  return activeUser;
}
