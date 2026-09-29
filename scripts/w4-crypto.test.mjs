import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {encrypt,decrypt} from './w4-crypto.mjs';

describe('W4 encrypted backup envelope',()=>{
 const passphrase=Buffer.from('a private test-only recovery phrase with sufficient length');
 it('restores exact binary contents while using a fresh salt and nonce',()=>{
  const input=randomBytes(150000);
  const first=encrypt(input,passphrase),second=encrypt(input,passphrase);
  expect(first.equals(second)).toBe(false);
  expect(decrypt(first,passphrase).equals(input)).toBe(true);
  expect(decrypt(second,passphrase).equals(input)).toBe(true);
 });
 it('rejects wrong keys and corruption before accepting a restore',()=>{
  const sealed=encrypt(Buffer.from('fictional database contents'),passphrase);
  expect(()=>decrypt(sealed,Buffer.from('a different private test-only recovery phrase'))).toThrow();
  sealed[sealed.length-18]^=1;
  expect(()=>decrypt(sealed,passphrase)).toThrow();
 });
});
