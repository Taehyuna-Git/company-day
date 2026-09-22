import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function module(file){const code=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))}
const {createVerificationHandler,hashToken}=await module('supabase/functions/anniversary-mail/verification.ts');
const site='https://companyday.example',uid='owner';
let reserves=[],mails=[],finishes=[],confirms=[],failure='',configured=true,verified=true;
const handler=createVerificationHandler({site,configured:()=>configured,verifyUser:async t=>t==='session'&&verified?uid:null,
  reserve:async(...args)=>{if(failure==='cooldown')throw Error('cooldown');reserves.push(args)},
  confirm:async(...args)=>{if(failure==='expired')throw Error('invalid_or_expired_token');confirms.push(args)},
  finish:async(...args)=>{if(failure==='log')throw Error('log unavailable');finishes.push(args)},
  send:async mail=>{mails.push(mail);if(failure==='smtp')throw Error('lost ack');if(failure==='auth')throw Object.assign(Error(),{code:'EAUTH'});return 'provider'}
});
const req=(action,body={},extra={})=>new Request(site+'/functions/v1/anniversary-mail/email/'+action,{method:'POST',headers:{Origin:site,Authorization:'Bearer session','Content-Type':'application/json',...extra},body:JSON.stringify(body)});
assert.equal((await handler(req('request',{email:'new@example.com'},{Origin:'https://evil.example'}))).status,403);
assert.equal((await handler(req('request',{}, {Authorization:''}))).status,401);
verified=false;assert.equal((await handler(req('request'))).status,401);verified=true;
assert.equal((await handler(new Request(site+'/email/confirm'))).status,405);
for(const email of ['bad','a@example.com,b@example.com','a@example.com\r\nBcc: b@example.com','"<x>"@example.com'])assert.equal((await handler(req('request',{email}))).status,400);
assert.equal((await handler(req('request',{email:'x'.repeat(5000)}))).status,413);
assert.equal(reserves.length,0);assert.equal(mails.length,0);
configured=false;assert.equal((await handler(req('request',{email:'new@example.com'}))).status,503);configured=true;
assert.equal((await handler(req('request',{email:' new@example.com ',user_id:'intruder',return_to:'https://evil.example'}))).status,200);
assert.equal(reserves[0][0],uid);assert.equal(reserves[0][1],'new@example.com');assert.equal(mails[0].to,'new@example.com');
const link=new URL(mails[0].text.match(/https:\/\/\S+/)[0]),token=new URLSearchParams(link.hash.slice(1)).get('verify-email');
assert.equal(link.origin,site);assert.match(token,/^[a-f0-9]{64}$/);assert.equal(reserves[0][2],await hashToken(token));assert.notEqual(reserves[0][2],token);
assert.equal(finishes[0][1],'sent');assert.equal(confirms.length,0,'opening/sending link must not change recipient');
assert.equal((await handler(req('confirm',{token,user_id:'intruder'}))).status,200);assert.deepEqual(confirms[0],[uid,await hashToken(token)]);
failure='expired';assert.equal((await handler(req('confirm',{token}))).status,400);
failure='cooldown';const count=mails.length;assert.equal((await handler(req('request',{email:'new@example.com'}))).status,429);assert.equal(mails.length,count);
failure='auth';assert.equal((await handler(req('request',{email:'new@example.com'}))).status,502);assert.equal(finishes.at(-1)[1],'failed');
failure='smtp';const completed=finishes.length;assert.equal((await handler(req('request',{email:'new@example.com'}))).status,502);assert.equal(finishes.length,completed,'ambiguous send stays reserved');
failure='log';assert.equal((await handler(req('request',{email:'new@example.com'}))).status,200,'SMTP accepted despite logging failure');
const {pendingEmailToken,clearEmailToken}=await module('lib/email-verification.ts');
const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
assert.equal(pendingEmailToken(storage,'#verify-email='+token,100),token);
assert.equal(pendingEmailToken(storage,'#access_token=oauth-callback',101),token,'OAuth callback preserves pending verification');
assert.equal(pendingEmailToken(storage,'',1800100),'','local link expires');
pendingEmailToken(storage,'#verify-email='+token,200);clearEmailToken(storage);assert.equal(pendingEmailToken(storage,'',201),'');
console.log('PASS: recipient/auth/origin validation, hashed one-time links, limits, SMTP ambiguity, no retries, OAuth token persistence and clearing.');
