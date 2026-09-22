import assert from 'node:assert/strict';
import worker from '../dist/cloudflare/runtime/worker.js';
const origin='https://companyday.example';
const env={PUBLIC_SITE_URL:origin,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',ASSETS:{fetch:async()=>new Response('missing',{status:404})}};
const request=(path,body={},headers={})=>new Request(origin+'/api/account/email/'+path,{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-session','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const originalFetch=globalThis.fetch;let calls=[];
globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({ok:true})};
try{
  assert.equal((await worker.fetch(request('request',{email:'new@example.com'},{Origin:'https://evil.example'}),env)).status,403);assert.equal(calls.length,0);
  assert.equal((await worker.fetch(request('request',{}, {Authorization:''}),env)).status,401);
  assert.equal((await worker.fetch(request('dispatch'),env)).status,404);
  assert.equal((await worker.fetch(request('request',{email:'x'.repeat(4100)}),env)).status,413);assert.equal(calls.length,0);
  assert.equal((await worker.fetch(request('request',{email:'new@example.com'}),env)).status,200);
  assert.equal(calls[0].url,'https://example.supabase.co/functions/v1/anniversary-mail/email/request');
  assert.equal(calls[0].init.headers.Authorization,'Bearer test-session');
  assert.equal(calls[0].init.headers.Origin,origin);
  assert.equal(calls[0].init.redirect,'error');
  assert.equal((await worker.fetch(request('confirm',{token:'a'.repeat(64)}),env)).status,200);
  globalThis.fetch=async()=>Response.json({error:'invalid token'},{status:401});assert.equal((await worker.fetch(request('confirm'),env)).status,401);
  globalThis.fetch=async()=>{throw Error('timeout')};const ambiguous=await worker.fetch(request('request',{email:'new@example.com'}),env);assert.equal(ambiguous.status,502);assert.match((await ambiguous.json()).error,/자동으로 재발송하지/);
  console.log('PASS: account proxy origin/auth/size/route guards, forwards JWT, rejects redirects, preserves errors and never retries.');
}finally{globalThis.fetch=originalFetch}
