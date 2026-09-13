/**
 * Timezone math without dependencies. Scheduling stores UTC instants; the UI works in
 * the workspace timezone ("2026-09-12 10:00 in Asia/Tashkent").
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmtCache.set(tz, f);
  }
  return f;
}

function parts(instant: Date, tz: string) {
  const p = Object.fromEntries(formatter(tz).formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: Number(p.minute), s: Number(p.second) };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
export function tzOffsetMs(instant: Date, tz: string): number {
  const p = parts(instant, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(instant.getTime() / 1000) * 1000;
}

export function isValidTimezone(tz: string): boolean {
  try { formatter(tz); return true; } catch { return false; }
}

/** "2026-09-12" + "10:00" in `tz` → UTC Date. Handles DST transitions. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let result = guess - off1;
  const off2 = tzOffsetMs(new Date(result), tz);
  if (off2 !== off1) result = guess - off2;
  return new Date(result);
}

/** UTC ISO instant → { date: "YYYY-MM-DD", time: "HH:mm" } in `tz`. */
export function utcToZoned(iso: string | Date, tz: string): { date: string; time: string } {
  const p = parts(typeof iso === "string" ? new Date(iso) : iso, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}` };
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return utcToZoned(now, tz).date;
}

export const COMMON_TIMEZONES = [
  "UTC", "Asia/Tashkent", "Asia/Almaty", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Europe/London", "Europe/Berlin", "Europe/Istanbul", "Europe/Moscow",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Australia/Sydney",
];
