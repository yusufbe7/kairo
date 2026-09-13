import "server-only";

type Level = "info" | "warn" | "error";
const ORDER: Record<Level | "off", number> = { info: 0, warn: 1, error: 2, off: 3 };
const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key|cookie/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]),
    );
  }
  return value;
}

export interface LogContext { userId?: string | null; workspaceId?: string | null; [key: string]: unknown }

/**
 * Structured logger. Always writes JSON to stdout (Vercel / log drain); warn+ events are also
 * persisted to `system_logs` for the admin panel. Hook Sentry in here when monitoring is added.
 */
function write(level: Level, event: string, message: string, ctx: LogContext = {}) {
  const { userId, workspaceId, ...rest } = ctx;
  const metadata = redact(rest) as Record<string, unknown>;
  const line = { ts: new Date().toISOString(), level, event, message, userId, workspaceId, ...metadata };
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(JSON.stringify(line));

  const threshold = (process.env.LOG_PERSIST_LEVEL as Level | "off" | undefined) ?? "warn";
  if (ORDER[level] >= ORDER[threshold] && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    import("@/lib/supabase/admin")
      .then(({ createAdminClient }) =>
        createAdminClient().from("system_logs").insert({ level, event, message, user_id: userId ?? null, workspace_id: workspaceId ?? null, metadata }),
      )
      .catch(() => { /* logging must never throw */ });
  }
}

export const logger = {
  info: (event: string, message: string, ctx?: LogContext) => write("info", event, message, ctx),
  warn: (event: string, message: string, ctx?: LogContext) => write("warn", event, message, ctx),
  error: (event: string, message: string, ctx?: LogContext) => write("error", event, message, ctx),
};
