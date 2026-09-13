\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','alice@x.com','{"full_name":"Alice","timezone":"Asia/Tashkent"}'),
 ('22222222-2222-2222-2222-222222222222','bob@x.com','{"full_name":"Bob","timezone":"Not/AZone"}'),
 ('33333333-3333-3333-3333-333333333333','viv@x.com','{}');
select name, timezone, (select role from workspace_members m where m.workspace_id=w.id) role from workspaces w order by name;

-- make viv a viewer and bob a member in alice's workspace (as service)
insert into workspace_members select id, '33333333-3333-3333-3333-333333333333', 'viewer' from workspaces where owner_id='11111111-1111-1111-1111-111111111111';
insert into workspace_members select id, '22222222-2222-2222-2222-222222222222', 'member' from workspaces where owner_id='11111111-1111-1111-1111-111111111111';

set role authenticated;
-- ===== Alice (owner)
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select 'alice sees workspaces' t, count(*) from workspaces;
insert into posts (workspace_id, author_id, caption, status, scheduled_at) select id, auth.uid(), 'hello', 'scheduled', now()+interval '1 day' from workspaces where owner_id=auth.uid();
select 'alice posts' t, count(*) from posts;
update profiles set is_super_admin = true where id = auth.uid();
update workspaces set plan_id='business';
-- ===== Bob (member in alice ws, owner of own)
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select 'bob sees workspaces' t, count(*) from workspaces;
select 'bob sees alice post' t, count(*) from posts;
insert into posts (workspace_id, author_id, caption, status, scheduled_at) select id, auth.uid(), 'bob sched', 'scheduled', now() from workspaces where owner_id='11111111-1111-1111-1111-111111111111';
insert into posts (workspace_id, author_id, caption) select id, auth.uid(), 'bob draft' from workspaces where owner_id='11111111-1111-1111-1111-111111111111';
update posts set caption='hijack' where caption='hello';
select 'hijack rows affected ->' t, count(*) from posts where caption='hijack';
update workspace_members set role='owner' where user_id=auth.uid();
-- ===== Viv (viewer)
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',false);
insert into posts (workspace_id, author_id, caption) select id, auth.uid(), 'viv' from workspaces where owner_id='11111111-1111-1111-1111-111111111111';
select 'viv sees posts' t, count(*) from posts;
select 'viv sees oauth tokens' t;  select count(*) from oauth_tokens;
select 'viv creates ws' t, create_workspace('Viv Co','Europe/London') is not null;
-- ===== stranger
select set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444',false);
select 'stranger sees' t, (select count(*) from workspaces) ws, (select count(*) from posts) posts, (select count(*) from profiles) profiles;
reset role;
select 'super admin flag' t, is_super_admin from profiles where email='alice@x.com';
select 'alice plan' t, plan_id from workspaces where owner_id='11111111-1111-1111-1111-111111111111';
