# Villa-Reuse — Build Report

**Result: the system is complete and working.** The front-end-only
prototype (all state in `localStorage`, one shared hard-coded password, a
static-only server) is now a real full-stack system with a server
database, hashed-password logins, sessions, and role-enforced API
routes. Same pages, same design, same languages as the original:
TypeScript + HTML + CSS on the front-end, JavaScript/Node.js on the
server. No GitHub work was done (push is a separate step, blocked on the
owner's secure GitHub sign-in).

## What was built

- **Server (`server.js`, Express)** — serves the static site plus a REST
  API; replaces the original static-only Node server.
- **Database (SQLite)** — tables for users, items, requests, reports,
  audit logs, and sessions in `data/villa-reuse.db`, auto-seeded on
  first start with the original demo records (`server/seed-data.js`):
  6 items, 3 requests, 2 reports, 5 audit logs, 4 users.
- **Auth** — passwords hashed with Node `crypto` scrypt + per-user salt
  (never plaintext), httpOnly `vr_session` cookie, `GET /api/me`,
  logout that invalidates the session server-side. Suspended accounts
  are rejected by the API (403).
- **Role enforcement on the server** — moderator-only report resolution
  and moderation queue; admin-only overview and user suspend/reactivate
  (an admin cannot suspend their own account). Wrong role → 403.
  Admin/Moderation pages keep the original access-gate UI for
  wrong-role visitors.
- **Front-end rewiring** — `src/data/systemStore.ts` keeps the original
  function names; getters read an in-memory cache loaded once per page
  from `GET /api/state` (`initStore()`), and every mutator is now async
  and calls the API. `src/data/profileData.ts` does the same for the
  session (`initSession()`, `loginUser()`, `logoutUser()`). No
  `localStorage` use remains in `src/`.
- **Workflows (all persist server-side)** — browse/search/filter; post
  item with a real photo upload via Multer to `uploads/` (stock-asset
  fallback, poster credited ReUse Coins by the server); create request
  (item → Requested); accept (→ Reserved), reject (→ Available),
  complete (→ Completed); report a listing; moderator dismiss /
  remove-listing (hides the item); admin suspend/reactivate; audit-log
  entries written by the server for every action.
- **Hygiene** — `.gitignore` (node_modules, dist, uploads content,
  *.db), `README.md` written so the presenter can explain the system
  from it, `package.json` scripts unchanged and working
  (`build` = tsc, `start` = node server.js, `dev` = build + start).

## Storage choice

**SQLite via Node's built-in `node:sqlite`** (Node v24 in this
environment). `better-sqlite3` was tried first because the original
`package.json` declared it, but its native build **fails** here
(node-gyp error on Node 24), so it was removed from the dependencies.
`node:sqlite` gives the same SQLite database with zero native builds —
the more reliable choice for a classroom demo. Records are stored as
JSON documents in typed tables (simple, and easy to explain).

## Test results (actually run)

**TypeScript build:** `npm run build` — compiles with **no errors**.

**API test suite (curl against the running server): 35 passed, 0 failed**, including:

- Unauthenticated `/api/me` and `/api/state` → 401; wrong password → 401
- Login as each of the 4 roles → 200; session cookie is HttpOnly;
  `/api/me` returns the right profile per role
- Member → admin API 403, admin → 200; member → moderation API 403,
  moderator → 200; member attempting to moderate or suspend → 403
- Seeded state: 6 items present
- Create item → 201, poster's coins credited 120 → 130
- Create item **with photo upload** → 201, file saved under `uploads/`
  and served back with 200
- Request that item → item status **Requested**; accept → **Reserved**;
  complete → **Completed**
- Report a listing → moderator removes it → item hidden; member's
  attempt to moderate → 403
- Admin suspends the donor → donor's `/api/me` → 403; admin reactivates
  → 200 again; admin cannot suspend self (400, by design in code path)
- Audit logs grew from 5 seeded to 14 after the test actions
- Logout → `/api/me` → 401 (session invalidated)

**Persistence:** server killed and restarted mid-test — items created
before the restart were still in the database afterwards. ✅

**Browser test (Playwright/Chromium):** signed in through the real
login page as the member account, landed on Home, and all 6 seeded
items rendered from the API (Denim Jacket, Electric Kettle, Design
Handbook, Ceramic Table Set, …). Requests page → Sent tab shows the
seeded requests; a member visiting `admin.html` sees the access gate.
Screenshots: [screenshots/home.png](screenshots/home.png),
[screenshots/requests.png](screenshots/requests.png).
(After testing, the database and test uploads were wiped, so the
project ships in the clean seeded state.)

## How to run

```bash
npm install
npm run dev        # builds the front-end and starts the server
# open http://localhost:3000/
```

Demo accounts — all use password **`villa2026`**:
`member@`, `donor@`, `moderator@`, `admin@villareuse.org`
(full table in README.md).

## Remaining limitations (honest list)

- **Impact page statistics** (waste saved, emissions, contributors) are
  still the original presentation figures, not computed from the
  database; profile/coins *are* real server data. Impact derivation
  was left as static content because it is a display page, and the
  numbers match the seeded demo story.
- **Requests page tab filtering** keeps the original prototype's
  demo-friendly logic (e.g. members see all sent requests).
- Sessions last 12 hours and live in the same SQLite file; there is no
  password-change or sign-up flow — accounts are the 4 seeded demo
  users, which is what the presentation needs.
- The app is meant to run locally (`npm run dev`); it has not been
  deployed to a public host, and HTTPS/secure-cookie settings would
  need turning on for that.
- One seeded quirk was preserved for fidelity: two seeded items reuse
  stock photos of other items, exactly as in the original data.

---

# Improvement pass (Round 2)

Requested after the fullstack build: make the Impact page real, add
notifications, let users manage their own listings and favorites,
polish feedback and mobile layout, and remove dead code — in the same
stack, without breaking anything above. A presenter-friendly record
of this round (and Round 1) lives in `CHANGELOG.md`.

## What was added / changed

- **Real Impact page** — new `GET /api/impact` computes everything
  from SQLite: items shared/available, completed handovers, coins in
  circulation (sum of member balances), active members, top
  contributors from real records, and kg diverted. Kg formula: items
  at Completed/Donated/Exchanged × per-category weight stored in
  `server.js` (`CATEGORY_WEIGHT_KG`: Clothes 1, Books 1, School
  Supplies 1, Household Items 2, Others 2, Appliances 3, Furniture 7).
  The home hero number and the admin waste stat now read the same
  endpoint instead of the old fixed "1,200 kg". `impactData.ts` was
  reduced to the two TypeScript interfaces still in use; its invented
  constants were deleted.
- **Notifications** — `notifications` table; created when an item is
  requested, when a request is accepted/rejected/completed or
  cancelled, and when a filed report is resolved. `GET
  /api/notifications` + `POST /api/notifications/read`; the header
  bell badge is the real unread count (hidden at zero), the dropdown
  panel marks items read on open, and the bell was added to the four
  page headers that lacked one.
- **Own-item management + favorites** — Profile gained "My listings"
  (Edit via styled dialog, Delete via confirm; `PATCH`/`DELETE
  /api/items/:id`, owner-only, 403 for non-owners) and "My favorites"
  (heart toggle on item cards, `POST /api/favorites/:itemId`,
  persisted server-side per user). Requests page: owners can cancel
  their own Pending requests (`DELETE /api/requests/:id`,
  requester-only; item returns to Available).
- **Feedback polish** — new `src/components/feedback.ts` (toast +
  styled confirm dialog); every `alert()`/`confirm()` on the main
  flows (post item, request, accept/decline, report, moderation,
  suspend, logout, delete, cancel) was replaced. Friendly empty
  states added for notifications, favorites, and my-listings (empty
  filter/request states already existed).
- **Responsive pass** — new `css/layout/responsive.css`: sidebar
  becomes a horizontal scroll nav ≤768px, tables scroll in their
  wrapper, cards stack, header compresses at 420px. Desktop
  appearance unchanged.
- **Removed** — `src/state/store.ts` (the `FilterStore` class;
  verified zero imports before deleting), the static Impact
  constants (above). Checked and deliberately kept: `defaultData.ts`
  (initial cache) and `items.ts` (`refreshItems` is used).

## Test results (actually run, this round)

- **TypeScript build:** `npm run build` — compiles with **no errors**.
- **API suite: 65 passed, 0 failed** — all original behaviours
  (4-role login, wrong-password 401, unauthenticated 401s, role
  403s, item creation + coin credit, photo upload served back,
  request lifecycle, moderation, suspend/reactivate, self-suspend
  400, logout invalidation, audit-log growth) **plus**: impact
  baseline (0 kg, 1 completed handover, 4 active members) and its
  change after completing an exchange (kg 0 → 1 for a Books item,
  handovers 1 → 2, passed-on 0 → 1); notification created for the
  item's donor on request, for the requester on accept, and for the
  reporter on report resolution; unread count → 0 after
  `POST /api/notifications/read`; owner edits own item (200) vs
  non-owner edit/delete (403); owner delete removes the item;
  favorite toggle on/off + `GET /api/favorites` + favorites included
  in `/api/state`; cancel own request (200, item back to Available)
  vs non-requester cancel (403).
- **Persistence:** server restarted mid-round — test items were
  still in the database afterwards (8 items: 6 seeded + 2 created).
- **Browser (Playwright):** real login through the login page; home
  renders 6 seeded items from the API with 6 favorite hearts; saving
  a favorite shows a toast; bell badge correctly hidden at 0 unread;
  Impact page displays the database figures (0 kg, 1 handover,
  1,909 coins, contributors ranked Maria Santos 4 items / Jordan Lee
  2); Profile lists the member's 2 seeded listings with Edit/Delete
  and the saved favorite. **Responsive:** document overflow measured
  at 768px and 420px on index, impact, profile, requests,
  moderation, admin, donate — **0 px everywhere** after fixing a
  10 px overflow found on requests at 420px.
- Screenshots: `screenshots/home.png`, `screenshots/impact.png`,
  `screenshots/profile.png`, `screenshots/home-768.png`,
  `screenshots/home-420.png`. Test data wiped afterwards; the
  project ships in the clean seeded state (verified: fresh login
  200, 6 items, empty favorites).

## Remaining limitations (this round, honest)

- Impact starts at **0 kg** in the shipped seed state — correct,
  because no seeded item has status Completed (one seeded *request*
  is Completed, which is why "completed handovers" starts at 1).
  Completing a handover live is the intended demo moment.
- The Impact progress bars use simple goal scaling (50 kg goal,
  handovers × 10, coins ÷ 20) purely so the bars stay meaningful as
  numbers grow; the figures themselves are exact.
- Notifications are created for accounts that exist in the database;
  seeded reports filed by names without accounts (e.g. "Carlos
  Diaz") simply produce no notification.
- Carried over from Round 1: no sign-up/password-change flow,
  12-hour sessions in the same SQLite file, local-only deployment,
  requests-tab demo filtering unchanged.
