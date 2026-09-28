import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
delete process.env.RDD_LOCAL_STACK;
const { localStatus, root } = await import('../local-environment.mjs');

const status = localStatus();
// Always rebuild with the guarded local environment; never serve a bundle that
// might embed a hosted Supabase URL. Port 3100 leaves other worktrees undisturbed.
execFileSync(process.execPath,[path.join(root,'scripts/dev-local.mjs'),'--build'], {cwd:root,stdio:'inherit',windowsHide:true});
const child = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3100'], {
  cwd:root,stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:status.ANON_KEY,
    RDD_LOCAL_PREVIEW:'1',GITHUB_TOKEN:'',GITHUB_REPO_OWNER:'',GITHUB_REPO_NAME:''},
});
child.on('error',()=>{process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code ?? 1;});
