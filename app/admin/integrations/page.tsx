import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { allProviderStatuses, PROVIDERS } from "@/lib/integrations/registry";
import { PLATFORMS } from "@/lib/platforms";
import { isAiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

function EnvRow({ name, present }: { name: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0 font-mono text-[11.5px]">
      <span className={present ? "text-muted-foreground" : "text-dim"}>{name}</span>
      {present ? <Check size={13} className="text-success" /> : <X size={13} className="text-destructive" />}
    </div>
  );
}

/**
 * Deployment debugging surface: exactly which credentials are present, and which
 * capabilities are actually implemented. Secret values are never read or displayed —
 * only their presence.
 */
export default async function Page() {
  await requireSuperAdmin();
  const providers = allProviderStatuses();

  const core = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
    { name: "SUPABASE_SERVICE_ROLE_KEY", present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { name: "TOKEN_ENCRYPTION_KEY", present: Boolean(process.env.TOKEN_ENCRYPTION_KEY) },
    { name: "AI_API_KEY", present: isAiConfigured() },
    { name: "REDIS_URL", present: Boolean(process.env.REDIS_URL) },
  ];

  return (
    <>
      <PageHeader title="Integrations" description="Which credentials this deployment has, and what each provider can actually do." />

      <div className="surface mb-4 p-5">
        <div className="h2">Core configuration</div>
        <div className="mt-3 max-w-[420px]">{core.map((e) => <EnvRow key={e.name} {...e} />)}</div>
        <p className="mt-3.5 text-xs text-dim">
          Supabase keys are required. <code className="text-muted-foreground">TOKEN_ENCRYPTION_KEY</code> is required before any social account can be connected.
          Without <code className="text-muted-foreground">REDIS_URL</code> the worker polls the database instead of consuming a queue.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => {
          const capabilities = PROVIDERS[p.platform].capabilities;
          const implemented = Object.values(capabilities).some(Boolean);
          return (
            <div key={p.platform} className="surface p-[18px]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={p.platform} size={34} />
                  <div>
                    <div className="text-[14px] font-semibold">{PLATFORMS[p.platform].name}</div>
                    <div className="text-[11.5px] text-dim">{p.configured ? "Credentials present" : `Missing ${p.missingEnv.length} variable${p.missingEnv.length === 1 ? "" : "s"}`}</div>
                  </div>
                </div>
                {p.configured
                  ? implemented ? <StatusBadge tone="connected">Ready</StatusBadge> : <StatusBadge tone="warning">Not implemented</StatusBadge>
                  : <StatusBadge tone="failed">Not configured</StatusBadge>}
              </div>

              <div className="mt-3.5">{PROVIDERS[p.platform].requiredEnv.map((name) => <EnvRow key={name} name={name} present={!p.missingEnv.includes(name)} />)}</div>

              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {(["connect", "publish", "analytics", "inbox"] as const).map((cap) => (
                  <span key={cap} className={`chip h-6 text-[11px] ${capabilities[cap] ? "" : "opacity-45"}`}>
                    {capabilities[cap] ? <Check size={11} className="text-success" /> : <X size={11} />}{cap}
                  </span>
                ))}
              </div>

              <a href={PROVIDERS[p.platform].docs} target="_blank" rel="noreferrer" className="mt-3 block text-[11.5px] text-muted-foreground underline underline-offset-[3px]">
                Provider API docs
              </a>
            </div>
          );
        })}
      </div>

      <p className="mt-6 max-w-[720px] text-xs text-dim">
        A provider becomes usable only when its credentials are set <em>and</em> its integration module is implemented.
        Setting environment variables alone will not make publishing work — see <code className="text-muted-foreground">lib/integrations/README.md</code> for what each module must export.
      </p>
    </>
  );
}
