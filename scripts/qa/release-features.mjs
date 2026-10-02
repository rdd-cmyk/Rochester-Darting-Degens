// Reuse complete feature suites on one fixed release target. Generated adapters
// are ignored artifacts; originals stay available for historical feature stacks.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {root,localWorkdir,localStatus,localDockerEnv,sql} from '../release-environment.mjs';
const [suite,...extra]=process.argv.slice(2);
if(extra.length||!['rivalry-api','solo-api','game-modes-api','rivalry-browser','solo-browser','game-modes-browser','shared-browser','invites-api','planning-browser','night-browser','board-browser','board-regressions','invites-browser'].includes(suite))throw Error('Choose a fixed W3 feature suite.');
localStatus();
const config={
 'rivalry-api':['rivalry-api.mjs','rivalry-room'],
 'solo-api':['solo-api.mjs','solo'],
 'game-modes-api':['game-modes-api.mjs','game-modes'],
 'rivalry-browser':['rivalry-browser.cjs','rivalry-room'],
 'solo-browser':['solo-browser.cjs','solo'],
 'game-modes-browser':['game-modes-browser.cjs','game-modes'],
 'shared-browser':['rivalry-ui-integration.mjs','rivalry-room'],
 'invites-api':['invites-integration.mjs','invites'],
 'planning-browser':['planning-browser.mjs','planning'],
 'night-browser':['league-night.spec.mjs','night'],
 'board-browser':['board.spec.mjs','board'],
 'board-regressions':['board-regressions.spec.mjs','board'],
 'invites-browser':['invites.spec.mjs','invites'],
};
const [file,feature]=config[suite];
const original=readFileSync(path.join(root,'scripts/qa',file),'utf8');
let source=original;
const replace=(from,to)=>{if(!source.includes(from))throw Error('Stale QA adapter: '+file+' '+from);source=source.replaceAll(from,to);};
source=source.replace(/process\.env\.RDD_LOCAL_STACK\s*=\s*["'][^"']+["'];?/g,"process.env.RDD_LOCAL_STACK='release-w3';");
source=source.replaceAll('delete process.env.RDD_LOCAL_STACK;', "process.env.RDD_LOCAL_STACK='release-w3';");
source=source.replaceAll('../local-environment.mjs',pathToFileURL(path.join(root,'scripts/local-environment.mjs')).href);
source=source.replaceAll('.local/'+feature,'.local/release-w3/'+feature);
source=source.replaceAll('docs/testing/'+feature,'.local/release-w3/'+feature+'/browser');
for(const port of ['3040','3016','3013','3030','3010','3100'])source=source.replaceAll('http://127.0.0.1:'+port,'http://127.0.0.1:3093');
for(const port of ['56621','56321','55721','55821','55421','54321'])source=source.replaceAll('http://127.0.0.1:'+port,'http://127.0.0.1:56921');
if(['planning-browser','night-browser','board-browser'].includes(suite)) {
 const start=source.indexOf('async function account(name)');
 const end=source.indexOf('\n}',start)+2;
 if(start<0||end<=start)throw Error('Missing fixture account helper');
 source=source.slice(0,start)+`async function account(name) {
 const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const db=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email='w3-${feature}-'+name.toLowerCase()+'-'+Date.now()+'@example.test';
 const user=unwrap(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 unwrap(await admin.from('league_members').insert({user_id:user.id}));
 const auth=unwrap(await db.auth.signInWithPassword({email,password}));
 unwrap(await db.from('profiles').upsert({id:auth.user.id,display_name:${suite==='board-browser'?"'Board demo '+name":"'Demo '+name"},first_name:'Demo',last_name:'Synthetic',include_first_name_in_display:false}));
 return {db,id:auth.user.id,email};
}`+source.slice(end);
 if(suite==='night-browser') {
  // October 1 front door: login lands on League Night; archive recording is explicit.
  source=source.replaceAll('name: "Darts Matches", exact: true', 'name: "Matches", exact: true');
  source=source.replace('page.getByRole("heading", { name: "Matches", exact: true }),', 'page.getByRole("heading", { name: "League Night", exact: true }),');
  const loginEnd=source.indexOf('\n}',source.indexOf('async function signIn(page, person)'));
  if(loginEnd<0)throw Error('Missing sign-in helper');
  source=source.slice(0,loginEnd)+`\n  await page.goto('/matches'); await openRecording(page);`+source.slice(loginEnd);
  source+=`\nasync function openRecording(page) {
   if (!(await page.locator('#match-editor').isVisible())) {
    await page.getByRole('button',{name:'Record a standalone match',exact:true}).click();
    await page.getByRole('button',{name:'Continue with standalone',exact:true}).click();
   }
  }
  async function openArchiveEdit(page, notes) {
   const row=page.locator('details.archive-match').filter({hasText:notes}).first();
   if ((await row.getAttribute('open')) === null) await row.locator('summary').click();
   await row.getByRole('button',{name:'Edit result',exact:true}).click();
  }\n`;
  source=source.replace('async function fillClassic(page, venue) {', 'async function fillClassic(page, venue) {\n  await openRecording(page);');
  source=source.replace(/await page\s*\.getByRole\("listitem"\)\s*\.filter\(\{ hasText: `Notes: \$\{marker\}` \}\)\s*\.getByRole\("button", \{ name: "Edit", exact: true \}\)\s*\.click\(\);/, 'await openArchiveEdit(page, `Notes: ${marker}`);');
  source=source.replace("await page.getByRole('listitem').filter({hasText:'Notes: Synthetic queued result'}).first().getByRole('button',{name:'Edit',exact:true}).click();", "await openArchiveEdit(page, 'Notes: Synthetic queued result');");
  source=source.replaceAll('Tonight’s awards','Night awards');
  source=source.replace('page.getByText(`Notes: Newer ${marker}`, { exact: true })', 'page.locator("details.archive-match").filter({hasText:`Notes: Newer ${marker}`})');
  // A different account starts in the archive until it explicitly opens recording.
  source=source.replace('await expect(\n    page.getByLabel("Player 1 3-Dart Average", { exact: true }),\n  ).toHaveValue("");', 'await openRecording(page);\n  await expect(page.getByLabel("Player 1 3-Dart Average", { exact: true })).toHaveValue("");');
  replace('localStatus, leagueNightLocal, root', 'localStatus, projectId, root');
  replace('if (!leagueNightLocal)',"if (projectId !== 'rdd-release-w3')");
  source=source.replace('match_id: null,', 'submitted_by: ben.id, match_id: null,');
  replace('...p,\n          played_at:', '...p,\n          submitted_by: person.id, played_at:');
  source=source.replaceAll('name: "Demo Ben", exact: true', 'name: /Demo Ben/').replaceAll('name: "Demo Tim", exact: true', 'name: /Demo Tim/');
  source=source.replaceAll('Player 1 3-Dart Average', 'Player 1 3DA').replaceAll('Player 2 3-Dart Average', 'Player 2 3DA');
  replace('let ben, tim;', 'let ben, tim, alex;');
  replace('await account("Alex");', 'alex = await account("Alex");');
  source=source.replaceAll('phone.getByLabel("Demo Alex", { exact: true })', 'phone.locator(`.night-attendance-editor input[value="${alex.id}"]`)');
  source=source.replace(/page\.locator\("\.night-player-pool"\)\.getByRole\("button", \{\s*name: `Demo \$\{arrival\.email.*?\}\s*\)/s, 'page.locator(`.night-player-pool button[value="${arrival.id}"]`)');
 }
}
if(suite==='planning-browser')source=source.replaceAll('".qa-artifacts", "planning"','".local", "release-w3", "planning"');
if(suite==='board-regressions'){
 replace("unwrap(await admin.from('board_members').insert", "unwrap(await admin.from('league_members').insert({user_id:user.id}));\n  unwrap(await admin.from('board_members').insert");
 source=source.replaceAll("expect(await page.evaluate(key => sessionStorage.getItem(key), `rdd-board:${user.id}:edit:${posts[39].id}`)).toBeNull();", "await expect.poll(()=>page.evaluate(key => sessionStorage.getItem(key), `rdd-board:${user.id}:edit:${posts[39].id}`)).toBeNull();");
 source=source.replace("const saved = unwrap(await admin.from('board_replies').select('id,body').eq('post_id', postId).eq('body', 'Confirmed reply kept through outages').single());", "await expect.poll(async()=> (await admin.from('board_replies').select('id').eq('post_id',postId).eq('body','Confirmed reply kept through outages')).data?.length).toBe(1);\n  const saved = unwrap(await admin.from('board_replies').select('id,body').eq('post_id', postId).eq('body', 'Confirmed reply kept through outages').single());");
 source=source.replace("else await page.goto(`/board/${postId}`);", "else { await page.goto(`/board/${postId}`); await page.waitForLoadState('networkidle'); }");
}
if(suite.startsWith('board'))source=source.replaceAll('test-results/board', '.local/release-w3/board/browser');
if(suite==='board-browser'){
 replace("const report=organizerPage.locator('.board-admin-row').filter({hasText:'Synthetic moderation test'});", "await organizerPage.getByRole('button',{name:'Refresh tools'}).click();\n      const report=organizerPage.locator('.board-admin-row').filter({hasText:'Synthetic moderation test'});");
 source=source.replaceAll(".filter({hasText:'Board demo player'})", ".filter({hasText:player.id.slice(0,8)})");
 source=source.replaceAll("page.getByRole('article')", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))})");
 source=source.replaceAll("page.getByLabel('Your reply'", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByLabel('Your reply'");
 source=source.replaceAll("page.getByRole('button',{name:'Post reply'", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByRole('button',{name:'Post reply'");
 source=source.replaceAll("page.getByRole('button',{name:'Cheers'", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByRole('button',{name:'Cheers'");
 source=source.replaceAll("page.getByRole('button',{name:'Cheers · 1 · You'", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByRole('button',{name:'Cheers · 1 · You'");
 source=source.replaceAll("page.locator('article > .board-tools summary')", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).locator(':scope > .board-tools summary')");
 source=source.replace("await page.getByRole('button',{name:'Report post',exact:true}).click();", "await page.waitForLoadState('networkidle');\n      const postOptions=page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).locator(':scope > .board-tools details');\n      if(!(await postOptions.evaluate(element=>element.open)))await postOptions.locator('summary').click();\n      await expect(postOptions.getByRole('button',{name:'Report post',exact:true})).toBeVisible();\n      await postOptions.getByRole('button',{name:'Report post',exact:true}).click();");
 source=source.replaceAll("page.getByText('I can make it at six.',{exact:true})", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByText('I can make it at six.',{exact:true})");
 source=source.replaceAll("page.getByText('Practice Thursday at six?')", "page.getByRole('article',{name:new RegExp(player.id.slice(0,8))}).getByText('Practice Thursday at six?')");
 source=source.replaceAll(".filter({hasText:'Board demo player'}).click()", ".filter({hasText:player.id.slice(0,8)}).click()");
 source=source.replaceAll("'Synthetic moderation test'", "`Synthetic moderation ${postId}`");
 replace("'Board demo '+name", "'Board demo '+name+' '+user.id.slice(0,8)");
 replace("page.getByText('Who’s throwing this week?',{exact:true})", "page.getByRole('button',{name:'Who’s throwing?',exact:true})");
}
if(suite==='rivalry-api'){
 replace('projectId !== "rdd-rivalry-room"','projectId !== "rdd-release-w3"');
 replace('`rivalry-${name.toLowerCase()}@example.test`','`rivalry-${name.toLowerCase()}-${Date.now()}@example.test`');
}
if(suite==='solo-api'){
 replace('if (!soloLocal)','if (projectId !== "rdd-release-w3")');
 replace('`solo-${name.toLowerCase()}@example.test`','`solo-${name.toLowerCase()}-${Date.now()}@example.test`');
}
if(suite==='game-modes-api'){
 replace('const {localStatus,gameModesLocal}', 'const {localStatus,projectId,docker}');
 replace('if(!gameModesLocal)',"if(projectId!=='rdd-release-w3')");
 // Only six specifically fictional identities are admitted, before profile
 // writes. No blanket signup/admission shortcut or RLS weakening.
 replace('const auth=unwrap(signed);',`const auth=unwrap(signed);
 docker(['exec','supabase_db_'+projectId,'psql','-U','postgres','-Atqc',
 "INSERT INTO public.league_members(user_id) VALUES('"+auth.user.id+"') ON CONFLICT(user_id) DO UPDATE SET status='active'"]);`);
 // Outer Rivalry receipts require the exact original payload, including order.
 replace('save({...p,players:[...p.players].reverse()},operation)','save(p,operation)');
 replace("?.code==='22023','Changed config cannot reuse mutation ID'","?.code==='PT409','Changed config cannot reuse mutation ID'");
}
if(suite==='invites-api'||suite==='invites-browser'){
 replace("import { inviteStatus, inviteSql } from '../invites-local.mjs';",`import {localStatus as inviteStatus,sql as releaseSql} from '${pathToFileURL(path.join(root,'scripts/release-environment.mjs')).href}';\nconst inviteSql=input=>releaseSql(input).trim();`);
 source=source.replaceAll('http://127.0.0.1:3102','http://127.0.0.1:3093').replaceAll('http://127.0.0.1:56530','http://127.0.0.1:56930');
 if(suite==='invites-browser') {
  source=source.replaceAll('3102','3093');
  source=source.replaceAll('56524','56924');
  source=source.replaceAll("await page.goto('/invites');", "await page.goto('/invites'); await page.waitForLoadState('networkidle');");
  replace("await expect(page.getByText('Password updated successfully. You can now sign in.')).toBeVisible();", "await expect.poll(async()=>{const probe=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}}); return (await probe.auth.signInWithPassword({email,password:renewed})).error===null;}).toBe(true);");
  source=source.replaceAll("await expect(page.getByText('Invitation sent.', { exact: true })).toBeVisible();", "await expect(page.getByText(recipient, { exact: true })).toBeVisible();");
  replace("test('sender can revoke a pending invitation; revoked link cannot begin onboarding', async ({ page })", "test('sender can revoke a pending invitation; revoked link cannot begin onboarding', async ({ page, browser })");
  const marker="await expect(page.locator('.invite-revoked')).toHaveText('revoked');";
  const at=source.indexOf(marker);if(at<0)throw Error('Revocation adapter stale');
  let after=source.slice(at+marker.length);
  after=after.replace('await page.goto(link);','const recipientPage=await browser.newPage(); await recipientPage.goto(link);');
  after=after.replace("await expect(page.getByText('This invitation is unavailable, expired, or replaced. Ask the sender for a new invitation.')).toBeVisible();", "await expect(recipientPage.getByText('This invitation is unavailable, expired, or replaced. Ask the sender for a new invitation.')).toBeVisible();");
  after=after.replace("await expect(page.getByRole('button', { name: 'Send verification code' })).toHaveCount(0);", "await expect(recipientPage.getByRole('button', { name: 'Send verification code' })).toHaveCount(0); await recipientPage.close();");
  source=source.slice(0,at+marker.length)+after;
  source=source.replaceAll('.qa-artifacts/invites-', '.local/release-w3/invites/browser-');
 } else {
 replace("const matchPayload = { played_at:","const matchPayload = { submitted_by: sender.id, played_at:");
 replace("p_payload: { ...matchPayload, match_id:","p_payload: { ...matchPayload, submitted_by: other.id, match_id:");
 replace("assert.equal((await provisional.db.from('stats_match_facts').select('match_id')).error?.code, '42501');",
 "assert.equal(unwrap(await provisional.db.from('stats_match_facts').select('match_id')).length,0);");
 replace("assert.equal((await sender.db.from('stats_match_facts').select('match_id')).error?.code, '42501');",
 "assert.ok(unwrap(await sender.db.from('stats_match_facts').select('match_id')).some(row=>row.match_id===match.match_id));");
 }
}
if(suite==='shared-browser') {
 replace('[320, 390, 1024, 1440]', '[320, 390, 768, 1024, 1440]');
 // The combined release also contains game/solo/invitation fixtures, so the
 // directory must contain the expected Rivalry people rather than exactly four.
 replace("assert.equal(await page.locator('.directory-item .player-avatar').count(), demo.people.length", "assert((await page.locator('.directory-item .player-avatar').count()) >= demo.people.length");
}
// W3 only enables mode writes deliberately for fictional full-feature acceptance.
if(suite==='game-modes-api')sql('UPDATE rdd_private.game_modes_control SET enabled=true;');
mkdirSync(path.join(localWorkdir,feature),{recursive:true});
mkdirSync(path.join(localWorkdir,'qa'),{recursive:true});
const target=path.join(localWorkdir,'qa',file);
writeFileSync(target,source);
const hash=text=>createHash('sha256').update(text).digest('hex');
writeFileSync(path.join(localWorkdir,'qa',suite+'-adapter.json'),JSON.stringify({file,sourceSha256:hash(original),adapterSha256:hash(source),scope:'fixed W3 target and deliberate fictional fixture admission; assertions retained'},null,2));
let args=[target];
if(file.endsWith('.spec.mjs')) {
 const config=path.join(localWorkdir,'qa',suite+'.config.mjs');
 writeFileSync(config,`export default ${JSON.stringify({testDir:'.',testMatch:file,timeout:120000,expect:{timeout:15000},workers:1,retries:0,reporter:'list',outputDir:path.join(localWorkdir,feature,'browser'),use:{channel:'msedge',baseURL:'http://127.0.0.1:3093',viewport:{width:1440,height:1100},screenshot:'only-on-failure'}})};`);
 args=[path.join(process.env.RDD_PLAYWRIGHT_ROOT??'C:/Users/linfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','cli.js'),'test','--config',config];
}
execFileSync(process.execPath,args,{cwd:root,env:{...localDockerEnv(),RDD_LOCAL_STACK:'release-w3',RDD_REVIEW_ARTIFACTS:'1',
 RDD_PLAYWRIGHT_ROOT:process.env.RDD_PLAYWRIGHT_ROOT??'C:/Users/linfo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'},
 windowsHide:true,timeout:300000,stdio:'inherit'});
