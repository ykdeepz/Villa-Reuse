// Data layer — API version.
//
// In the original prototype this file read and wrote everything to
// localStorage. It now talks to the server (see server.js):
//
//   * initStore() loads the whole community state once per page from
//     GET /api/state and keeps it in an in-memory cache, so the existing
//     synchronous getters (getItems, getRequests, …) keep working unchanged.
//   * Every mutator (addItem, createRequest, updateRequestStatus,
//     submitReport, resolveReport, toggleUserStatus, addAuditLog) is async:
//     it sends the change to the server first, then updates the cache.
//     Data therefore persists across browsers and server restarts.
//
// Function names are the same as the original file on purpose.

import type {
  Item,
  ItemRequest,
  ListingReport,
  AuditLog,
  SystemUser,
  ItemStatus,
  RequestStatus,
  ReportStatus,
} from "../types.js";
import {
  DEFAULT_ITEMS,
  DEFAULT_REQUESTS,
  DEFAULT_REPORTS,
  DEFAULT_LOGS,
  DEFAULT_USERS,
} from "./defaultData.js";

export { DEFAULT_ITEMS, DEFAULT_REQUESTS, DEFAULT_REPORTS, DEFAULT_LOGS, DEFAULT_USERS };

// ------------------------------------------------------------ in-memory cache
let itemsCache: Item[] = [...DEFAULT_ITEMS];
let requestsCache: ItemRequest[] = [...DEFAULT_REQUESTS];
let reportsCache: ListingReport[] = [...DEFAULT_REPORTS];
let logsCache: AuditLog[] = [...DEFAULT_LOGS];
let usersCache: SystemUser[] = [...DEFAULT_USERS];

interface StateResponse {
  items: Item[];
  requests: ItemRequest[];
  reports: ListingReport[];
  logs: AuditLog[];
  users: SystemUser[];
  favorites?: string[];
}

/** Load the latest state from the server. Call once at page start,
 *  after initSession(). Safe to call again to refresh. */
export async function initStore(): Promise<void> {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`Failed to load data from server (${res.status})`);
  const data = (await res.json()) as StateResponse;
  itemsCache = data.items;
  requestsCache = data.requests;
  reportsCache = data.reports;
  logsCache = data.logs;
  usersCache = data.users;
  favoritesCache = data.favorites ?? favoritesCache;
}

async function api(path: string, options: RequestInit): Promise<any> {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data;
}
const apiJson = (path: string, method: string, body: unknown): Promise<any> =>
  api(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ------------------------------------------------------------------- ITEMS
export function getItems(): Item[] {
  return itemsCache;
}

export function saveItems(items: Item[]): void {
  itemsCache = items; // cache-only; server writes happen in the mutators below
}

export async function addItem(item: Item, photoFile?: File | null): Promise<{ item: Item; user?: unknown }> {
  const form = new FormData();
  if (photoFile) form.append("photo", photoFile);
  form.append("payload", JSON.stringify(item));
  const data = await api("/api/items", { method: "POST", body: form });
  itemsCache.unshift(data.item as Item);
  return data as { item: Item; user?: unknown };
}

export async function updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
  const index = itemsCache.findIndex((i) => i.id === itemId);
  if (index !== -1) itemsCache[index].status = status;
}

export async function setItemHidden(itemId: string, hidden: boolean): Promise<void> {
  const index = itemsCache.findIndex((i) => i.id === itemId);
  if (index !== -1) itemsCache[index].hidden = hidden;
}

// ---------------------------------------------------------------- REQUESTS
export function getRequests(): ItemRequest[] {
  return requestsCache;
}

export function saveRequests(requests: ItemRequest[]): void {
  requestsCache = requests;
}

export async function createRequest(request: ItemRequest): Promise<void> {
  const data = await apiJson("/api/requests", "POST", request);
  requestsCache.unshift(data.request as ItemRequest);
  await updateItemStatus(request.itemId, "Requested");
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  actorName = "Item Donor"
): Promise<void> {
  void actorName; // the server records the signed-in user as the actor
  const data = await apiJson(`/api/requests/${requestId}`, "PATCH", { status });
  const updated = data.request as ItemRequest;
  const req = requestsCache.find((r) => r.id === requestId);
  if (req) req.status = updated.status;
  if (status === "Accepted") await updateItemStatus(updated.itemId, "Reserved");
  else if (status === "Rejected") await updateItemStatus(updated.itemId, "Available");
  else if (status === "Completed") await updateItemStatus(updated.itemId, "Completed");
}

// ----------------------------------------------------------------- REPORTS
export function getReports(): ListingReport[] {
  return reportsCache;
}

export function saveReports(reports: ListingReport[]): void {
  reportsCache = reports;
}

export async function submitReport(report: ListingReport): Promise<void> {
  const data = await apiJson("/api/reports", "POST", report);
  reportsCache.unshift(data.report as ListingReport);
}

export async function resolveReport(
  reportId: string,
  status: ReportStatus,
  moderatorName = "Alex Chen"
): Promise<void> {
  void moderatorName; // the server records the signed-in moderator as the actor
  const data = await apiJson(`/api/reports/${reportId}`, "PATCH", { status });
  const updated = data.report as ListingReport;
  const rep = reportsCache.find((r) => r.id === reportId);
  if (rep) rep.status = updated.status;
  if (status === "Listing Removed") await setItemHidden(updated.itemId, true);
}

// -------------------------------------------------------------- AUDIT LOGS
export function getAuditLogs(): AuditLog[] {
  return logsCache;
}

export async function addAuditLog(entry: Omit<AuditLog, "id" | "timestamp">): Promise<void> {
  const data = await apiJson("/api/logs", "POST", { action: entry.action, details: entry.details });
  logsCache.unshift(data.log as AuditLog);
}

// ------------------------------------------------- OWN ITEMS & FAVORITES
let favoritesCache: string[] = [];

export function getFavorites(): string[] {
  return favoritesCache;
}

export async function toggleFavorite(itemId: string): Promise<string[]> {
  const data = await apiJson(`/api/favorites/${itemId}`, "POST", {});
  favoritesCache = data.favorites as string[];
  return favoritesCache;
}

export interface ItemEdit {
  title?: string;
  description?: string;
  category?: Item["category"];
  condition?: Item["condition"];
}

export async function updateOwnItem(itemId: string, patch: ItemEdit): Promise<Item> {
  const data = await apiJson(`/api/items/${itemId}`, "PATCH", patch);
  const updated = data.item as Item;
  const index = itemsCache.findIndex((i) => i.id === itemId);
  if (index !== -1) itemsCache[index] = updated;
  return updated;
}

export async function deleteOwnItem(itemId: string): Promise<void> {
  await apiJson(`/api/items/${itemId}`, "DELETE", undefined);
  itemsCache = itemsCache.filter((i) => i.id !== itemId);
  favoritesCache = favoritesCache.filter((id) => id !== itemId);
}

export async function cancelRequest(requestId: string): Promise<void> {
  const req = requestsCache.find((r) => r.id === requestId);
  await apiJson(`/api/requests/${requestId}`, "DELETE", undefined);
  requestsCache = requestsCache.filter((r) => r.id !== requestId);
  if (req) {
    const item = itemsCache.find((i) => i.id === req.itemId);
    if (item && item.status === "Requested") item.status = "Available";
  }
}

// -------------------------------------------------------------------- USERS
export function getUsers(): SystemUser[] {
  return usersCache;
}

export async function toggleUserStatus(userId: string, actorName = "Admin", actorId?: string): Promise<void> {
  void actorName;
  if (actorId && actorId === userId) return;
  const data = await apiJson(`/api/users/${userId}/toggle-status`, "PATCH", {});
  const user = usersCache.find((u) => u.id === userId);
  if (user) user.status = (data.user as SystemUser).status;
}
