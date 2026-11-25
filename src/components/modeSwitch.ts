// Marketplace-style mode switch for unified community accounts.
//
// One account can both browse/request items and post/donate items, so the
// sidebar carries a small "Browsing / Posting" toggle (like Marketplace's
// Buying / Selling switch). The choice is kept in localStorage so it
// survives page loads, and the active mode is always highlighted.
//
//   * Browsing → the Home feed of community items.
//   * Posting  → the Post Item page (and, on Home, your own listings).
//
// The mode is also mirrored onto <html data-mode="…"> so the whole
// signed-in interface can follow the mode's colour (see
// css/components/mode-theme.css): green for Browsing, gold for
// Posting. This module only runs for community accounts, so staff
// pages and the sign-in pages never get the attribute and keep the
// standard green theme.

export type BrowseMode = "browsing" | "posting";

const MODE_KEY = "vr_mode";

export function getMode(): BrowseMode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "posting" ? "posting" : "browsing";
  } catch {
    return "browsing";
  }
}

export function setMode(mode: BrowseMode): void {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode etc. — the switch still works for this page */
  }
}

function reflectMode(mode: BrowseMode): void {
  document.documentElement.dataset.mode = mode;
}

export function mountModeSwitch(): void {
  reflectMode(getMode());
  const nav = document.querySelector<HTMLElement>(".sidebar__nav");
  if (!nav || nav.querySelector(".mode-switch")) return;

  const wrap = document.createElement("div");
  wrap.className = "mode-switch";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Switch between browsing and posting");
  wrap.innerHTML = `
    <span class="mode-switch__label">I am</span>
    <div class="mode-switch__options">
      <button type="button" class="mode-switch__btn" data-mode="browsing">Browsing</button>
      <button type="button" class="mode-switch__btn" data-mode="posting">Posting</button>
    </div>
  `;

  const sync = (): void => {
    const current = getMode();
    reflectMode(current);
    wrap.querySelectorAll<HTMLButtonElement>(".mode-switch__btn").forEach((btn) => {
      const active = btn.dataset.mode === current;
      btn.classList.toggle("mode-switch__btn--active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  };

  wrap.querySelectorAll<HTMLButtonElement>(".mode-switch__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = (btn.dataset.mode || "browsing") as BrowseMode;
      if (mode === getMode()) {
        sync();
        return;
      }
      setMode(mode);
      sync();
      // Posting starts on the Post Item page; Browsing starts on Home.
      // On those pages already, a custom event lets the page re-render.
      const target = mode === "posting" ? "donate.html" : "index.html";
      const here = window.location.pathname.split("/").pop() || "index.html";
      if (here === target) {
        window.dispatchEvent(new CustomEvent("vr-mode-change", { detail: { mode } }));
      } else {
        window.location.href = target;
      }
    });
  });

  nav.parentElement?.insertBefore(wrap, nav);
  sync();
}
