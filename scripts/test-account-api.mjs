import assert from 'node:assert/strict';
import worker from '../dist/cloudflare/runtime/worker.js';
const origin='https://companyday.example';
const env={PUBLIC_SITE_URL:origin,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'sb_secret_test',MAIL_ENABLED:'false',ASSETS:{fetch:async()=>new Response('missing',{status:404})}};
const request=(path,body={},headers={})=>new Request(origin+'/api/account/email/'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-session','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;let calls=[];
globalThis.fetch=async(input,init)=>{
  const url=String(input);calls.push({url,body:init?.body});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'00000000-0000-4000-8000-000000000001',email:'owner@example.com',email_confirmed_at:'2026-09-10T00:00:00Z'});
  if(url.endsWith('/rest/v1/rpc/confirm_notification_email'))return new Response(null,{status:204});
  throw Error('Unexpected external request: '+url);
};
try{
  assert.equal((await worker.fetch(request('request',{email:'new@example.com'},{Origin:'https://evil.example'}),env)).status,403);assert.equal(calls.length,0);
  assert.equal((await worker.fetch(request('request',{}, {Authorization:''}),env)).status,401);assert.equal(calls.length,0);
  assert.equal((await worker.fetch(request('request',{email:'new@example.com'}),env)).status,503);assert.equal(calls.length,1);
  assert.equal((await worker.fetch(request('confirm',{token:'invalid'}),env)).status,400);
  const r=await worker.fetch(request('confirm',{token:'a'.repeat(64),user_id:'attacker'}),env);assert.equal(r.status,200);
  const rpc=JSON.parse(calls.find(c=>c.url.includes('/rpc/')).body);assert.equal(rpc.p_user_id,'00000000-0000-4000-8000-000000000001');assert.equal(rpc.p_token_hash.length,64);assert.notEqual(rpc.p_token_hash,'a'.repeat(64));
  globalThis.fetch=async()=>Response.json({message:'Invalid JWT'},{status:401});assert.equal((await worker.fetch(request('confirm',{token:'a'.repeat(64)}),env)).status,401);
  console.log('PASS: cross-origin rejected before Auth, credentials required, mail disabled by default, server-verified user, token hashing and invalid JWT rejection.');
}finally{globalThis.fetch=originalFetch}
