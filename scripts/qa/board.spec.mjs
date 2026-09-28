import { createRequire } from 'node:module';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { localStatus, root } from '../local-environment.mjs';

const require=createRequire(import.meta.url);
if(!process.env.RDD_PLAYWRIGHT_ROOT) throw new Error('Set RDD_PLAYWRIGHT_ROOT to the installed Playwright package directory.');
const {test,expect}=require(path.join(process.env.RDD_PLAYWRIGHT_ROOT,'test.js'));
const status=localStatus();
const password='Local-Board-Fixture-2026!'; // Synthetic localhost accounts only.
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const unwrap=result=>{if(result.error)throw new Error(result.error.message);return result.data;};
const client=()=>createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
async function account(name) {
  const db=client(); const email=`board-${name}@example.test`;
  let response=await db.auth.signInWithPassword({email,password});
  if(response.error) response=await db.auth.signUp({email,password,options:{data:{display_name:`Board demo ${name}`,first_name:'Synthetic',include_first_name_in_display:false}}});
  const data=unwrap(response);if(!data.session)throw new Error('Expected local Auth session.');
  unwrap(await db.from('profiles').upsert({id:data.user.id,display_name:`Board demo ${name}`,first_name:'Synthetic',include_first_name_in_display:false}));
  return{db,id:data.user.id,email};
}
async function isolate(context) {
  await context.addInitScript(()=>localStorage.setItem('summer-overlay-enabled','false'));
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return ['http://127.0.0.1:3100','http://127.0.0.1:54321'].includes(url.origin)?route.continue():route.abort('blockedbyclient');
  });
}
async function login(page,person) {
  await page.goto('/auth?next=%2Fboard');
  await page.getByLabel('Email',{exact:true}).fill(person.email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/board$/);
}

test('approved membership, conversations, drafts, moderation, responsive design, and revocation',async({page,context,browser})=>{
  await isolate(context);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const organizer=await account('organizer');const player=await account('player');const outsider=await account('outsider');
  // Only clearly synthetic fixture identities and their board rows are reset.
  const ids=[organizer.id,player.id,outsider.id];
  unwrap(await admin.from('board_posts').delete().in('author_id',ids));
  unwrap(await admin.from('board_write_log').delete().in('user_id',ids));
  unwrap(await admin.from('board_members').delete().in('user_id',ids));
  unwrap(await admin.from('board_members').insert({user_id:organizer.id,status:'approved',role:'organizer'}));
  const organizerContext=await browser.newContext();await isolate(organizerContext);
  const organizerPage=await organizerContext.newPage();
  let postId;
  try {
    await test.step('signed-out privacy, access request, organizer approval',async()=>{
      await page.goto('/board');await expect(page.getByRole('link',{name:'Sign in to the board'})).toBeVisible();
      await login(page,player);
      await page.getByRole('button',{name:'Request board access'}).click();
      await expect(page.getByText('Your request is with the organizers.')).toBeVisible();
      await login(organizerPage,organizer);
      await organizerPage.getByRole('button',{name:'Organizer tools',exact:true}).click();
      const memberRow=organizerPage.locator('.board-admin-row').filter({hasText:'Board demo player'});
      await memberRow.getByRole('button',{name:'Approve',exact:true}).click();
      await expect(memberRow).toContainText('approved');
      await page.getByRole('button',{name:'Check access again'}).click();
      await expect(page.getByText('Who’s throwing this week?',{exact:true})).toBeVisible();
      await page.screenshot({path:path.join(root,'test-results/board/empty-desktop.png'),fullPage:true});
    });
    await test.step('starter, draft reload, server persistence and safe text',async()=>{
      await page.getByRole('button',{name:'Who’s throwing?',exact:true}).click();
      await page.getByLabel('Your post',{exact:true}).fill('Practice Thursday? <script>alert("plain text")</script>');
      await page.reload();
      await expect(page.getByLabel('Your post',{exact:true})).toHaveValue('Practice Thursday? <script>alert("plain text")</script>');
      await page.getByRole('button',{name:'Post to league',exact:true}).click();
      const post=page.getByRole('article');
      await expect(post).toContainText('Practice Thursday? <script>alert("plain text")</script>');
      postId=unwrap(await player.db.from('board_posts').select('id').eq('author_id',player.id).single()).id;
      await page.reload();await expect(page.getByRole('article')).toContainText('Practice Thursday?');
      const outside=await outsider.db.rpc('board_feed');expect(outside.error?.code).toBe('42501');
      expect(unwrap(await outsider.db.from('board_posts').select('id'))).toHaveLength(0);
    });
    await test.step('reply, reaction, editing, private homepage and direct link',async()=>{
      await page.getByRole('article').getByRole('button',{name:'Reply',exact:true}).click();
      await page.getByLabel('Your reply',{exact:true}).fill('I can make it at six.');
      await page.getByRole('button',{name:'Post reply',exact:true}).click();
      await expect(page.getByText('I can make it at six.',{exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Cheers',exact:true}).click();
      await expect(page.getByRole('button',{name:'Cheers · 1 · You'})).toHaveAttribute('aria-pressed','true');
      await page.locator('article > .board-tools summary').click();
      await page.getByRole('button',{name:'Edit post',exact:true}).click();
      await page.getByLabel('Edit post',{exact:true}).fill('Practice Thursday at six?');
      await page.getByRole('button',{name:'Save changes',exact:true}).click();
      await expect(page.getByRole('article')).toContainText('Practice Thursday at six?');
      await page.goto('/');await expect(page.getByRole('region',{name:'From the League Board'})).toContainText('Practice Thursday at six?');
      await page.getByRole('region',{name:'From the League Board'}).getByRole('link').filter({hasText:'Board demo player'}).click();
      await expect(page).toHaveURL(new RegExp(`/board/${postId}$`));
      await expect(page.getByText('I can make it at six.',{exact:true})).toBeVisible();
      const savedReply=unwrap(await player.db.from('board_replies').select('id').eq('post_id',postId).single());
      unwrap(await player.db.rpc('board_write',{p_action:'edit_reply',p_target:savedReply.id,p_body:'I can make it at six. See you there!'}));
      await page.getByRole('button',{name:'Refresh',exact:true}).click();
      await expect(page.getByText('I can make it at six. See you there!',{exact:true})).toBeVisible();
      await page.setViewportSize({width:375,height:850});
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:path.join(root,'test-results/board/thread-mobile-light.png'),fullPage:true});
      await page.emulateMedia({colorScheme:'dark'});
      await expect.poll(()=>page.getByLabel('Your reply',{exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');
      await page.screenshot({path:path.join(root,'test-results/board/thread-mobile-dark.png'),fullPage:true});
      await page.setViewportSize({width:1366,height:1000});await page.emulateMedia({colorScheme:'light'});
    });
    await test.step('organizer pin and close, reporting and hide/restore',async()=>{
      await organizerPage.goto(`/board/${postId}`);
      await organizerPage.locator('article > .board-tools summary').click();
      await organizerPage.getByRole('button',{name:'Pin for the league'}).click();
      await expect(organizerPage.getByText('Pinned for the league',{exact:true})).toBeVisible();
      await organizerPage.getByRole('button',{name:'Close conversation',exact:true}).click();
      await expect(organizerPage.getByRole('button',{name:'Reopen conversation'})).toBeVisible();
      expect((await player.db.rpc('board_write',{p_action:'create_reply',p_target:postId,p_body:'Should fail'})).error?.code).toBe('42501');
      await page.reload();
      await expect(page.getByLabel('Your reply')).toHaveCount(0);
      await page.locator('article > .board-tools summary').click();
      await page.getByRole('button',{name:'Report post',exact:true}).click();
      await page.getByLabel('What should the organizers know?').fill('Synthetic moderation test');
      await page.getByRole('button',{name:'Send report',exact:true}).click();
      await expect(page.getByText('Report sent to the organizers.')).toBeVisible();
      await organizerPage.goto('/board');
      await organizerPage.getByRole('button',{name:'Organizer tools',exact:true}).click();
      const report=organizerPage.locator('.board-admin-row').filter({hasText:'Synthetic moderation test'});
      await report.getByRole('button',{name:'Hide post',exact:true}).click();
      await report.getByRole('button',{name:'Resolve report',exact:true}).click();
      await page.reload();await expect(page.getByRole('heading',{name:'Conversation unavailable'})).toBeVisible();
      await organizerPage.getByRole('button',{name:'Restore post',exact:true}).click();
      await page.reload();await expect(page.getByRole('article')).toContainText('Practice Thursday at six?');
    });
    await test.step('revoke removes feed access and homepage content; sign-out clears it',async()=>{
      const row=organizerPage.locator('.board-admin-row').filter({hasText:'Board demo player'});
      organizerPage.once('dialog',dialog=>dialog.accept());
      await row.getByRole('button',{name:'Revoke access'}).click();
      await expect(row).toContainText('revoked');
      await page.reload();await expect(page.getByText('Your board access is paused.')).toBeVisible();
      await page.goto('/');await expect(page.getByRole('region',{name:'From the League Board'})).toHaveCount(0);
      await page.getByRole('button',{name:'Sign Out',exact:true}).click();
      await page.goto(`/board/${postId}`);await expect(page.getByRole('link',{name:'Sign in to the board'})).toBeVisible();
      await page.goto('/');await expect(page.getByText('Practice Thursday at six?')).toHaveCount(0);
    });
    expect(errors).toEqual([]);
  } finally {await organizerContext.close();}
});
