/**
 * Fill missing X509 accessors in Supabase's older Deno Node-compat runtime.
 * Apple's library still performs chain, extension, expiry, OCSP and JWS checks.
 * The fallback parses certificates with Apple's pinned dependency, but uses
 * native crypto for signature math to stay within the Edge CPU budget.
 * Remove when the deployed runtime implements the complete X509Certificate API.
 */
import crypto, {X509Certificate as NativeCertificate, type KeyObject} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {X509,ASN1HEX} from 'npm:jsrsasign@11.1.5';

export function verifyCertificateSignature(der:Buffer,key:KeyObject):boolean {
 try {
  const hex=der.toString('hex');
  const cert=new X509();cert.readCertHex(hex);
  const algorithm=cert.getSignatureAlgorithmField();
  if(algorithm!==cert.getSignatureAlgorithmName())return false;
  const match=/^SHA(1|256|384|512)with(RSA|ECDSA)$/.exec(algorithm);
  if(!match||key.asymmetricKeyType!==(match[2]==='RSA'?'rsa':'ec'))return false;
  return crypto.verify('sha'+match[1],Buffer.from(ASN1HEX.getTLVbyList(hex,0,[0],'30'),'hex'),key,Buffer.from(cert.getSignatureValueHex(),'hex'));
 }catch{return false;}
}

function unsupported(error:unknown):boolean {
 return error instanceof Error && (error as Error & {code?:string}).code==='ERR_NOT_IMPLEMENTED';
}
export class CompatibleCertificate extends NativeCertificate {
 private readonly der:Buffer;
 constructor(input:Buffer|string){
  super(input);
  this.der=typeof input==='string'&&input.includes('-----BEGIN CERTIFICATE-----')
   ?Buffer.from(input.replace(/-----[^-]+-----|\s/g,''),'base64'):Buffer.from(input);
 }
 private parsed(){const cert=new X509();cert.readCertHex(this.der.toString('hex'));return cert;}
 override get raw():Buffer {return Buffer.from(this.der);}
 override toString():string {return '-----BEGIN CERTIFICATE-----\n'+this.der.toString('base64').match(/.{1,64}/g)!.join('\n')+'\n-----END CERTIFICATE-----\n';}
 override verify(key:KeyObject):boolean {
  try{return super.verify(key);}catch(error){if(!unsupported(error))throw error;}
  return verifyCertificateSignature(this.der,key);
 }
 override get infoAccess():string|undefined {
  try{return super.infoAccess;}catch(error){if(!unsupported(error))throw error;}
  const aia=this.parsed().getExtAIAInfo();
  if(!aia)return undefined;
  return [...(aia.ocsp||[]).map((uri:string)=>'OCSP - URI:'+uri),...(aia.caissuer||[]).map((uri:string)=>'CA Issuers - URI:'+uri)].join('\n');
 }
}
export function installAppleX509Compatibility(root:Buffer):boolean {
 const probe=new NativeCertificate(root);
 // Older Deno reports equivalent curves with Rust names. jsonwebtoken expects
 // OpenSSL's names; normalize the names, never the algorithm or key material.
 let prototype=Object.getPrototypeOf(probe.publicKey);
 while(prototype){
  const descriptor=Object.getOwnPropertyDescriptor(prototype,'asymmetricKeyDetails');
  if(descriptor?.get){
   const get=descriptor.get;
   Object.defineProperty(prototype,'asymmetricKeyDetails',{...descriptor,get(){
    const details=get.call(this);
    const names:Record<string,string>={p256:'prime256v1',p384:'secp384r1',p521:'secp521r1'};
    return details?.namedCurve&&names[details.namedCurve]?{...details,namedCurve:names[details.namedCurve]}:details;
   }});
   break;
  }
  prototype=Object.getPrototypeOf(prototype);
 }
 try{probe.raw;probe.toString();probe.infoAccess;probe.verify(probe.publicKey);return false;}
 catch(error){if(!unsupported(error))throw error;}
 // Apple's CommonJS package reads crypto.X509Certificate at construction time,
 // including for OCSP responder certificates. No verification policy is replaced.
 Object.defineProperty(crypto,'X509Certificate',{value:CompatibleCertificate,writable:true,configurable:true});
 return true;
}
