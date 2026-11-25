# Villa-Reuse

**Give well. Live lighter.**

Villa-Reuse is a neighborhood reuse and exchange system. Residents post
pre-loved items for **free donation** or **exchange**, browse what is
available nearby, request items, earn **ReUse Coins** for sharing, and
track the community's waste-diversion impact. Moderators keep listings
safe, and administrators manage users and the audit log.

This version is a **complete, working system**: a real server, a real
database, and real logins — not a front-end-only mockup.

> 📋 **[CHANGELOG.md](CHANGELOG.md)** — a plain-language list of
> everything that was changed, removed, and improved/added, with the
> "before → now → why" for each item. Handy for the presentation.

---

## Tech stack

| Layer    | Technology |
|----------|------------|
| Front-end | TypeScript (compiled to JavaScript modules in `dist/`), plain HTML, plain CSS |
| Server   | Node.js + Express (`server.js`) |
| Database | SQLite, through Node's built-in `node:sqlite` module (database file: `data/villa-reuse.db`, created and seeded automatically on first start) |
| Uploads  | Multer — item photos are saved on the server in `uploads/` |
| Sessions | Cookie sessions (`cookie-parser`); passwords hashed with Node `crypto` scrypt |

No frameworks were added: the front-end is the same vanilla TypeScript /
HTML / CSS as the original design, and the server is plain JavaScript.

> **Why `node:sqlite` and not `better-sqlite3`?** `better-sqlite3` was
> listed in the original `package.json`, but it is a native module whose
> build fails on current Node versions. Node 22+ ships the same SQLite
> database built in as `node:sqlite`, so the system uses that instead —
> same database, nothing extra to compile or install.

---

## How to run it

You need **Node.js 22 or newer** (for the built-in `node:sqlite`).

```bash
npm install     # install dependencies (express, multer, cookie-parser, typescript)
npm run dev     # build the TypeScript front-end, then start the server
```

Then open **http://localhost:3000/** and sign in with a demo account below.

Other commands:

```bash
npm run build   # compile TypeScript only (src/ -> dist/)
npm start       # start the server only (after a build)
npm run watch   # recompile TypeScript automatically while you edit
```

To reset the demo back to its original data, stop the server and delete
the `data/` folder — it is recreated and re-seeded on the next start.

---

## Demo accounts

All four accounts use the same password: **`villa2026`**
(passwords are stored on the server only as salted hashes).

| Role | Email | Starts on | Can do |
|------|-------|-----------|--------|
| Community Member | `member@villareuse.org` | Home | Browse, post items, request donations/exchanges |
| Community Member | `donor@villareuse.org` | Home | The same unified account — this login used to be the separate "Item Donor" account; its posted items and history are unchanged |
| Community Moderator | `moderator@villareuse.org` | Moderation | Review reports, dismiss them, remove listings, warn providers |
| System Administrator | `admin@villareuse.org` | Admin | View system stats and audit logs, suspend / reactivate users |

**One account does everything.** There is no separate member/donor
account any more: like Facebook Marketplace, the same person browses and
requests items *and* posts/donates their own. Signing in happens on one
page (`login.html`) with **Sign in** and **Create account** — anyone can
register a new unified account there. The old per-role pages
(`login-member.html`, `login-donor.html`) now simply redirect to
`login.html`. Moderators and Admins keep their own sign-in pages
(`login-moderator.html`, `login-admin.html`), linked discreetly at the
bottom of `login.html` as "Staff sign in". Admin and Moderation pages —
and their API routes — stay restricted: other roles get an access gate
in the browser and a `403` from the server. Logging out returns to
`login.html`.

**Browsing / Posting switch.** Signed-in community accounts get a small
"I am: Browsing / Posting" switch at the top of the sidebar. *Browsing*
shows the community feed on Home; *Posting* goes to the Post Item page,
and Home then shows **Your listings** instead of the whole feed. The
choice is remembered (localStorage) across pages and reloads.

---

## Features

- **Discover** — browse items with search, category chips, and
  listing-type / condition filters. The search box in the top bar works
  from every page: on Home it drives the feed's filter directly, and
  from anywhere else it jumps to Home with your search applied
- **One unified account + mode switch** — sign up once, then flip the
  sidebar's Browsing / Posting switch depending on whether you are
  looking for items or sharing them
- **Post an item** — donation or exchange, with a real photo upload
  (JPG/PNG, stored on the server) and a ReUse Coin estimate; posting
  credits the poster's coin balance
- **Requests** — request a donation or propose an exchange; the provider
  can accept (item becomes *Reserved*), decline (item becomes
  *Available* again), and mark the handoff *Completed*
- **Reporting & moderation** — any member can flag a listing; moderators
  can dismiss the report or remove (hide) the listing
- **Admin** — community statistics, user management
  (suspend / reactivate — a suspended account can no longer sign in or
  use the API), and a full audit log of system activity
- **Impact & profile** — ReUse Coins, items shared, and waste saved
- **Real Impact page** — every number on the Impact page (and the home
  hero and admin waste stat) is computed live from the database; see
  "How impact is calculated" below
- **Notifications** — the header bell shows your real unread count.
  You are notified when someone requests your item, when your request
  is accepted / declined / completed, and when a report you filed is
  resolved. Opening the bell marks them read
- **My listings & favorites (Profile)** — edit or delete your own
  listings (the server refuses edits to anyone else's — 403), cancel
  your own pending requests from the Requests page, and save items
  with the heart button on Home to find them again under Favorites.
  The Profile page also opens with a small "Your activity at a glance"
  summary — items posted, requests made, and your ReUse Coin balance,
  all counted from the real data
- **Friendly empty states** — when a list is empty (no feed matches,
  no requests yet, no listings yet) the page says so in plain words
  and offers the next step as a button, e.g. "Post the first item" or
  "Browse items"
- **Friendly feedback** — actions confirm with in-app toasts and a
  styled dialog instead of browser `alert()` / `confirm()` popups,
  and empty lists explain what to do next

## How impact is calculated

The server (`GET /api/impact`) counts a handover as "passed on" when an
item reaches the status **Completed**, **Donated**, or **Exchanged**.
Each passed-on item's diverted landfill weight is estimated from its
category with simple averages stored in `server.js`
(`CATEGORY_WEIGHT_KG`): Clothes 1 kg, Books 1 kg, School Supplies 1 kg,
Household Items 2 kg, Others 2 kg, Appliances 3 kg, Furniture 7 kg.
"ReUse Coins in circulation" is the sum of all members' coin balances,
and "Top contributors" ranks members by items posted, with their own
passed-on kg and coin balance. Post an item and complete its handover
during the demo and the Impact page moves.

Everything is saved in the server database, so posts, requests, reports,
and coin balances are shared by every browser and survive restarts.

---

## How it works (for the presentation)

1. The browser loads a page (HTML/CSS) and its TypeScript module from `dist/`.
2. On page start, the front-end asks the server **who is signed in**
   (`GET /api/me`) and loads the community data (`GET /api/state`).
   Without a valid session cookie, it redirects to the login page.
3. Every action — posting, requesting, accepting, reporting, moderating,
   suspending — is sent to the **REST API** in `server.js`, which checks
   the session and role, updates the **SQLite database**, writes an
   **audit log** entry, and returns the result.
4. The data layer on the front-end (`src/data/systemStore.ts`) keeps the
   same function names as the original prototype (`getItems`,
   `createRequest`, `updateRequestStatus`, `resolveReport`, …) — they are
   now `async` functions that call the API instead of `localStorage`.

### API endpoints

| Method | Endpoint | Who | Purpose |
|--------|----------|-----|---------|
| POST | `/api/auth/register` | anyone | Create a unified community account; signs you in (409 if the email is taken) |
| POST | `/api/auth/login` | anyone | Sign in; sets the httpOnly session cookie |
| POST | `/api/auth/logout` | signed in | End the session |
| GET | `/api/me` | signed in | Current user's profile |
| GET | `/api/state` | signed in | Items, requests, reports, logs, users |
| POST | `/api/items` | signed in | Post an item (multipart, optional photo) |
| POST | `/api/requests` | signed in | Request an item (item becomes *Requested*) |
| PATCH | `/api/requests/:id` | signed in | Accept / reject / complete a request |
| POST | `/api/reports` | signed in | Report a listing |
| PATCH | `/api/reports/:id` | Moderator only | Dismiss a report or remove the listing |
| POST | `/api/logs` | signed in | Add an audit-log entry |
| GET | `/api/moderation/reports` | Moderator only | Moderation queue |
| GET | `/api/admin/overview` | Admin only | Users, logs, items, requests |
| PATCH | `/api/users/:id/toggle-status` | Admin only | Suspend / reactivate a user |
| GET | `/api/impact` | signed in | Live community statistics computed from the database |
| GET | `/api/notifications` | signed in | My notifications + unread count |
| POST | `/api/notifications/read` | signed in | Mark all my notifications as read |
| GET | `/api/favorites` | signed in | My saved item ids |
| POST | `/api/favorites/:itemId` | signed in | Save / unsave an item (toggle) |
| PATCH | `/api/items/:id` | owner only | Edit my item (title, description, category, condition) |
| DELETE | `/api/items/:id` | owner only | Delete my item |
| DELETE | `/api/requests/:id` | requester only | Cancel my pending request (item becomes Available) |

---

## Project structure

```
├── index.html, donate.html, requests.html,   # pages (same names/design as the original)
│   moderation.html, admin.html, impact.html,
│   profile.html, login*.html
├── css/                 # stylesheets (base / layout / components)
├── assets/              # stock item photos
├── uploads/             # photos uploaded by users (created by the server)
├── src/                 # TypeScript source
│   ├── *.ts             # one module per page (main, donate, requests, …)
│   ├── components/      # item cards, modal, navigation, uploader, plus
│   │                    # feedback.ts (toasts/confirm) and notifications.ts (bell)
│   └── data/            # systemStore.ts (API data layer), profileData.ts
│                        # (session/login), defaultData.ts (demo seed mirror)
├── dist/                # compiled JavaScript (generated by npm run build)
├── CHANGELOG.md         # plain-language record of all changes (presenter-friendly)
├── server.js            # Express server: static site + REST API + auth
├── server/seed-data.js  # the demo accounts and records used to seed the DB
└── data/                # SQLite database (generated on first start)
```
