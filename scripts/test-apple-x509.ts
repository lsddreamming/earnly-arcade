import {Buffer} from 'node:buffer';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {CompatibleCertificate,installAppleX509Compatibility} from '../supabase/functions/_shared/apple-x509-compat.ts';
const fixture=JSON.parse(await Deno.readTextFile(new URL('../tests/fixtures/apple-certificates.json',import.meta.url)));
const roots=fixture.roots.map((s:string)=>Buffer.from(s,'base64'));
Deno.test('RSA and EC certificate signatures verify; wrong signer and tampering fail',()=>{
 for(const der of roots){
  const cert=new CompatibleCertificate(der);
  assert.equal(cert.verify(cert.publicKey),true);
  const other=new CompatibleCertificate(roots.find((r:Buffer)=>!r.equals(der))!);
  assert.equal(cert.verify(other.publicKey),false);
  const altered=Buffer.from(der);altered[altered.length-1]^=1;
  assert.equal(new CompatibleCertificate(altered).verify(cert.publicKey),false);
  assert.deepEqual(new CompatibleCertificate(cert.toString()).raw,der);
 }
});
Deno.test('real Apple leaf and intermediate preserve OCSP URLs and CA constraints',()=>{
 const [leaf,intermediate]=fixture.chain.map((s:string)=>new CompatibleCertificate(Buffer.from(s,'base64')));
 assert.equal(leaf.ca,false);assert.equal(intermediate.ca,true);
 assert.equal(leaf.verify(intermediate.publicKey),true);
 assert.match(leaf.infoAccess!,/^OCSP - URI:http/);
 assert.match(intermediate.infoAccess!,/^OCSP - URI:http/);
 assert.equal(leaf.issuer,intermediate.subject);
 assert.ok(leaf.validFrom);assert.ok(leaf.validTo);
});
Deno.test('compatibility applies to certificates constructed by Apple dependency',()=>{
 installAppleX509Compatibility(roots[0]);
 const cert=new crypto.X509Certificate(roots[0]);
 assert.deepEqual(cert.raw,roots[0]);assert.equal(cert.verify(cert.publicKey),true);
});

import {SignedDataVerifier,Environment} from 'npm:@apple/app-store-server-library@3.1.0';
Deno.test('official verifier accepts Apple TEST and rejects tampering, wrong app and environment',async()=>{
 installAppleX509Compatibility(roots[0]);
 // Offline deterministic regression uses Apple's signedDate. Deployed verifier always enables OCSP.
 const verifier=new SignedDataVerifier(roots,false,Environment.SANDBOX,'com.earnly.arcade',6814277509);
 const signed=fixture.signedTestNotification;
 assert.equal((await verifier.verifyAndDecodeNotification(signed)).notificationType,'TEST');
 const parts=signed.split('.');
 const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());payload.notificationType='REFUND';
 await assert.rejects(()=>verifier.verifyAndDecodeNotification([parts[0],Buffer.from(JSON.stringify(payload)).toString('base64url'),parts[2]].join('.')));
 const sig=Buffer.from(parts[2],'base64url');sig[0]^=1;
 await assert.rejects(()=>verifier.verifyAndDecodeNotification([parts[0],parts[1],sig.toString('base64url')].join('.')));
 await assert.rejects(()=>new SignedDataVerifier(roots,false,Environment.PRODUCTION,'com.earnly.arcade',6814277509).verifyAndDecodeNotification(signed));
 await assert.rejects(()=>new SignedDataVerifier(roots,false,Environment.SANDBOX,'com.other.app').verifyAndDecodeNotification(signed));
 await assert.rejects(()=>new SignedDataVerifier([],false,Environment.SANDBOX,'com.earnly.arcade').verifyAndDecodeNotification(signed));
});
