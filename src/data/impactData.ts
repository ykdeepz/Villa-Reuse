// Shared types for the Impact page.
//
// This file used to hold the page's numbers as fixed constants
// (STAT_CARDS, CONTRIBUTORS, CHAIN_STATS with invented figures like
// "1,200 kg saved"). Those are gone: impact.ts now loads real statistics
// from GET /api/impact, computed by the server from the database.
// Only the TypeScript interfaces remain, so the stat-card and
// contributor components keep their original shapes.

export interface StatCardData {
  id: string;
  label: string;
  value: number;
  unit: string;
  note: string;
  progress: number;
  variant: "primary" | "default";
  icon: "leaf" | "co2" | "chart";
  trees?: boolean;
}

export interface Contributor {
  id: number | string;
  name: string;
  initials: string;
  itemsReused: number;
  kgSaved: number;
  coins: number;
  isSelf?: boolean;
}
