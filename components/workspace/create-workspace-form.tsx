"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Logo } from "@/components/layout/logo";
import { createWorkspace } from "@/lib/actions/workspace";
import { COMMON_TIMEZONES } from "@/lib/time";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return COMMON_TIMEZONES.includes(local) ? local : "UTC";
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createWorkspace({ name: name.trim(), timezone });
      if (result.ok) router.replace("/dashboard");
      else setError(result.error.message);
    });
  };

  return (
    <div className="relative z-[1] mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-5 py-12">
      <div className="mb-8"><Logo /></div>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">Create your workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">A workspace holds your connected accounts, posts and team. You can create more later.</p>
      <form onSubmit={submit} className="mt-7 flex flex-col gap-3.5">
        {error && (
          <div role="alert" className="flex items-center gap-2.5 rounded-xl border border-destructive/25 bg-destructive/[0.06] px-3.5 py-2.5 text-[13px] text-destructive">
            <TriangleAlert size={15} />{error}
          </div>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium">Workspace name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Studio" autoFocus required maxLength={80} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium">Timezone</span>
          <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
          </Select>
          <span className="mt-1.5 block text-xs text-dim">Scheduled posts use this timezone.</span>
        </label>
        <Button type="submit" variant="primary" className="mt-1 h-10" disabled={pending || !name.trim()}>
          {pending && <LoaderCircle size={15} className="animate-spin" />}Create workspace
        </Button>
      </form>
    </div>
  );
}
