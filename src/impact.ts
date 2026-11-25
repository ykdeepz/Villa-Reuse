import type { StatCardData, Contributor } from "./data/impactData.js";
import { createStatCard } from "./components/statCard.js";
import { createContributorRow } from "./components/contributorList.js";
import { createQrPattern, renderChainStats } from "./components/chainStats.js";
import { syncNavigation } from "./components/navigation.js";
import { initSession } from "./data/profileData.js";
import { mountLogout } from "./components/auth.js";

// The Impact page used to show fixed "presentation" numbers from
// impactData.ts. It now asks the server (GET /api/impact), which computes
// everything live from the SQLite database — post an item, complete a
// handover, and these numbers move. See README.md for the kg formula.

interface ImpactData {
  itemsShared: number;
  itemsAvailable: number;
  completedHandovers: number;
  itemsPassedOn: number;
  kgDiverted: number;
  coinsInCirculation: number;
  activeMembers: number;
  contributors: Contributor[];
  chain: { peopleInChain: number; timesReused: number; kgAvoided: number };
}

const CHAIN_ID = "7821";

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

async function bootstrap(): Promise<void> {
  await initSession();
  syncNavigation();
  mountLogout();

  const statRow = requireElement<HTMLElement>("stat-row");
  const list = requireElement<HTMLOListElement>("contributor-list");
  const qr = requireElement<HTMLElement>("qr-code");
  const chainStats = requireElement<HTMLElement>("chain-stats");
  const periodBadge = document.querySelector<HTMLElement>(".period-badge");

  let impact: ImpactData | null = null;
  try {
    const res = await fetch("/api/impact");
    if (res.ok) impact = (await res.json()) as ImpactData;
  } catch (err) {
    console.warn("Failed to load impact data", err);
  }

  if (!impact) {
    statRow.innerHTML = `<p class="grid__empty">Impact data could not be loaded from the server. Try refreshing the page.</p>`;
    return;
  }

  // Progress bars are relative to a simple community goal so the bars
  // stay meaningful as the real numbers grow.
  const kgGoal = 50;
  const cards: StatCardData[] = [
    {
      id: "waste",
      label: "Total waste saved",
      value: impact.kgDiverted,
      unit: "kg",
      note: `From ${impact.itemsPassedOn} items passed on (see README for the estimate)`,
      progress: Math.min(100, Math.round((impact.kgDiverted / kgGoal) * 100)),
      variant: "primary",
      icon: "leaf",
    },
    {
      id: "handovers",
      label: "Completed handovers",
      value: impact.completedHandovers,
      unit: "done",
      note: `${impact.itemsAvailable} items available right now · ${impact.itemsShared} shared in total`,
      progress: Math.min(100, impact.completedHandovers * 10),
      variant: "default",
      icon: "chart",
    },
    {
      id: "coins",
      label: "ReUse Coins in circulation",
      value: impact.coinsInCirculation,
      unit: "coins",
      note: `Earned by ${impact.activeMembers} active members for sharing`,
      progress: Math.min(100, Math.round(impact.coinsInCirculation / 20)),
      variant: "default",
      icon: "co2",
    },
  ];

  statRow.append(...cards.map(createStatCard));
  if (impact.contributors.length > 0) {
    list.append(...impact.contributors.map(createContributorRow));
  } else {
    list.innerHTML = `<li class="contributor"><span class="contributor__name">No contributors yet — be the first to share an item.</span></li>`;
  }
  renderChainStats(chainStats, [
    { value: String(impact.chain.peopleInChain), label: "people in chain" },
    { value: String(impact.chain.timesReused), label: "times reused" },
    { value: `${impact.chain.kgAvoided} kg`, label: "waste avoided" },
  ]);
  qr.style.backgroundImage = createQrPattern(CHAIN_ID);
  if (periodBadge) {
    periodBadge.textContent = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
}

void bootstrap();
