import { safeFetch } from "@/lib/safe-fetch";

export type SportsSide = {
  name: string;
  abbr: string;
  logo: string;
  score: string;
  winner: boolean;
};

export type SportsGame = {
  id: string;
  league: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: SportsSide;
  away: SportsSide;
  startMs: number;
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports";

export type LeagueDef = { key: string; label: string; tag: string; path: string; logo: string };

const TL = "https://a.espncdn.com/i/teamlogos/leagues/500";
const LL = "https://a.espncdn.com/i/leaguelogos/soccer/500";
export const LEAGUES: LeagueDef[] = [
  { key: "NFL", label: "NFL", tag: "NFL", path: "football/nfl", logo: `${TL}/nfl.png` },
  { key: "NBA", label: "NBA", tag: "NBA", path: "basketball/nba", logo: `${TL}/nba.png` },
  { key: "MLB", label: "MLB", tag: "MLB", path: "baseball/mlb", logo: `${TL}/mlb.png` },
  { key: "NHL", label: "NHL", tag: "NHL", path: "hockey/nhl", logo: `${TL}/nhl.png` },
  { key: "MLS", label: "MLS", tag: "MLS", path: "soccer/usa.1", logo: `${LL}/19.png` },
  { key: "EPL", label: "Premier League", tag: "EPL", path: "soccer/eng.1", logo: `${LL}/23.png` },
  { key: "UCL", label: "Champions League", tag: "UCL", path: "soccer/uefa.champions", logo: `${LL}/2.png` },
  { key: "LALIGA", label: "La Liga", tag: "ESP", path: "soccer/esp.1", logo: `${LL}/15.png` },
  { key: "SERIEA", label: "Serie A", tag: "ITA", path: "soccer/ita.1", logo: `${LL}/12.png` },
  { key: "BUNDESLIGA", label: "Bundesliga", tag: "GER", path: "soccer/ger.1", logo: `${LL}/10.png` },
  { key: "ROSHN", label: "Saudi Pro League", tag: "KSA", path: "soccer/ksa.1", logo: `${LL}/2488.png` },
];
const BY_KEY = new Map(LEAGUES.map((l) => [l.key, l] as const));
export const DEFAULT_SPORTS_LEAGUES = ["NFL", "NBA", "MLB", "NHL", "EPL", "MLS"];

const TTL = 10_000;
const cache = new Map<string, { at: number; games: SportsGame[] }>();
const inflight = new Map<string, Promise<SportsGame[]>>();

function toSide(c: Record<string, unknown> | undefined): SportsSide {
  const team = (c?.team ?? {}) as Record<string, unknown>;
  return {
    name: (team.displayName as string) ?? (team.name as string) ?? "",
    abbr: (team.abbreviation as string) ?? "",
    logo: typeof team.logo === "string" ? team.logo : "",
    score: typeof c?.score === "string" ? c.score : String(c?.score ?? ""),
    winner: c?.winner === true,
  };
}

async function fetchLeagueRaw(league: string): Promise<SportsGame[]> {
  const def = BY_KEY.get(league);
  if (!def) return [];
  const res = await safeFetch(`${BASE}/${def.path}/scoreboard`);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: unknown[] };
  const events = Array.isArray(data.events) ? data.events : [];
  const out: SportsGame[] = [];
  for (const evRaw of events) {
    const ev = evRaw as Record<string, unknown>;
    const comp = (ev.competitions as Record<string, unknown>[] | undefined)?.[0];
    if (!comp) continue;
    const cs = (comp.competitors as Record<string, unknown>[] | undefined) ?? [];
    const home = cs.find((x) => x.homeAway === "home") ?? cs[0];
    const away = cs.find((x) => x.homeAway === "away") ?? cs[1];
    if (!home || !away) continue;
    const t = ((comp.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
    const rawState = t.state;
    const state = rawState === "in" || rawState === "post" ? rawState : "pre";
    out.push({
      id: String(ev.id ?? `${league}-${out.length}`),
      league: def.tag,
      state,
      detail: (t.shortDetail as string) ?? (t.detail as string) ?? "",
      home: toSide(home),
      away: toSide(away),
      startMs: Date.parse((ev.date as string) ?? "") || 0,
    });
  }
  return out;
}

function fetchLeague(league: string): Promise<SportsGame[]> {
  const cached = cache.get(league);
  if (cached && Date.now() - cached.at < TTL) return Promise.resolve(cached.games);
  const existing = inflight.get(league);
  if (existing) return existing;
  const p = fetchLeagueRaw(league)
    .then((games) => {
      cache.set(league, { at: Date.now(), games });
      return games;
    })
    .catch(() => cache.get(league)?.games ?? [])
    .finally(() => inflight.delete(league));
  inflight.set(league, p);
  return p;
}

function rank(s: SportsGame["state"]): number {
  return s === "in" ? 0 : s === "pre" ? 1 : 2;
}

export function sortGames(games: SportsGame[]): SportsGame[] {
  return games
    .slice()
    .sort((a, b) => rank(a.state) - rank(b.state) || (a.state === "post" ? b.startMs - a.startMs : a.startMs - b.startMs));
}

export function liveCount(games: SportsGame[]): number {
  return games.filter((g) => g.state === "in").length;
}

export async function fetchSports(leagues: string[]): Promise<SportsGame[]> {
  const lists = await Promise.all(leagues.map((l) => fetchLeague(l).catch(() => [] as SportsGame[])));
  return sortGames(lists.flat());
}
