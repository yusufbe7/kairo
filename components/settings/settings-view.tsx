"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Bell, Building2, CreditCard, LoaderCircle, Link2, Plus, Shield, User, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformIcon } from "@/components/social/platform-icon";
import { StatusBadge } from "@/components/social/status-badge";
import { UserAvatar } from "@/components/social/user-avatar";
import { ConfirmDialog } from "@/components/posts/confirm-dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  changeMemberRole, createWorkspace, inviteMember, removeMember,
  updateNotificationPrefs, updateProfile, updateWorkspace,
} from "@/lib/actions/workspace";
import { run } from "@/lib/client/action";
import { PLATFORMS } from "@/lib/platforms";
import { COMMON_TIMEZONES } from "@/lib/time";
import { ROLES } from "@/lib/permissions";
import type { WorkspaceRole } from "@/types/database";
import type { AccountView } from "@/types/social";

type SectionId = "profile" | "workspace" | "accounts" | "notifications" | "billing";

export interface SettingsData {
  profile: { fullName: string; email: string; jobTitle: string; locale: string; notifications: Record<string, boolean> };
  members: { userId: string; name: string; email: string; role: WorkspaceRole }[];
  accounts: AccountView[];
  plan: { id: string; name: string; priceCents: number };
  usage: { posts: number; aiGenerations: number; accounts: number };
  limits: { posts_per_month: number | null; social_accounts: number; members: number; ai_generations: number };
}

const NAV: [SectionId, string, LucideIcon][] = [
  ["profile", "Profile", User], ["workspace", "Workspace", Building2], ["accounts", "Connected accounts", Link2],
  ["notifications", "Notifications", Bell], ["billing", "Plan & usage", CreditCard],
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><div className="mb-1.5 text-[12.5px] font-medium">{label}</div>{children}{hint && <div className="mt-[5px] text-xs text-dim">{hint}</div>}</label>;
}

function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="surface">
      <div className="border-b border-border px-5 py-[18px]"><div className="h2">{title}</div>{description && <div className="mt-[3px] text-[13px] text-muted-foreground">{description}</div>}</div>
      <div className="p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </div>
  );
}

export function SettingsView({ data }: { data: SettingsData }) {
  const router = useRouter();
  const params = useSearchParams();
  const { workspace, can, user } = useWorkspace();
  const initial = (params.get("section") as SectionId | null) ?? "profile";
  const [section, setSection] = useState<SectionId>(NAV.some(([id]) => id === initial) ? initial : "profile");
  const [pending, start] = useTransition();

  const [profile, setProfile] = useState(data.profile);
  const [wsName, setWsName] = useState(workspace.name);
  const [wsTimezone, setWsTimezone] = useState(workspace.timezone);
  const [notify, setNotify] = useState(data.profile.notifications);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor");
  const [newWorkspace, setNewWorkspace] = useState("");
  const [removing, setRemoving] = useState<SettingsData["members"][number] | null>(null);

  const saveProfile = () => start(async () => {
    if (await run(updateProfile({ fullName: profile.fullName, jobTitle: profile.jobTitle, locale: profile.locale as "en" | "uz" | "ru" }), { success: "Profile saved" })) router.refresh();
  });
  const saveWorkspace = () => start(async () => {
    if (await run(updateWorkspace({ name: wsName, timezone: wsTimezone }), { success: "Workspace saved" })) router.refresh();
  });
  const saveNotifications = (next: Record<string, boolean>) => {
    setNotify(next);
    start(async () => { await run(updateNotificationPrefs(next as never)); });
  };
  const invite = () => start(async () => {
    const result = await run(inviteMember({ email: inviteEmail.trim(), role: inviteRole as Exclude<WorkspaceRole, "owner"> }));
    if (result) {
      setInviteEmail("");
      const url = `${window.location.origin}${result.inviteUrl}`;
      void navigator.clipboard?.writeText(url);
      toast.success("Invitation created — link copied to your clipboard");
      router.refresh();
    }
  });
  const changeRole = (userId: string, role: WorkspaceRole) => start(async () => {
    if (await run(changeMemberRole({ userId, role: role as Exclude<WorkspaceRole, "owner"> }), { success: "Role updated" })) router.refresh();
  });
  const remove = () => start(async () => {
    if (removing && (await run(removeMember({ userId: removing.userId }), { success: "Member removed" }))) { setRemoving(null); router.refresh(); }
  });
  const addWorkspace = () => start(async () => {
    if (await run(createWorkspace({ name: newWorkspace.trim(), timezone: wsTimezone }), { success: "Workspace created" })) { setNewWorkspace(""); router.refresh(); }
  });

  const saveButton = (onClick: () => void) => (
    <Button size="sm" variant="primary" onClick={onClick} disabled={pending}>{pending && <LoaderCircle size={13} className="animate-spin" />}Save changes</Button>
  );

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, workspace, and plan." />
      <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="no-scrollbar flex gap-0.5 self-start overflow-x-auto lg:flex-col" aria-label="Settings">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} className="nav-item w-auto whitespace-nowrap lg:w-full" data-active={section === id} onClick={() => setSection(id)}><Icon size={15} />{label}</button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={section} className="min-w-0" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            {section === "profile" && (
              <Section title="Profile" description="How you appear to your team." footer={saveButton(saveProfile)}>
                <div className="mb-5 flex items-center gap-3.5"><UserAvatar name={profile.fullName || user.name} size={56} /><div className="text-[13px] text-dim">{profile.email}</div></div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                  <Field label="Full name"><Input value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} maxLength={80} /></Field>
                  <Field label="Role / title"><Input value={profile.jobTitle} onChange={(e) => setProfile({ ...profile, jobTitle: e.target.value })} maxLength={80} /></Field>
                  <Field label="Language">
                    <Select value={profile.locale} onChange={(e) => setProfile({ ...profile, locale: e.target.value })}>
                      <option value="en">English</option><option value="uz">O‘zbekcha</option><option value="ru">Русский</option>
                    </Select>
                  </Field>
                </div>
              </Section>
            )}

            {section === "workspace" && (
              <div className="flex flex-col gap-4">
                <Section title="Workspace" description={can("workspace.update") ? "Shared by everyone in this workspace." : "Only admins can change these."} footer={can("workspace.update") ? saveButton(saveWorkspace) : undefined}>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                    <Field label="Workspace name"><Input value={wsName} onChange={(e) => setWsName(e.target.value)} disabled={!can("workspace.update")} maxLength={80} /></Field>
                    <Field label="Default timezone" hint="New posts are scheduled in this timezone.">
                      <Select value={wsTimezone} onChange={(e) => setWsTimezone(e.target.value)} disabled={!can("workspace.update")}>
                        {[...new Set([workspace.timezone, ...COMMON_TIMEZONES])].map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                      </Select>
                    </Field>
                  </div>
                </Section>

                <Section title="Members" description={`${data.members.length} of ${data.limits.members} seats used on the ${data.plan.name} plan.`}>
                  {data.members.map((m) => (
                    <div key={m.userId} className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                      <UserAvatar name={m.name} size={30} />
                      <div className="min-w-0 flex-1"><div className="truncate text-[13px]">{m.name}</div><div className="truncate text-xs text-dim">{m.email}</div></div>
                      {m.role === "owner" || !can("member.manage") ? (
                        <StatusBadge tone="neutral" dot={false}><span className="capitalize">{m.role}</span></StatusBadge>
                      ) : (
                        <>
                          <Select className="w-28" value={m.role} onChange={(e) => changeRole(m.userId, e.target.value as WorkspaceRole)} aria-label={`Role for ${m.name}`}>
                            {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                          </Select>
                          <Button size="sm" variant="ghost" onClick={() => setRemoving(m)}>Remove</Button>
                        </>
                      )}
                    </div>
                  ))}

                  {can("member.manage") && (
                    <div className="mt-4 flex flex-wrap items-end gap-2">
                      <div className="min-w-[200px] flex-1"><Field label="Invite by email"><Input type="email" placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></Field></div>
                      <Select className="w-32" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)} aria-label="Invite role">
                        {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                      </Select>
                      <Button size="sm" onClick={invite} disabled={pending || !inviteEmail.trim()}><Users size={13} />Invite</Button>
                    </div>
                  )}
                </Section>

                <Section title="Your workspaces" description="Switch between them from the top bar.">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1"><Field label="New workspace name"><Input value={newWorkspace} onChange={(e) => setNewWorkspace(e.target.value)} placeholder="Client project" maxLength={80} /></Field></div>
                    <Button size="sm" onClick={addWorkspace} disabled={pending || !newWorkspace.trim()}><Plus size={13} />Create</Button>
                  </div>
                </Section>
              </div>
            )}

            {section === "accounts" && (
              <Section title="Connected accounts" description="Accounts this workspace can publish to.">
                {data.accounts.length === 0 && <p className="text-[13px] text-dim">No accounts connected yet.</p>}
                {data.accounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                    <PlatformIcon platform={a.platform} size={30} />
                    <div className="min-w-0 flex-1"><div className="text-[13px]">{PLATFORMS[a.platform].name}</div><div className="truncate text-xs text-dim">{a.handle}</div></div>
                    {a.status === "connected" ? <StatusBadge tone="connected">Connected</StatusBadge> : <StatusBadge tone="warning">Reconnect</StatusBadge>}
                  </div>
                ))}
                <Button size="sm" className="mt-3.5" asChild><Link href="/accounts">Manage accounts</Link></Button>
              </Section>
            )}

            {section === "notifications" && (
              <Section title="Notifications" description="Choose what we tell you about.">
                {([["published", "Post published", "When a scheduled post goes live."],
                   ["failed", "Post failed", "When a post can't be published and needs attention."],
                   ["messages", "New messages", "A digest of unread inbox messages."],
                   ["weekly", "Weekly report", "Your performance summary every Monday."],
                   ["product", "Product updates", "New features and improvements."]] as const).map(([key, title, text]) => (
                  <div key={key} className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
                    <div><div className="text-[13.5px]">{title}</div><div className="text-[12.5px] text-dim">{text}</div></div>
                    <Switch checked={notify[key] ?? false} aria-label={title} onCheckedChange={(v) => saveNotifications({ ...notify, [key]: v })} />
                  </div>
                ))}
              </Section>
            )}

            {section === "billing" && (
              <Section title="Plan & usage" description={`You're on the ${data.plan.name} plan.`}
                footer={can("billing.manage") ? <Button size="sm" onClick={() => toast("Billing isn't enabled on this deployment yet.")}>Manage billing</Button> : undefined}>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[30px] font-semibold tracking-[-0.02em]">${(data.plan.priceCents / 100).toFixed(0)}</span>
                  <span className="text-muted-foreground">/ month</span>
                </div>
                {([["Posts this month", data.usage.posts, data.limits.posts_per_month],
                   ["Social accounts", data.usage.accounts, data.limits.social_accounts],
                   ["AI generations", data.usage.aiGenerations, data.limits.ai_generations]] as const).map(([label, value, limit]) => (
                  <div key={label} className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[12.5px]"><span>{label}</span><span className="text-dim">{value} / {limit ?? "unlimited"}</span></div>
                    <div className="h-[5px] rounded-full bg-white/[0.06]">
                      <motion.div className="h-full rounded-full bg-foreground" initial={{ width: 0 }} animate={{ width: limit ? `${Math.min(100, (value / limit) * 100)}%` : "8%" }} transition={{ duration: 0.6 }} />
                    </div>
                  </div>
                ))}
                <p className="mt-5 flex items-start gap-2 text-xs text-dim"><Shield size={13} className="mt-px shrink-0" />Usage resets at the start of each calendar month.</p>
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? "this member"}?`}
        description="They'll lose access to this workspace immediately. Their posts stay."
        confirmLabel="Remove"
        pending={pending}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
