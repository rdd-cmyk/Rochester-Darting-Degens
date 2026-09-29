// Inspect only the metadata shape of the isolated project's key-list response.
// Never print, write, or persist key values.
import {execFileSync} from 'node:child_process';
import {root,cliPath,localDockerEnv} from '../local-environment.mjs';

let output;
try{
 output=execFileSync(cliPath(),['projects','api-keys','--project-ref',
  'uepayhdrgzrxhkqbwebo','--reveal','-o','json'],{
  cwd:root,env:localDockerEnv(),encoding:'utf8',timeout:30000,
  windowsHide:true,stdio:['ignore','pipe','pipe']});
}catch{throw Error('Could not inspect isolated test key metadata');}
const value=JSON.parse(output.slice(output.indexOf('[')));
if(!Array.isArray(value))throw Error('Unexpected key metadata shape');
console.log(JSON.stringify(value.map(item=>({fields:Object.keys(item),
 keyType:item.type??null,name:item.name??null,
 hasKey:typeof item.api_key==='string'||typeof item.key==='string'}))));
