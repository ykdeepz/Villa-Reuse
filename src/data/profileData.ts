export interface ActivityEntry {
  id: string;
  title: string;
  note: string;
  count?: number;
  icon: "leaf" | "heart" | "coin" | "bell";
}

export type UserRole =
  | "Community Member"
  | "Community Moderator"
  | "System Administrator";

export interface Profile {
  id: string;
  name: string;
  email: string;
  initials: string;
  neighborhood: string;
  memberSince: number;
  coins: number;
  itemsShared: number;
  wasteSavedKg: number;
  role: UserRole;
  roleScope: string;
  status?: "Active" | "Suspended";
}

// Demo account profiles, used ONLY to pre-fill the per-role login pages
// (email + name). Passwords are never kept in the browser any more —
// login is checked by the server (POST /api/auth/login).
export const DEMO_USERS: Record<string, Profile> = {
  member: {
    id: "usr_member",
    name: "Jordan Lee",
    email: "member@villareuse.org",
    initials: "JL",
    neighborhood: "Downtown Villa",
    memberSince: 2023,
    coins: 120,
    itemsShared: 9,
    wasteSavedKg: 120,
    role: "Community Member",
    roleScope: "Post items, browse listings, request exchanges/donations, and manage your posts.",
  },
  donor: {
    id: "usr_donor",
    name: "Maria Santos",
    email: "donor@villareuse.org",
    initials: "MS",
    neighborhood: "Villa Verde East",
    memberSince: 2022,
    coins: 340,
    itemsShared: 24,
    wasteSavedKg: 285,
    role: "Community Member",
    roleScope: "Post items, browse listings, request exchanges/donations, and manage your posts.",
  },
  moderator: {
    id: "usr_moderator",
    name: "Alex Chen",
    email: "moderator@villareuse.org",
    initials: "AC",
    neighborhood: "Oakridge District",
    memberSince: 2021,
    coins: 450,
    itemsShared: 18,
    wasteSavedKg: 190,
    role: "Community Moderator",
    roleScope: "Review reported listings, manage inappropriate posts, and ensure reliable data.",
  },
  admin: {
    id: "usr_admin",
    name: "Samira Patel",
    email: "admin@villareuse.org",
    initials: "SP",
    neighborhood: "Villa Central HQ",
    memberSince: 2020,
    coins: 999,
    itemsShared: 42,
    wasteSavedKg: 520,
    role: "System Administrator",
    roleScope: "Manage users, system records, permissions, and system audit logs.",
  },
};

export const PROFILE: Profile = DEMO_USERS.member;

// The signed-in user is kept in memory for this page only. The real session
// lives on the server in an httpOnly cookie, so it survives page loads and
// restarts and cannot be forged from the browser console.
let cachedUser: Profile | null = null;

export function getActiveUser(): Profile {
  return cachedUser ?? PROFILE;
}

export function setActiveUser(user: Profile): void {
  cachedUser = user;
}

/** Ask the server who is signed in (GET /api/me). Redirects to the login
 *  page when there is no valid session. Call once at page start. */
export async function initSession(redirectOnFail = true): Promise<Profile | null> {
  try {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data = (await res.json()) as { user: Profile };
      cachedUser = data.user;
      return cachedUser;
    }
  } catch (err) {
    console.warn("Failed to reach the server for session check", err);
  }
  cachedUser = null;
  if (redirectOnFail && !window.location.pathname.endsWith("login.html") && !window.location.pathname.includes("login-")) {
    window.location.href = "login.html";
  }
  return null;
}

/** Sign in against the server. Returns the profile, or throws with the
 *  server's error message (wrong password, unknown email, suspended…). */
export async function loginUser(email: string, password: string): Promise<Profile> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: Profile; error?: string };
  if (!res.ok || !data.user) {
    throw new Error(data.error || "Sign-in failed. Please try again.");
  }
  cachedUser = data.user;
  return data.user;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("Failed to tell the server about logout", err);
  }
  cachedUser = null;
}

export const ACTIVITY: ActivityEntry[] = [
  { id: "donations",    title: "My donations",        note: "Items you've shared",       count: 3, icon: "leaf"  },
  { id: "claims",       title: "Claims & exchanges",  note: "Requests and pickup details", count: 2, icon: "leaf"  },
  { id: "favorites",    title: "Favorite items",      note: "Things you saved for later",  count: 2, icon: "heart" },
  { id: "transactions", title: "Transaction history", note: "Coins earned and spent",             icon: "coin" },
  { id: "notifications",title: "Notifications",       note: "Updates from the community", count: 5, icon: "bell"  },
];
