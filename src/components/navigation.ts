import type { Profile } from "../data/profileData.js";
import { getActiveUser } from "../data/profileData.js";
import { mountNotifications } from "./notifications.js";

export function syncNavigation(user?: Profile): Profile {
  const activeUser = user || getActiveUser();

  // Real notification badge + dropdown on the header bell (no-op on
  // pages without a bell, and when nobody is signed in).
  mountNotifications();

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
