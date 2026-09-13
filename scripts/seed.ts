/**
 * Demo seeding:  npm run db:seed -- you@example.com
 *
 * Creates a workspace flagged `is_demo` for an existing user and fills it with the demo content
 * from data/demo/content.ts: posts across statuses, "demo" social accounts, conversations and
 * 60 days of analytics. Demo rows are clearly marked so they never masquerade as real data.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ACCOUNTS, DEMO_CONVERSATIONS, DEMO_POSTS, demoSeries } from "../data/demo/content";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run db:seed -- you@example.com");
  process.exit(1);
}

const at = (dayOffset: number, time: string) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

async function main() {
  const { data: profile } = await db.from("profiles").select("id, full_name").eq("email", email).single();
  if (!profile) {
    console.error(`No user with email ${email}. Register in the app first, then re-run.`);
    process.exit(1);
  }
  const userId = (profile as { id: string }).id;

  const { data: ws, error: wsError } = await db.from("workspaces").insert({
    name: "Kairo Demo", slug: `kairo-demo-${Date.now().toString(36)}`, owner_id: userId,
    timezone: "Asia/Tashkent", plan_id: "pro", is_demo: true,
  }).select("id").single();
  if (wsError) throw wsError;
  const workspaceId = (ws as { id: string }).id;

  await db.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  await db.from("subscriptions").insert({ workspace_id: workspaceId, plan_id: "pro", status: "active" });

  // Accounts — flagged is_demo, with no oauth_tokens row, so nothing can actually publish.
  const { data: accounts } = await db.from("social_accounts").insert(
    DEMO_ACCOUNTS.map((a) => ({
      workspace_id: workspaceId, platform: a.platform, external_account_id: `demo-${a.platform}`,
      handle: a.handle, display_name: "Kairo Studio", followers_count: a.followers,
      status: "connected", is_demo: true, connected_by: userId, last_synced_at: new Date().toISOString(),
    })),
  ).select("id, platform");
  const accountByPlatform = new Map(((accounts ?? []) as { id: string; platform: string }[]).map((a) => [a.platform, a.id]));

  // Posts + targets
  for (const post of DEMO_POSTS) {
    const scheduled = post.status === "scheduled" || post.status === "draft";
    const { data: row } = await db.from("posts").insert({
      workspace_id: workspaceId, author_id: userId, title: post.title, caption: post.caption,
      status: post.status, timezone: "Asia/Tashkent",
      scheduled_at: post.status === "draft" ? null : at(post.dayOffset, post.time),
      published_at: post.status === "published" ? at(post.dayOffset, post.time) : null,
    }).select("id").single();
    if (!row) continue;
    const postId = (row as { id: string }).id;

    const { data: target } = await db.from("post_targets").insert({
      post_id: postId, workspace_id: workspaceId, platform: post.platform,
      social_account_id: accountByPlatform.get(post.platform) ?? null,
      status: post.status === "published" ? "published" : scheduled ? "queued" : "pending",
      published_at: post.status === "published" ? at(post.dayOffset, post.time) : null,
    }).select("id").single();

    if (target && post.status === "published") {
      await db.from("analytics_post").insert({
        workspace_id: workspaceId, post_target_id: (target as { id: string }).id, platform: post.platform,
        reach: post.reach, impressions: Math.round(post.reach * 1.4), likes: Math.round(post.reach * 0.06),
        comments: Math.round(post.reach * 0.008), shares: Math.round(post.reach * 0.004),
        clicks: Math.round(post.reach * 0.02), engagement_rate: post.engagementRate, source: "demo",
      });
    }
  }

  // 60 days of daily analytics per account
  const series = demoSeries(60);
  for (const [platform, accountId] of accountByPlatform) {
    const share = platform === "tiktok" ? 0.42 : platform === "instagram" ? 0.33 : platform === "linkedin" ? 0.16 : 0.09;
    await db.from("analytics_daily").insert(series.map((d) => ({
      workspace_id: workspaceId, social_account_id: accountId, platform, date: d.date,
      reach: Math.round(d.reach * share), impressions: Math.round(d.impressions * share),
      engagement: Math.round(d.reach * share * (d.engagement / 100)),
      likes: Math.round(d.likes * share), comments: Math.round(d.comments * share),
      shares: Math.round(d.shares * share), clicks: Math.round(d.clicks * share),
      followers: Math.round(d.followers * share), source: "demo",
    })));
  }

  // Inbox
  for (const c of DEMO_CONVERSATIONS) {
    const { data: convo } = await db.from("conversations").insert({
      workspace_id: workspaceId, social_account_id: accountByPlatform.get(c.platform) ?? null, platform: c.platform,
      external_thread_id: `demo-${c.platform}-${c.name.replace(/\W/g, "")}`,
      participant_name: c.name, participant_handle: c.handle, last_message_preview: c.preview,
      last_message_at: new Date(Date.now() - Math.random() * 6 * 3600_000).toISOString(),
      unread_count: c.unread ? 1 : 0,
    }).select("id").single();
    if (!convo) continue;
    const conversationId = (convo as { id: string }).id;
    await db.from("messages").insert(c.messages.map((m, i) => ({
      conversation_id: conversationId, workspace_id: workspaceId,
      direction: m.me ? "outgoing" : "incoming", body: m.text,
      sent_at: new Date(Date.now() - (c.messages.length - i) * 900_000).toISOString(),
    })));
  }

  console.log(`Seeded demo workspace ${workspaceId} for ${email}. Switch to "Kairo Demo" in the app.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
