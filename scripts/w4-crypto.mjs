// W4 backup envelope: scrypt-derived AES-256-GCM. The passphrase is never
// passed on a command line, written to a file or included in a manifest.
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';

const magic=Buffer.from('RDDW4-AES256-GCM-v1\0','utf8');
const saltBytes=16,ivBytes=12,tagBytes=16;
const kdf={N:131072,r:8,p:1,maxmem:256*1024*1024};
export const envelopeVersion='RDDW4-AES256-GCM-v1';
export function encrypt(plaintext,passphrase){
 if(!Buffer.isBuffer(plaintext)||!Buffer.isBuffer(passphrase)||passphrase.length<24)
  throw Error('Expected buffer plaintext and a 24+ byte passphrase');
 const salt=randomBytes(saltBytes),iv=randomBytes(ivBytes);
 const key=scryptSync(passphrase,salt,32,kdf);
 try{
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const body=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  return Buffer.concat([magic,salt,iv,body,cipher.getAuthTag()]);
 }finally{key.fill(0);}
}
export function decrypt(envelope,passphrase){
 if(!Buffer.isBuffer(envelope)||!Buffer.isBuffer(passphrase)||
    envelope.length<magic.length+saltBytes+ivBytes+tagBytes||
    !envelope.subarray(0,magic.length).equals(magic))throw Error('Invalid W4 backup envelope');
 const saltStart=magic.length,ivStart=saltStart+saltBytes,bodyStart=ivStart+ivBytes;
 const salt=envelope.subarray(saltStart,ivStart),iv=envelope.subarray(ivStart,bodyStart);
 const tag=envelope.subarray(envelope.length-tagBytes);
 const key=scryptSync(passphrase,salt,32,kdf);
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(envelope.subarray(bodyStart,envelope.length-tagBytes)),decipher.final()]);
 }finally{key.fill(0);}
}
