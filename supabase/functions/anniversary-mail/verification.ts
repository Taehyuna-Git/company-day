import type {Mail} from './core';
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('')}
export function validRecipient(value:unknown):value is string{return typeof value==='string'&&value.length<=254&&/^[^\s@<>,;"\\]+@[^\s@<>,;"\\]+\.[^\s@<>,;"\\]+$/.test(value)}
type VerificationDeps={site:string;configured:()=>boolean;verifyUser:(token:string)=>Promise<string|null>;reserve:(user:string,email:string,hash:string,id:string)=>Promise<void>;confirm:(hash:string)=>Promise<'verified'|'already_verified'|'expired'|'invalid'>;cancel:(user:string)=>Promise<void>;finish:(id:string,status:'sent'|'failed',provider?:string)=>Promise<void>;send:(mail:Mail)=>Promise<string>};
export function createVerificationHandler(d:VerificationDeps){return async(request:Request)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Access-Control-Allow-Origin':d.site,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
  const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'POST 요청이 필요합니다.'},405);
  if(request.headers.get('Origin')!==d.site)return reply({error:'허용되지 않은 요청입니다.'},403);
  const action=new URL(request.url).pathname.split('/').pop();
  if(!['request','confirm','cancel'].includes(action||''))return reply({error:'주소를 찾을 수 없습니다.'},404);
  let body:{email?:unknown;token?:unknown};
  try{const raw=await request.text();if(raw.length>4096)return reply({error:'요청이 너무 큽니다.'},413);body=JSON.parse(raw);if(!body||typeof body!=='object')throw Error()}catch{return reply({error:'입력 값을 확인해 주세요.'},400)}
  if(action==='confirm'){
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return reply({error:'인증 링크가 올바르지 않습니다.'},400);
    try{const status=await d.confirm(await hashToken(body.token));return reply({ok:status==='verified'||status==='already_verified',status},status==='expired'?410:status==='invalid'?400:200)}
    catch{return reply({error:'연결이 잠시 원활하지 않아요. 다시 확인을 눌러 주세요.'},503)}
  }
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>16000)return reply({error:'로그인이 필요합니다.'},401);
  const user=await d.verifyUser(auth.slice(7));
  if(!user)return reply({error:'인증된 계정으로 다시 로그인해 주세요.'},401);
  if(action==='cancel'){await d.cancel(user);return reply({ok:true})}
  const email=typeof body.email==='string'?body.email.trim():body.email;
  if(!validRecipient(email))return reply({error:'올바른 이메일 주소를 입력해 주세요.'},400);
  if(!d.configured())return reply({error:'메일 발송 서버 연결을 확인 중입니다. 기존 알림 이메일은 유지됩니다.'},503);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID();
  try{await d.reserve(user,email,await hashToken(token),id)}
  catch(error){const limited=/cooldown|user_daily_limit|daily_budget|monthly_budget/.test(String(error));return reply({error:limited?'인증 메일은 1분 간격, 하루 최대 5번 요청할 수 있어요. 발송 한도에 도달했다면 나중에 다시 이용해 주세요.':'인증 요청을 저장하지 못했습니다. 기존 알림 이메일은 유지됩니다.'},limited?429:503)}
  const link=new URL('/',d.site);link.searchParams.set('account','verify-email');link.hash='verify-email='+token;
  const intro='알림을 받을 이메일 변경을 요청하셨습니다. 아래 버튼을 누르면 로그인 없이 이 이메일의 인증이 완료됩니다.';
  const footer='링크는 30분 동안 한 번만 사용할 수 있습니다. 새 인증 메일을 요청하면 이전 링크는 사용할 수 없습니다. 인증 전까지 기존 알림 이메일은 유지됩니다. 직접 요청하지 않았다면 이 메일을 무시해 주세요.';
  let provider:string;
  try{provider=await d.send({to:email,subject:'[기업의 날] 알림 이메일 주소를 확인해 주세요',messageId:`<${id}@companyday.mail>`,text:`${intro}\n\n${link.href}\n\n${footer}`,html:`<div style="max-width:580px;margin:auto;padding:28px;background:#fafaf6;color:#344b40;font-family:Arial,sans-serif;line-height:1.8"><h1 style="font-size:22px">알림 이메일 확인</h1><p>${intro}</p><p><a href="${link.href}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#dceadc;color:#294634">알림 이메일 인증하기</a></p><p style="font-size:13px">${footer}</p></div>`})}
  catch(error){
    if((error as {code?:string})?.code==='EAUTH'){await d.finish(id,'failed');return reply({error:'발송 계정 연결 문제로 메일을 보내지 못했습니다. 기존 알림 이메일은 유지됩니다.'},502)}
    // Keep the reservation after an ambiguous SMTP response. Never retry automatically.
    return reply({error:'메일 발송 결과를 확인하지 못했습니다. 받은 편지함과 스팸함을 먼저 확인해 주세요. 기존 알림 이메일은 유지됩니다.'},502);
  }
  // SMTP acceptance is definitive even if recording its acknowledgement fails.
  try{await d.finish(id,'sent',provider)}catch{}
  return reply({ok:true});
}}
