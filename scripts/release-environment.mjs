// Fixed synthetic release target. No URL, project or port override is accepted.
import { execFileSync } from 'node:child_process';
process.env.RDD_LOCAL_STACK='release-w3';
const common=await import('./local-environment.mjs');
export const {root,localWorkdir,projectId,docker,dockerHost,localDockerEnv,localStatus,cliPath,assertLocalBindings,assertWindowsPortDefault}=common;
export const origin='http://127.0.0.1:3093';
export const mailOrigin='http://127.0.0.1:56930';
export const sql=(input,database='postgres')=>execFileSync('docker',['--host',dockerHost,'exec','-i',`supabase_db_${projectId}`,
 'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-At','-f','-'],{
 input,env:localDockerEnv(),cwd:root,encoding:'utf8',timeout:60000,windowsHide:true,stdio:['pipe','pipe','pipe']});
export const releaseFiles=[
 'supabase/tests/fixtures/advanced_statistics_foundation.sql',
 'supabase/tests/fixtures/league_night.sql',
 'supabase/tests/fixtures/league_planning.sql',
 'supabase/tests/fixtures/league_board.sql',
 'supabase/tests/fixtures/invite_only_registration.sql',
 'supabase/tests/fixtures/invite_parent_admission.sql',
 'supabase/tests/fixtures/game_modes.sql',
 'supabase/tests/fixtures/advanced_statistics_final.sql',
 'supabase/tests/fixtures/solo_play.sql',
 'supabase/tests/fixtures/rivalry_room.sql',
 'supabase/tests/fixtures/league_night_enforce.sql',
];
