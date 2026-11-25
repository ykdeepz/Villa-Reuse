// Villa-Reuse server — Express + SQLite (Node's built-in node:sqlite).
//
// What changed from the original prototype server.js:
//   * It still serves the static site (HTML / CSS / compiled dist/ JS / assets).
//   * It now also provides a REST API under /api/* with real server-side data.
//   * Data lives in a SQLite database file (data/villa-reuse.db), so it
//     survives restarts and is shared by every browser — no more localStorage.
//   * Login uses salted scrypt password hashes + an httpOnly session cookie.
//   * Admin-only and moderator-only API routes check the session role (403).
//
// Storage note: package.json originally listed better-sqlite3, but its native
// build fails on current Node versions in this environment, so the server
// uses Node's built-in node:sqlite module instead — same SQLite database,
// no native compilation, nothing extra to install. See BUILD_REPORT.md.

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { DatabaseSync } = require("node:sqlite");
const seed = require("./server/seed-data");

const ROOT = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------------------------------------------------------- database
const db = new DatabaseSync(path.join(DB_DIR, "villa-reuse.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active', data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items    (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reports  (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS logs     (id TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL, item_id TEXT NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );
`);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function seedIfEmpty() {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (row.n > 0) return;
  const insUser = db.prepare(
    "INSERT INTO users (id, email, password_hash, password_salt, status, data) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const u of seed.USERS) {
    const salt = crypto.randomBytes(16).toString("hex");
    insUser.run(u.id, u.email, hashPassword(seed.DEMO_PASSWORD, salt), salt, u.status, JSON.stringify(u));
  }
  const put = (table) => db.prepare(`INSERT INTO ${table} (id, data) VALUES (?, ?)`);
  for (const it of seed.ITEMS) put("items").run(it.id, JSON.stringify(it));
  for (const r of seed.REQUESTS) put("requests").run(r.id, JSON.stringify(r));
  for (const r of seed.REPORTS) put("reports").run(r.id, JSON.stringify(r));
  for (const l of seed.LOGS) put("logs").run(l.id, JSON.stringify(l));
  console.log("Database seeded with the original demo data.");
}
seedIfEmpty();

// ------------------------------------------------------------------ helpers
const allRows = (table) => db.prepare(`SELECT data FROM ${table}`).all().map((r) => JSON.parse(r.data));
const getRow = (table, id) => {
  const r = db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id);
  return r ? JSON.parse(r.data) : null;
};
const putRow = (table, obj) =>
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, data) VALUES (?, ?)`).run(obj.id, JSON.stringify(obj));

function publicUser(u) {
  const { ...profile } = u;
  return profile; // profile JSON never contains the password hash (kept in columns)
}
function systemUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    neighborhood: u.neighborhood, status: u.status,
    itemsCount: u.itemsCount, joinedYear: u.joinedYear,
  };
}
function getUserRowById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}
function saveUserProfile(row) {
  const data = JSON.parse(row.data);
  data.status = row.status;
  db.prepare("UPDATE users SET status = ?, data = ? WHERE id = ?")
    .run(row.status, JSON.stringify(data), row.id);
  return data;
}
// Estimated landfill weight (kg) avoided when one item of each category is
// passed on instead of thrown away. Simple, explainable averages — a jacket
// is about 1 kg, a chair about 7 kg, and so on. Used only by GET /api/impact.
const CATEGORY_WEIGHT_KG = {
  "Clothes": 1, "Appliances": 3, "Books": 1, "School Supplies": 1,
  "Household Items": 2, "Furniture": 7, "Others": 2,
};
const weightOf = (item) => CATEGORY_WEIGHT_KG[item.category] ?? 2;

// Create a notification for a user (silently skipped for unknown users,
// e.g. seeded records that name people without accounts).
function notify(userId, type, message) {
  if (!userId || !getUserRowById(userId)) return;
  const n = {
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId, type, message, read: false,
    createdAt: nowStamp(), ts: Date.now(),
  };
  db.prepare("INSERT INTO notifications (id, user_id, data) VALUES (?, ?, ?)")
    .run(n.id, userId, JSON.stringify(n));
}

function nowStamp() {
  const n = new Date();
  const p = (v) => String(v).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}`;
}
function addAuditLog(entry) {
  const log = { id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, timestamp: nowStamp(), ...entry };
  putRow("logs", log);
  return log;
}

// ---------------------------------------------------------------------- app
const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ["image/jpeg", "image/png"].includes(file.mimetype)),
});

// ------------------------------------------------------------- auth helpers
function sessionUser(req) {
  const token = req.cookies.vr_session;
  if (!token) return null;
  const s = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!s || s.expires_at < Date.now()) return null;
  const row = getUserRowById(s.user_id);
  return row ? JSON.parse(row.data) : null;
}
function requireAuth(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: "Not signed in." });
  if (user.status === "Suspended") return res.status(403).json({ error: "This account is suspended." });
  req.user = user;
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: `Requires role: ${role}` });
    next();
  };
}

// ---------------------------------------------------------------- auth API
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).trim().toLowerCase());
  if (!row) return res.status(401).json({ error: "No account with that email." });
  const expected = Buffer.from(row.password_hash, "hex");
  const actual = Buffer.from(hashPassword(String(password), row.password_salt), "hex");
  if (!crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: "That password does not match this account." });
  }
  const user = JSON.parse(row.data);
  if (user.status === "Suspended") return res.status(403).json({ error: "This account is suspended." });
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, row.id, Date.now() + 1000 * 60 * 60 * 12);
  res.cookie("vr_session", token, { httpOnly: true, sameSite: "lax", path: "/" });
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies.vr_session;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.clearCookie("vr_session", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

// --------------------------------------------------------------- data API
app.get("/api/state", requireAuth, (req, res) => {
  const users = db.prepare("SELECT data FROM users").all().map((r) => systemUser(JSON.parse(r.data)));
  const favorites = db.prepare("SELECT item_id FROM favorites WHERE user_id = ?")
    .all(req.user.id).map((r) => r.item_id);
  res.json({
    items: allRows("items"),
    requests: allRows("requests"),
    reports: allRows("reports"),
    logs: allRows("logs"),
    users,
    favorites,
  });
});

app.post("/api/items", requireAuth, upload.single("photo"), (req, res) => {
  let payload = {};
  try { payload = JSON.parse(req.body.payload || "{}"); } catch { return res.status(400).json({ error: "Bad payload." }); }
  if (!payload.title || !String(payload.title).trim()) return res.status(400).json({ error: "Item title is required." });
  const item = {
    ...payload,
    id: payload.id || `item_${Date.now()}`,
    donorId: req.user.id,
    donorName: req.user.name,
    status: "Available",
    postedAgo: "Just now",
    image: req.file ? `uploads/${req.file.filename}` : payload.image || "assets/denim-jacket.png",
  };
  putRow("items", item);
  // Credit the poster's ReUse Coins + shared count, like the original did.
  const row = getUserRowById(req.user.id);
  const profile = JSON.parse(row.data);
  profile.coins += Number(item.coins) || 0;
  profile.itemsShared += 1;
  profile.itemsCount = profile.itemsShared;
  row.data = JSON.stringify(profile);
  db.prepare("UPDATE users SET data = ? WHERE id = ?").run(row.data, row.id);
  addAuditLog({ actor: item.donorName, role: "Item Donor / Provider", action: "New Item Posted", details: `Posted "${item.title}" under ${item.category} (${item.listingType})` });
  res.status(201).json({ item, user: publicUser(profile) });
});

app.post("/api/requests", requireAuth, (req, res) => {
  const r = req.body || {};
  if (!r.itemId) return res.status(400).json({ error: "itemId is required." });
  const item = getRow("items", r.itemId);
  if (!item) return res.status(404).json({ error: "Item not found." });
  const request = { ...r, id: r.id || `req_${Date.now()}`, requesterId: req.user.id, requesterName: req.user.name, status: "Pending" };
  putRow("requests", request);
  item.status = "Requested";
  putRow("items", item);
  addAuditLog({ actor: request.requesterName, role: "Community Member", action: `${request.type} Created`, details: `Requested "${request.itemTitle}" from ${request.donorName}` });
  notify(item.donorId, "request_received", `${request.requesterName} requested your item "${request.itemTitle}".`);
  res.status(201).json({ request });
});

app.patch("/api/requests/:id", requireAuth, (req, res) => {
  const request = getRow("requests", req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  const status = (req.body || {}).status;
  if (!["Accepted", "Rejected", "Completed"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  request.status = status;
  putRow("requests", request);
  const item = getRow("items", request.itemId);
  if (item) {
    if (status === "Accepted") item.status = "Reserved";
    else if (status === "Rejected") item.status = "Available";
    else if (status === "Completed") item.status = "Completed";
    putRow("items", item);
  }
  addAuditLog({ actor: req.user.name, role: "Item Donor / Provider", action: `Request ${status}`, details: `Request for "${request.itemTitle}" marked as ${status}` });
  const verb = status === "Accepted" ? "accepted" : status === "Rejected" ? "declined" : "completed";
  notify(request.requesterId, `request_${verb}`, `Your request for "${request.itemTitle}" was ${verb}.`);
  res.json({ request });
});

// Cancel my own pending request (requester only). The item becomes
// Available again if it was waiting on this request.
app.delete("/api/requests/:id", requireAuth, (req, res) => {
  const request = getRow("requests", req.params.id);
  if (!request) return res.status(404).json({ error: "Request not found." });
  if (request.requesterId !== req.user.id) return res.status(403).json({ error: "You can only cancel your own requests." });
  if (request.status !== "Pending") return res.status(400).json({ error: "Only pending requests can be cancelled." });
  db.prepare("DELETE FROM requests WHERE id = ?").run(request.id);
  const item = getRow("items", request.itemId);
  if (item && item.status === "Requested") { item.status = "Available"; putRow("items", item); }
  addAuditLog({ actor: req.user.name, role: "Community Member", action: "Request Cancelled", details: `Cancelled request for "${request.itemTitle}"` });
  notify(request.donorId, "request_cancelled", `${req.user.name} cancelled their request for "${request.itemTitle}".`);
  res.json({ ok: true });
});

app.post("/api/reports", requireAuth, (req, res) => {
  const r = req.body || {};
  if (!r.itemId) return res.status(400).json({ error: "itemId is required." });
  const report = { ...r, id: r.id || `rep_${Date.now()}`, reporterId: req.user.id, reporterName: req.user.name, status: "Open" };
  putRow("reports", report);
  addAuditLog({ actor: report.reporterName, role: "Community Member", action: "Listing Reported", details: `Reported "${report.itemTitle}" for: ${report.reason}` });
  res.status(201).json({ report });
});

app.patch("/api/reports/:id", requireAuth, requireRole("Community Moderator"), (req, res) => {
  const report = getRow("reports", req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  const status = (req.body || {}).status;
  if (!["Dismissed", "Listing Removed"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  report.status = status;
  putRow("reports", report);
  if (status === "Listing Removed") {
    const item = getRow("items", report.itemId);
    if (item) { item.hidden = true; putRow("items", item); }
  }
  addAuditLog({ actor: req.user.name, role: "Community Moderator", action: `Report ${status}`, details: `Report on "${report.itemTitle}" resolved as ${status}` });
  notify(report.reporterId, "report_resolved", `Your report on "${report.itemTitle}" was resolved: ${status}.`);
  res.json({ report });
});

app.post("/api/logs", requireAuth, (req, res) => {
  const { action, details } = req.body || {};
  if (!action) return res.status(400).json({ error: "action is required." });
  const log = addAuditLog({ actor: req.user.name, role: req.user.role, action, details: details || "" });
  res.status(201).json({ log });
});

// ------------------------------------------------------------ impact API
// Everything on the Impact page is computed live from the database:
// handovers that reached Completed/Donated/Exchanged count as diverted,
// and their landfill weight is estimated with CATEGORY_WEIGHT_KG above.
app.get("/api/impact", requireAuth, (req, res) => {
  const items = allRows("items");
  const requests = allRows("requests");
  const profiles = db.prepare("SELECT data FROM users").all().map((r) => JSON.parse(r.data));
  const doneStatuses = ["Completed", "Donated", "Exchanged"];
  const passedOn = items.filter((i) => doneStatuses.includes(i.status));
  const kgDiverted = passedOn.reduce((sum, i) => sum + weightOf(i), 0);
  const participants = new Set();
  for (const r of requests) { participants.add(r.requesterId); participants.add(r.donorId); }
  const contributors = profiles.map((u) => {
    const mine = items.filter((i) => i.donorId === u.id);
    const myPassed = mine.filter((i) => doneStatuses.includes(i.status));
    return {
      id: u.id, name: u.name, initials: u.initials,
      itemsReused: mine.length,
      kgSaved: myPassed.reduce((sum, i) => sum + weightOf(i), 0),
      coins: u.coins || 0,
      isSelf: u.id === req.user.id,
    };
  }).sort((a, b) => b.itemsReused - a.itemsReused || b.coins - a.coins).slice(0, 5);
  res.json({
    itemsShared: items.filter((i) => !i.hidden).length,
    itemsAvailable: items.filter((i) => !i.hidden && i.status === "Available").length,
    completedHandovers: requests.filter((r) => r.status === "Completed").length,
    itemsPassedOn: passedOn.length,
    kgDiverted,
    coinsInCirculation: profiles.reduce((sum, u) => sum + (u.coins || 0), 0),
    activeMembers: profiles.filter((u) => u.status === "Active").length,
    contributors,
    chain: {
      peopleInChain: participants.size,
      timesReused: requests.filter((r) => r.status === "Completed").length,
      kgAvoided: kgDiverted,
    },
    weightsKg: CATEGORY_WEIGHT_KG,
  });
});

// ------------------------------------------------------- notifications API
app.get("/api/notifications", requireAuth, (req, res) => {
  const mine = db.prepare("SELECT data FROM notifications WHERE user_id = ?")
    .all(req.user.id).map((r) => JSON.parse(r.data))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  res.json({ notifications: mine, unread: mine.filter((n) => !n.read).length });
});

app.post("/api/notifications/read", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT id, data FROM notifications WHERE user_id = ?").all(req.user.id);
  const upd = db.prepare("UPDATE notifications SET data = ? WHERE id = ?");
  for (const row of rows) {
    const n = JSON.parse(row.data);
    if (!n.read) { n.read = true; upd.run(JSON.stringify(n), row.id); }
  }
  res.json({ ok: true, unread: 0 });
});

// ------------------------------------------------------------ favorites API
app.get("/api/favorites", requireAuth, (req, res) => {
  const favorites = db.prepare("SELECT item_id FROM favorites WHERE user_id = ?")
    .all(req.user.id).map((r) => r.item_id);
  res.json({ favorites });
});

app.post("/api/favorites/:itemId", requireAuth, (req, res) => {
  const item = getRow("items", req.params.itemId);
  if (!item) return res.status(404).json({ error: "Item not found." });
  const existing = db.prepare("SELECT 1 AS x FROM favorites WHERE user_id = ? AND item_id = ?")
    .get(req.user.id, item.id);
  if (existing) db.prepare("DELETE FROM favorites WHERE user_id = ? AND item_id = ?").run(req.user.id, item.id);
  else db.prepare("INSERT INTO favorites (user_id, item_id) VALUES (?, ?)").run(req.user.id, item.id);
  const favorites = db.prepare("SELECT item_id FROM favorites WHERE user_id = ?")
    .all(req.user.id).map((r) => r.item_id);
  res.json({ favorites, saved: !existing });
});

// ------------------------------------------- own-item management (owner only)
const CATEGORIES = ["Clothes", "Appliances", "Books", "School Supplies", "Household Items", "Furniture", "Others"];
const CONDITIONS = ["Like New", "Good", "Fair"];

app.patch("/api/items/:id", requireAuth, (req, res) => {
  const item = getRow("items", req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.donorId !== req.user.id) return res.status(403).json({ error: "You can only edit your own items." });
  const b = req.body || {};
  if (b.title !== undefined) {
    if (!String(b.title).trim()) return res.status(400).json({ error: "Title cannot be empty." });
    item.title = String(b.title).trim();
  }
  if (b.description !== undefined) item.description = String(b.description);
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: "Invalid category." });
    item.category = b.category;
  }
  if (b.condition !== undefined) {
    if (!CONDITIONS.includes(b.condition)) return res.status(400).json({ error: "Invalid condition." });
    item.condition = b.condition;
  }
  item.details = `${item.condition} condition · ${item.category}`;
  putRow("items", item);
  addAuditLog({ actor: req.user.name, role: req.user.role, action: "Item Edited", details: `Edited "${item.title}"` });
  res.json({ item });
});

app.delete("/api/items/:id", requireAuth, (req, res) => {
  const item = getRow("items", req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.donorId !== req.user.id) return res.status(403).json({ error: "You can only delete your own items." });
  db.prepare("DELETE FROM items WHERE id = ?").run(item.id);
  db.prepare("DELETE FROM favorites WHERE item_id = ?").run(item.id);
  addAuditLog({ actor: req.user.name, role: req.user.role, action: "Item Deleted", details: `Deleted "${item.title}"` });
  res.json({ ok: true });
});

// ------------------------------------------------- role-protected API areas
app.get("/api/moderation/reports", requireAuth, requireRole("Community Moderator"), (req, res) => {
  res.json({ reports: allRows("reports") });
});

app.get("/api/admin/overview", requireAuth, requireRole("System Administrator"), (req, res) => {
  const users = db.prepare("SELECT data FROM users").all().map((r) => systemUser(JSON.parse(r.data)));
  res.json({ users, logs: allRows("logs"), items: allRows("items"), requests: allRows("requests") });
});

app.patch("/api/users/:id/toggle-status", requireAuth, requireRole("System Administrator"), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You cannot suspend your own account." });
  const row = getUserRowById(req.params.id);
  if (!row) return res.status(404).json({ error: "User not found." });
  row.status = row.status === "Active" ? "Suspended" : "Active";
  const user = saveUserProfile(row);
  addAuditLog({ actor: req.user.name, role: "System Administrator", action: `User ${user.status === "Active" ? "Reactivated" : "Suspended"}`, details: `${user.name} (${user.email}) status changed to ${user.status}` });
  res.json({ user: systemUser(user) });
});

// -------------------------------------------------------------- static site
app.use("/uploads", express.static(UPLOAD_DIR));
app.use(express.static(ROOT, { index: "index.html" }));
app.use((req, res) => res.status(404).send("404 Not Found"));

function startServer(p) {
  const server = app.listen(p, () => {
    console.log(`\n  🌱 Villa-Reuse is running at:`);
    console.log(`  > Local:      http://localhost:${p}/`);
    console.log(`  > Post Item:  http://localhost:${p}/donate.html`);
    console.log(`  > Requests:   http://localhost:${p}/requests.html`);
    console.log(`  > Moderation: http://localhost:${p}/moderation.html`);
    console.log(`  > Admin:      http://localhost:${p}/admin.html`);
    console.log(`  > Impact:     http://localhost:${p}/impact.html`);
    console.log(`  > Profile:    http://localhost:${p}/profile.html`);
    console.log(`  > Sign In:    http://localhost:${p}/login.html\n`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") { console.log(`Port ${p} is in use, trying ${p + 1}...`); startServer(p + 1); }
    else console.error("Server error:", err);
  });
}
startServer(PORT);
