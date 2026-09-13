import {createClient} from '@supabase/supabase-js';
export interface AccountEnv {PUBLIC_SITE_URL?:string;SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;SUPABASE_SECRET_KEY?:string;MAIL_ENABLED?:string;RESEND_API_KEY?:string;MAIL_FROM?:string}
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('')}
export function validRecipient(value:unknown):value is string{return typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)}
export async function accountApi(request:Request,env:AccountEnv):Promise<Response>{
  const url=new URL(request.url);
  if(request.method!=='POST')return response({error:'POST 요청이 필요합니다.'},405);
  if(!env.PUBLIC_SITE_URL||request.headers.get('Origin')!==env.PUBLIC_SITE_URL||url.origin!==env.PUBLIC_SITE_URL)return response({error:'허용되지 않은 요청입니다.'},403);
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.SUPABASE_SECRET_KEY)return response({error:'계정 서비스 연결 준비 중입니다.'},503);
  if(!['/api/account/email/request','/api/account/email/confirm'].includes(url.pathname))return response({error:'주소를 찾을 수 없습니다.'},404);
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer ')||authorization.length>16000)return response({error:'로그인이 필요합니다.'},401);
  // Verify identity with Auth. Never authorize from browser-supplied user_id or JWT decoding alone.
  const auth=createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.getUser(authorization.slice(7));
  if(error||!data.user?.email_confirmed_at)return response({error:'이메일 인증 후 다시 로그인해 주세요.'},401);
  let body:{email?:unknown;token?:unknown};
  try{if(Number(request.headers.get('Content-Length'))>4096)return response({error:'요청이 너무 큽니다.'},413);const text=await request.text();if(text.length>4096)return response({error:'요청이 너무 큽니다.'},413);body=JSON.parse(text);if(!body||typeof body!=='object')throw Error()}catch{return response({error:'입력 값을 확인해 주세요.'},400)}
  const admin=createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const userId=data.user.id;
  if(url.pathname.endsWith('/confirm')){
    if(typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token))return response({error:'인증 링크가 올바르지 않습니다.'},400);
    const result=await admin.rpc('confirm_notification_email',{p_user_id:userId,p_token_hash:await hashToken(body.token)});
    return result.error?response({error:'인증 링크가 만료되었거나 이미 사용되었습니다.'},400):response({ok:true});
  }
  if(env.MAIL_ENABLED!=='true'||!env.RESEND_API_KEY||!env.MAIL_FROM)return response({error:'이메일 발송 연결 준비 중입니다. 기존 수신 주소는 유지됩니다.'},503);
  const email=typeof body.email==='string'?body.email.trim():body.email;if(!validRecipient(email))return response({error:'올바른 이메일 주소를 입력해 주세요.'},400);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  const id=crypto.randomUUID();
  const reserved=await admin.rpc('request_notification_email',{p_user_id:userId,p_email:email,p_token_hash:await hashToken(token),p_request_id:id});
  if(reserved.error){const limited=/cooldown|user_daily_limit|daily_budget|monthly_budget/.test(reserved.error.message);return response({error:limited?'재발송 대기 시간 또는 무료 발송 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.':'이메일 인증 요청을 저장하지 못했습니다.'},limited?429:503)}
  const link=new URL('/',env.PUBLIC_SITE_URL);link.hash='verify-email='+token;
  try{
    const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'[기업의 날] 알림 이메일 주소를 확인해 주세요',text:`알림을 받을 이메일 변경을 요청하셨습니다.\n\n아래 링크에서 요청한 계정으로 로그인하고 인증 완료를 눌러 주세요. 링크는 30분간 유효합니다.\n${link}\n\n직접 요청하지 않았다면 이 메일을 무시해 주세요. 기존 수신 주소는 변경되지 않습니다.`}),signal:AbortSignal.timeout(10000)});
    if(!sent.ok)throw Error('Mail rejected');const mail=await sent.json() as {id?:string};
    await admin.from('email_delivery_logs').update({status:'sent',provider_id:mail.id??null}).eq('id',id);return response({ok:true});
  }catch{await admin.from('email_delivery_logs').update({status:'failed'}).eq('id',id);return response({error:'발송 결과를 확인하지 못했습니다. 받은 편지함을 확인한 후 다시 시도해 주세요.'},502)}
}
