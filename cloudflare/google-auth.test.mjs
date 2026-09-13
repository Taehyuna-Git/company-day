import assert from 'node:assert/strict';
import worker,{verify,CLIENT_ID} from './google-auth.mjs';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-key',use:'sig'};
const now=Date.now()/1000;
const base={iss:'https://accounts.google.com',aud:CLIENT_ID,sub:'123',email:'test@example.com',email_verified:true,iat:now,exp:now+3600,name:'Test'};
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(claims=base){const data=enc({alg:'RS256',kid:'test-key'})+'.'+enc(claims);return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(data))).toString('base64url')}
const fetchKeys=async()=>Response.json({keys:[jwk]});
assert.equal((await verify(await token(),fetchKeys)).id,'google:123');
for(const changes of [{aud:'other-app'},{iss:'https://attacker.example'},{exp:now-10},{email_verified:false},{sub:''},{iat:now+500},{azp:'other-app'}])await assert.rejects(()=>token({...base,...changes}).then(t=>verify(t,fetchKeys)));
const good=await token();await assert.rejects(()=>verify(good.slice(0,-8)+'AAAAAAAA',fetchKeys));
assert.equal((await worker.fetch(new Request('https://test/api/session',{headers:{Origin:'https://evil.example'}}))).status,403);
assert.equal((await worker.fetch(new Request('https://test/api/session',{headers:{Authorization:'Bearer fake'}}))).status,401);
assert.equal((await worker.fetch(new Request('https://test/api/session',{method:'POST'}))).status,405);
const anonymous=await worker.fetch(new Request('https://test/api/session',{headers:{Origin:'https://taehyuna-git.github.io'}}));assert.equal(anonymous.headers.get('Access-Control-Allow-Origin'),'https://taehyuna-git.github.io');assert.equal((await anonymous.json()).user,null);
console.log('PASS: signed Google identity, invalid audience/issuer/expiry/signature/identity, CORS and anonymous session.');
