// Public client ID; no client secret belongs in this service or the browser.
export const CLIENT_ID='1035477969437-7od1opi45qps8nhmhp5tmo3sre496rui.apps.googleusercontent.com';
const ORIGIN='https://taehyuna-git.github.io';
let keyCache;
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verify(token,fetchKeys=fetch,now=Date.now()/1000){
  if(typeof token!=='string'||token.length>12000)throw Error('Invalid token');
  const parts=token.split('.'); if(parts.length!==3)throw Error('Invalid token');
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Invalid algorithm');
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==CLIENT_ID||(claims.azp&&claims.azp!==CLIENT_ID))throw Error('Invalid audience');
  if(typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+60||(claims.nbf&&claims.nbf>now+60))throw Error('Expired token');
  if(typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string')throw Error('Invalid identity');
  if(!keyCache||keyCache.until<now){
    const r=await fetchKeys('https://www.googleapis.com/oauth2/v3/certs');
    if(!r.ok)throw Error('Keys unavailable');
    keyCache={keys:(await r.json()).keys,until:now+300};
  }
  const jwk=keyCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig');
  if(!jwk)throw Error('Unknown key');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Invalid signature');
  return {id:'google:'+claims.sub,name:typeof claims.name==='string'?claims.name.slice(0,120):claims.email,email:claims.email,provider:'Google',expiresAt:claims.exp};
}
export default {async fetch(request){
  const origin=request.headers.get('Origin');
  const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(origin===ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization','Access-Control-Max-Age':'600'});
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&origin!==ORIGIN)return json({error:'Origin not allowed'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(new URL(request.url).pathname!=='/api/session')return json({error:'Not found'},404);
  const authorization=request.headers.get('Authorization');
  if(!authorization)return json({user:null,providers:{google:true,kakao:false,chatgpt:false}});
  if(!authorization.startsWith('Bearer '))return json({error:'Unauthorized'},401);
  try{return json({user:await verify(authorization.slice(7)),providers:{google:true,kakao:false,chatgpt:false}})}catch{return json({error:'Unauthorized'},401)}
}};
