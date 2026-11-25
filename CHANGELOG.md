# Villa-Reuse — Changelog

**What this file is:** a plain-language record of everything that was
done to turn the original Villa-Reuse prototype into the system you see
now. It is written so the presenter can explain every change out loud:
for each item you get **what it was before**, **what it is now**, and
**why it was changed**.

The work happened in two rounds:

- **Round 1 — the fullstack build.** The prototype looked complete, but
  it was a front-end-only mockup: data lived in the browser, the
  password was written in the code, and the "server" only handed out
  files. Round 1 gave it a real server, a real database, and real
  logins — without changing the pages, the design, or the languages
  (TypeScript + HTML + CSS in front, JavaScript/Node.js behind).
- **Round 2 — the improvement pass.** With the system working, Round 2
  made the numbers real (Impact page), added notifications, let users
  manage their own listings and favorites, polished the feedback and
  the mobile layout, and removed code that was no longer used.

Nothing about the system's purpose changed in either round: neighbors
donate or exchange pre-loved items, earn ReUse Coins, moderators keep
listings safe, admins manage users, and the community tracks the waste
it diverts from landfill.

---

## 1. Changed

*Things that existed before, but work differently now.*

### Where the data lives
- **Before:** Everything — items, requests, reports, users, logs — was
  stored in the browser's `localStorage`. Each browser had its own
  private copy, and clearing the browser wiped the "database".
- **Now:** Everything is stored in a **SQLite database on the server**
  (`data/villa-reuse.db`), created and filled with the original demo
  records the first time the server starts.
- **Why:** A real system has one shared source of truth. Now every
  browser sees the same data, and it survives restarts — which the
  tests verified by killing and restarting the server mid-test.

### The server
- **Before:** `server.js` was a small hand-written file server. It
  could only hand out HTML/CSS/JS files; it had no endpoints and never
  checked who was asking.
- **Now:** `server.js` is an **Express server** that still serves the
  same site, but also provides a REST API (`/api/...`) for login,
  items, requests, reports, moderation, admin, impact, notifications,
  and favorites.
- **Why:** The pages needed something real to talk to. Express was
  already listed in the project's own `package.json` — it just had
  never been used.

### The database library
- **Before:** `package.json` listed `better-sqlite3`, but it was never
  actually used (there was no database at all).
- **Now:** The server uses Node's built-in **`node:sqlite`** module.
- **Why:** `better-sqlite3` is a native add-on and its build fails on
  current Node versions in this environment. The built-in module is
  the same SQLite database with nothing extra to compile — fewer
  moving parts on presentation day. Same database, same language.

### Login and passwords
- **Before:** One shared password (`villa2026`) was written in plain
  text inside the browser code for everyone to see, the login pages
  pre-filled it, and "being logged in" was just a value in
  `localStorage` that anyone could fake from the browser console.
  Admin and Moderation pages could be opened by typing their URL.
- **Now:** Each account's password is stored on the server only as a
  **salted scrypt hash** (never in plain text). Login is checked by
  the server, which issues an **httpOnly session cookie**. Admin-only
  and moderator-only API routes check the session's role on the
  server and answer **403** to anyone else; the pages keep their
  access-gate screen for wrong-role visitors.
- **Why:** Security has to be enforced where the data lives — on the
  server — not by hiding links in the browser. The four demo accounts
  and the demo password stayed the same so the presentation script
  didn't change; what changed is that they are now real accounts.

### How the front-end gets its data
- **Before:** The TypeScript data layer (`src/data/systemStore.ts`)
  read and wrote `localStorage` directly.
- **Now:** The same file, with the **same function names**, loads the
  community state once per page from `GET /api/state` into memory, and
  every change (post, request, accept, report, …) is sent to the API
  first. Login state comes from `GET /api/me`.
- **Why:** Keeping the original function names meant the pages barely
  had to change — a good talking point: the design and page logic are
  the original author's; only the plumbing underneath was replaced.

### Photo uploads
- **Before:** Choosing a photo only showed a preview in the browser.
  When the item was saved, it silently fell back to one of four stock
  pictures, so different items shared the same photo.
- **Now:** The photo is really uploaded with **Multer** and saved on
  the server in `uploads/`; the item points to its own photo file.
  The stock picture is still used when no photo is chosen.
- **Why:** An upload that doesn't save anything isn't an upload. The
  tests posted an item with a photo and fetched the file back from
  the server to prove it.

### The Impact page numbers
- **Before:** The Impact page displayed fixed, invented figures —
  "1,200 kg saved", "840 kg emissions", "42 trees" — typed into a
  data file. The home page hero and the admin dashboard repeated the
  same made-up "1,200 kg".
- **Now:** All three places show **live numbers computed from the
  database** by `GET /api/impact`: items shared, items available,
  completed handovers, ReUse Coins in circulation (the sum of all
  members' balances), active members, top contributors ranked from
  real records, and kilograms diverted.
- **Why:** A system that tracks impact should compute it, not print
  it. It also makes a better demo: complete a handover and the
  numbers move.
- **How the kilograms are estimated** (a fair question to expect):
  an item counts as diverted when it reaches Completed / Donated /
  Exchanged, and its weight is a simple per-category average stored
  in `server.js`: Clothes 1 kg, Books 1 kg, School Supplies 1 kg,
  Household Items 2 kg, Others 2 kg, Appliances 3 kg, Furniture 7 kg.
  It is an estimate, and the code and README say so openly.
- **Honest note:** with the fresh demo data the counter starts at
  0 kg, because none of the seeded items is marked Completed yet —
  the first completed handover in the demo is what moves it
  (the tests watched it rise by exactly 1 kg for a completed book).

### Feedback popups
- **Before:** Actions used the browser's built-in `alert()` and
  `confirm()` boxes — grey, generic, and visually unrelated to the
  site.
- **Now:** A small **toast** slides in at the corner of the screen for
  results ("Your request has been sent…"), and confirmations
  (decline, remove listing, suspend, delete, log out) use a **styled
  dialog in the site's own design** (`src/components/feedback.ts`).
- **Why:** Consistent feedback is part of the design, and a presenter
  can point at it: no browser chrome interrupts the demo anymore.

### The header bell badge
- **Before:** The notification bell showed a hard-coded badge "3" on
  every page, whether or not anything had happened.
- **Now:** The badge is the **real unread count** from the server
  (hidden when it is zero), on every main page — the bell was also
  added to the Post Item, Requests, Moderation, and Admin headers,
  which didn't have one. Clicking it opens a panel with the actual
  notifications and marks them read.
- **Why:** A badge that always says "3" is decoration, not
  information. See "Notifications" under *Improved/Added*.

### Requests you sent
- **Before:** After sending a request you could only watch its
  status; there was no way to change your mind.
- **Now:** The Requests page shows a **Cancel Request** button on
  your own pending requests. Cancelling (after the styled confirm)
  removes the request and makes the item Available again. The server
  only allows the requester to cancel, and only while it is Pending.
- **Why:** Real users make mistakes; a request lifecycle needs an
  exit. It also completes the status story the system already told.

---

## 2. Removed

*Things that were deleted — deliberately, and only after checking
nothing used them.*

### The unused `FilterStore` class (`src/state/store.ts`)
- **What it was:** A small state-management class for the home page
  filters, left over from an earlier approach.
- **Why removed:** A search of the whole codebase showed **zero**
  files importing it — the home page keeps its filter state in plain
  variables instead. Dead code confuses anyone reading or presenting
  the project ("what does this do?" — nothing), so the file was
  deleted.

### The invented Impact statistics (`src/data/impactData.ts`)
- **What it was:** The file held the Impact page's numbers as
  constants — the 1,200 kg, the fake contributor list ("Maya K.",
  "Omar T."), the "May 2025" period label, and the pass-it-on chain
  figures.
- **Why removed:** Once the page started computing real statistics
  from the database (see above), the invented numbers had to go —
  leaving them in the repo would invite exactly the wrong questions.
  The file now contains only the two TypeScript interfaces the
  components still use, with a comment explaining what happened.

### `better-sqlite3` from the dependency list
- **What it was:** A declared dependency that was never imported.
- **Why removed:** It doesn't build on current Node versions here,
  and the built-in `node:sqlite` replaced it. One less thing to
  install (and one less thing to fail) when running the demo.

### `localStorage` as a database
- **What it was:** Five `localStorage` keys held the entire system
  state in the prototype.
- **Why removed:** Replaced by the server database (see *Changed*).
  There is no `localStorage` use left in `src/` — worth stating in
  the presentation, because it is the clearest line between the
  prototype and the finished system.

### What was deliberately NOT removed
No pages, no roles, no ReUse Coins, no moderation, no admin, no audit
log. Those are the system's goals, not clutter. Two other files were
checked and kept on purpose: `src/data/defaultData.ts` (still used as
the data layer's initial cache before the server state loads) and
`src/data/items.ts` (its `refreshItems()` helper is used by the home
page).

---

## 3. Improved / Added

*Brand-new capabilities, plus polish on what already existed.*

### Real notifications (new)
- **What was added:** A `notifications` table in the database, two
  API endpoints (`GET /api/notifications`,
  `POST /api/notifications/read`), and the header bell panel
  (`src/components/notifications.ts`).
- **When you get one:** someone requests **your** item; **your**
  request is accepted, declined, or completed; a report **you filed**
  is resolved by a moderator; or a request for your item is
  cancelled.
- **Why:** Before, the only way to learn a request was accepted was
  to keep opening the Requests page. Notifications close the loop
  between the four roles — and they prove the roles are really
  connected through the server.

### My listings — edit and delete your own items (new)
- **What was added:** A **My Listings** section on the Profile page
  listing everything you posted, with **Edit** (title, description,
  category, condition — in a styled dialog) and **Delete**, backed by
  `PATCH` / `DELETE /api/items/:id`.
- **The important part:** the server checks ownership. Editing or
  deleting someone else's item returns **403** — the tests verified
  both the owner's success and the non-owner's rejection.
- **Why:** Before, a typo in your own listing was forever. Managing
  your own posts is basic completeness for a listing system, and the
  ownership check is a clean example of server-side authorization to
  explain in the defense.

### Favorites (new)
- **What was added:** A heart button on every item card on the Home
  page; saved items are stored per-user on the server
  (`POST /api/favorites/:itemId` toggles) and collected in a
  **My Favorites** section on the Profile page.
- **Why:** Browsing and shortlisting are different activities. The
  prototype's Profile page even advertised "Favorite items: things
  you saved for later" — but there was no way to save anything. Now
  there is, and it persists across browsers like everything else.

### Friendly empty states (improved)
- **What was added:** When a list has nothing in it, it now says so
  helpfully instead of showing a blank: no favorites yet (and how to
  add one), no listings yet (and a nudge to post), no notifications
  ("you're all caught up" — and what will appear there), alongside
  the empty-filter and empty-request messages that already existed.
- **Why:** Empty screens are where demos — and users — get stuck.
  Each empty state explains the next action.

### Responsive layout (improved)
- **What was added:** A dedicated stylesheet
  (`css/layout/responsive.css`, imported last) for tablet and phone
  widths (~768 px and ~420 px): the sidebar becomes a horizontal
  scrollable nav, tables scroll inside their wrapper instead of
  breaking the layout, request cards stack, the header compresses,
  and dialogs/toasts fit small screens. Desktop appearance is
  unchanged.
- **Verified:** every main page was measured in a browser at both
  widths — **zero horizontal overflow** on all of them (one 10 px
  overflow on the Requests page was found and fixed during this
  pass).
- **Why:** The original CSS handled a few breakpoints in a few
  files; on a phone the wide tables and sidebar squeezed the
  content. A presenter can now resize the window live without the
  layout falling apart.

### Presenter support (added)
- **What was added:** This changelog, an expanded README (feature
  list, full API table, the impact formula, and a "how it works"
  walkthrough), and the build report's test evidence.
- **Why:** The system is only half the grade — explaining it is the
  other half. Every design decision a panel might ask about
  ("why SQLite?", "why is the password safe?", "where does 1,200 kg
  come from?" — it doesn't anymore) has a written answer.

### Test evidence (added, Round 1 + Round 2)
- **Round 1:** TypeScript compiled clean; a 35-check API suite passed
  (logins for all four roles, 401/403 enforcement, the full request
  lifecycle, photo upload, moderation, admin suspend/reactivate,
  logout), and data survived a server restart.
- **Round 2:** The suite grew to **65 checks, all passing** — the
  original behaviours plus impact numbers changing after a completed
  handover (+1 kg for a book, handovers 1 → 2), notifications being
  created on request/accept/report-resolution and the unread count
  dropping to zero after reading, owner vs non-owner item editing
  (200 vs 403), favorites toggling and persisting, and cancelling a
  request returning the item to Available. Browser tests confirmed
  the home page renders from the API with the new heart buttons, a
  toast appears when saving a favorite, the Profile page lists the
  member's own items, and the Impact page shows the database's real
  figures. After testing, all test data was wiped — the project
  ships in its clean, seeded demo state.

---

## What is still honestly missing

So the presenter is never caught out:

- **No sign-up page.** Accounts are the four seeded demo users; that
  is what the presentation needs, but a public launch would need
  registration and password changes.
- **Sessions last 12 hours** and live in the same database file;
  fine for a classroom demo, not a production setup.
- **The seeded Impact counter starts at 0 kg** (see *Changed →
  Impact*). It is correct — no seeded item has completed a handover
  yet — and completing one live is the best way to show it working.
- **Not deployed.** The system runs locally with `npm run dev`;
  putting it on a public host would need HTTPS settings turned on.
- **Two seeded items reuse other items' stock photos**, exactly as
  in the original data — kept for fidelity with the original demo.
