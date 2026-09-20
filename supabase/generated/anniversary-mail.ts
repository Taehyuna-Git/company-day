export type Item={id:string;name:string;date:string;days:number;age:number};
export type Job={id:string;user_id:string;recipient:string;kind:'test'|'anniversary';payload:{date:string;items:Item[]}};
export type Mail={to:string;subject:string;text:string;html:string;messageId:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function makeMessage(job:Job,site:string):Mail{
  const test=job.kind==='test',items=job.payload.items;
  const title=test?'[기업의 날] 테스트 메일입니다':`[기업의 날] ${items.length}개 기업의 다가오는 창립기념일`;
  const intro=test?'이 메일이 도착했다면 기념일 알림을 받을 준비가 되었습니다. 아래는 저장한 기업 중 공식 기념일이 확인된 기업입니다.':'설정하신 D-Day에 해당하는 기업들의 창립기념일을 알려드립니다.';
  const lines=items.map(i=>`${i.name} · ${i.date} · ${i.age}주년 · ${i.days===0?'오늘':i.days+'일 후'}\n${site}/companies/${encodeURIComponent(i.id)}`);
  const empty='공식 창립기념일이 확인된 저장 기업이 아직 없어도 테스트 메일은 받을 수 있습니다.';
  const footer=`알림 설정 변경·중지: ${site}/?account=notifications\n공식 창립기념일 기준이며, 한국 시간으로 발송합니다.`;
  return {to:job.recipient,subject:title,messageId:`<${job.id}@companyday.mail>`,
    text:[intro,...(lines.length?lines:[empty]),footer].join('\n\n'),
    html:`<div style="max-width:620px;margin:auto;padding:24px;background:#fafaf6;color:#344b40;font-family:Arial,sans-serif;line-height:1.7"><h1 style="font-size:22px">기업의 날</h1><p>${escape(intro)}</p>${items.length?items.map(i=>`<div style="padding:16px;margin:12px 0;border-radius:12px;background:${i.age>0&&i.age%5===0?'#fff0cf':'#edf4e9'}"><strong>${escape(i.name)}</strong> · ${i.age}주년${i.age>0&&i.age%5===0?' 🎉':''}<br>${escape(i.date)} · <b>${i.days===0?'D-DAY':'D-'+i.days}</b><br><a href="${site}/companies/${encodeURIComponent(i.id)}">기업 정보 보기</a></div>`).join(''):`<p>${empty}</p>`}<p style="font-size:12px"><a href="${site}/?account=notifications">알림 설정 변경·중지</a><br>공식 창립기념일 기준 · 한국 시간</p></div>`};
}
type Deps={site:string;configured:()=>boolean;enabled:()=>Promise<boolean>;verifyUser:(token:string)=>Promise<string|null>;verifyScheduler:(token:string)=>Promise<boolean>;checkSmtp?:()=>Promise<unknown>;reserve:(user:string|null)=>Promise<Job|null>;revalidate:(job:Job)=>Promise<Job|null>;finish:(id:string,status:string,provider?:string)=>Promise<void>;send:(mail:Mail)=>Promise<string>};
export function createHandler(d:Deps){
  return async(request:Request)=>{
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':d.site,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin'};
    const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method==='GET'){let enabled=false;try{enabled=await d.enabled()}catch{}return reply({configured:d.configured(),enabled:d.configured()&&enabled})}
    if(request.method!=='POST')return reply({error:'POST 요청이 필요합니다.'},405);
    let action:string;
    try{const raw=await request.text();if(raw.length>2048)return reply({error:'요청이 너무 큽니다.'},413);action=JSON.parse(raw)?.action}catch{return reply({error:'잘못된 요청입니다.'},400)}
    let user:string|null=null;
    if(action==='test'){
      if(request.headers.get('Origin')!==d.site)return reply({error:'허용되지 않은 요청입니다.'},403);
      const auth=request.headers.get('Authorization')||'';
      if(!auth.startsWith('Bearer ')||auth.length>16000)return reply({error:'로그인이 필요합니다.'},401);
      user=await d.verifyUser(auth.slice(7));if(!user)return reply({error:'인증된 계정으로 로그인해 주세요.'},401);
    }else if(action==='dispatch'||action==='check-smtp'){
      const token=request.headers.get('x-job-token')||'';
      if(token.length!==72||!await d.verifyScheduler(token))return reply({error:'허용되지 않은 요청입니다.'},401);
    }else return reply({error:'지원하지 않는 요청입니다.'},400);
    if(!d.configured())return reply({error:'메일 발송 서버 연결을 마무리하고 있습니다.'},503);
    // Operator-only connectivity check. Does not reserve a job or send an email.
    if(action==='check-smtp')return d.checkSmtp?reply(await d.checkSmtp()):reply({error:'연결 확인을 사용할 수 없습니다.'},503);
    if(action==='dispatch'&&!await d.enabled())return reply({processed:0});
    let processed=0;const started=Date.now();
    try{
      for(let n=0;n<(user?1:10)&&Date.now()-started<45000;n++){
        const reserved=await d.reserve(user);if(!reserved)break;
        const job=await d.revalidate(reserved);
        if(!job){await d.finish(reserved.id,'skipped');if(user)return reply({error:'수신 주소나 설정이 변경되어 발송을 취소했습니다. 새로고침 후 다시 시도해 주세요.'},409);continue}
        let provider:string;
        try{provider=await d.send(makeMessage(job,d.site))}
        catch(error){
          // SMTP authentication fails before Gmail can accept any message.
          const authFailed=(error as {code?:string})?.code==='EAUTH';
          await d.finish(job.id,authFailed?'failed':'uncertain');
          if(user)return reply({error:authFailed?'메일 발송 계정 연결에 문제가 있어 보내지 못했습니다. 관리자가 연결을 확인한 뒤 다시 이용해 주세요.':'발송 결과를 확인하지 못했습니다. 받은 편지함과 스팸함을 확인해 주세요.'},502);
          continue;
        }
        // Never resend an already reserved job, even if acknowledgement is lost.
        await d.finish(job.id,'sent',provider);processed++;
      }
      return reply(user?{ok:true}:{processed});
    }catch(error){
      const message=error instanceof Error?error.message:'';
      if(/cooldown|test_daily_limit/.test(message))return reply({error:'테스트 메일은 1분 간격, 하루 최대 3번 받을 수 있어요.'},429);
      if(/daily_budget|monthly_budget/.test(message))return reply({error:'무료 발송 한도에 도달했습니다. 다음 한도 갱신 후 다시 이용해 주세요.'},429);
      if(/verified_recipient_required/.test(message))return reply({error:'인증된 알림 이메일을 먼저 등록해 주세요.'},400);
      return reply({error:'발송 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.'},503);
    }
  };
}

import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import nodemailer from 'npm:nodemailer@9';


const site='https://company-day-kr.taehyuna-github.workers.dev';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const username='taehyuna.github@gmail.com';
const configured=()=>Boolean(Deno.env.get('SMTP_PASSWORD'));
const transport=()=>nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:username,pass:Deno.env.get('SMTP_PASSWORD')!.replace(/\s/g,'')},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
function smtpDiagnostic(error:unknown){
  const e=error as {code?:string;command?:string;responseCode?:number;response?:string};
  return {code:['EAUTH','ESOCKET','ECONNECTION','ETIMEDOUT','EDNS','EENVELOPE','EMESSAGE','ESTREAM'].includes(e?.code||'')?e.code:'UNKNOWN',command:['CONN','AUTH PLAIN','AUTH LOGIN','MAIL FROM','RCPT TO','DATA'].includes(e?.command||'')?e.command:'OTHER',responseCode:Number.isInteger(e?.responseCode)?e.responseCode:null,enhancedCode:typeof e?.response==='string'?e.response.match(/\b[245]\.\d{1,3}\.\d{1,3}\b/)?.[0]||null:null};
}
const rpc=async(name:string,args:Record<string,unknown>={})=>{const {data,error}=await admin.rpc(name,args);if(error)throw Error(error.message);return data};
const enabled=async()=>{const {data,error}=await admin.from('anniversary_mail_settings').select('enabled').eq('id',true).single();if(error)throw Error('settings');return data.enabled};
async function revalidate(job:Job):Promise<Job|null>{
  const [recipient,prefs,follows]=await Promise.all([
    admin.from('notification_emails').select('email').eq('user_id',job.user_id).maybeSingle(),
    admin.from('notification_preferences').select('anniversary_enabled,lead_days,send_hour').eq('user_id',job.user_id).maybeSingle(),
    admin.from('company_follows').select('company_id,anniversary_enabled').eq('user_id',job.user_id)
  ]);
  if(recipient.error||prefs.error||follows.error)throw Error('settings');
  if(recipient.data?.email!==job.recipient)return null;
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  if(job.kind==='anniversary'&&(!prefs.data?.anniversary_enabled||hour<prefs.data.send_hour))return null;
  const items=job.payload.items.filter(i=>follows.data?.some(f=>f.company_id===i.id&&(job.kind==='test'||f.anniversary_enabled))&&(job.kind==='test'||prefs.data?.lead_days.includes(i.days)));
  return job.kind==='anniversary'&&!items.length?null:{...job,payload:{...job.payload,items}};
}
const handler=createHandler({site,configured,enabled,
  verifyUser:async token=>{const {data,error}=await admin.auth.getUser(token);return !error&&data.user?.email_confirmed_at?data.user.id:null},
  verifyScheduler:async token=>Boolean(await rpc('check_anniversary_scheduler',{p_token:token})),
  checkSmtp:async()=>{const client=transport();try{await client.verify();return {ok:true}}catch(error){return {ok:false,...smtpDiagnostic(error)}}finally{client.close()}},
  reserve:async user=>await rpc('reserve_anniversary_mail',{p_test_user:user}),
  revalidate,
  finish:async(id,status,provider)=>{await rpc('finish_anniversary_mail',{p_id:id,p_status:status,p_provider_id:provider||null})},
  send:async mail=>{
    const client=transport();
    try{const result=await client.sendMail({from:{name:'기업의 날',address:username},...mail});if(!result.accepted?.length)throw Error('not accepted');return result.messageId}catch(error){console.error('SMTP delivery failure',smtpDiagnostic(error));throw error}finally{client.close()}
  }
});
Deno.serve(async request=>{try{return await handler(request)}catch{return new Response(JSON.stringify({error:'메일 서비스를 잠시 이용할 수 없습니다.'}),{status:503,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':site,'Cache-Control':'no-store'}})}});
