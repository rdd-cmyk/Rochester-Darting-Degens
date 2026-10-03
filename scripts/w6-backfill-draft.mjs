// Generate a review-only production admission draft from the owner-approved roster.
// This script does not connect to, or write to, any database.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './local-environment.mjs';

const dir = path.join(root, '.local', 'release-w6-testing');
const roster = JSON.parse(readFileSync(path.join(dir, 'approved-roster.json'), 'utf8'));
assert.equal(roster.sourceProjectRef, 'hrqsbzmsfichiimtxijj');
assert.equal(roster.admittedUserIds.length, 4);
assert.equal(roster.planningOrganizerIds.length, 2);
assert.deepEqual(roster.planningOrganizerIds, roster.boardOrganizerIds);
const uuid = value => {
  assert.match(value, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  return `'${value}'::uuid`;
};
const admitted = roster.admittedUserIds.map(uuid).join(',\n    ');
const organizers = roster.planningOrganizerIds.map(uuid).join(',\n    ');
const excluded = uuid(roster.excludedUserId);
const statement = `-- REVIEW ONLY. DO NOT RUN before W7 approval and the W8 write pause/fresh backup.
-- Production target: ${roster.sourceProjectRef}; source cutoff: ${roster.cutoffUtc}.
-- Re-audit Auth/profiles and reconcile every account created after that cutoff.
-- Run in the production release window only after the approved schema is installed.
begin;
do $$
begin
  if (select count(*) from auth.users) <> 5 then
    raise exception 'Auth roster changed; stop and reconcile before admission';
  end if;
  if (select count(*) from public.profiles where id in (${admitted})) <> 4 then
    raise exception 'Approved profiles missing; stop';
  end if;
  if exists (select 1 from public.league_members where user_id = ${excluded} and status = 'active') then
    raise exception 'Excluded test account is active; stop';
  end if;
end $$;
insert into public.league_members (user_id, status, source_invite_id)
select id, 'active', null from auth.users where id in (${admitted})
on conflict (user_id) do update set status = 'active'
where public.league_members.source_invite_id is null;
insert into rdd_private.planning_organizers (user_id)
select id from public.profiles where id in (${organizers})
on conflict (user_id) do nothing;
insert into public.board_members (user_id, status, role)
select id, 'approved', 'organizer' from public.profiles where id in (${organizers})
on conflict (user_id) do update set status = 'approved', role = 'organizer';
do $$
begin
  if (select count(*) from public.league_members where status = 'active' and user_id in (${admitted})) <> 4
    or (select count(*) from rdd_private.planning_organizers where user_id in (${organizers})) <> 2
    or (select count(*) from public.board_members where user_id in (${organizers})
        and status = 'approved' and role = 'organizer') <> 2 then
    raise exception 'Admission/organizer count mismatch; stop';
  end if;
end $$;
commit;
`;
writeFileSync(path.join(dir, 'production-backfill-REVIEW-ONLY.sql'), statement, { flag: 'wx' });
console.log('Generated ignored production admission draft for W7 review; no database changed.');
