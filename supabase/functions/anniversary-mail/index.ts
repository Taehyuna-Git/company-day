import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import nodemailer from 'npm:nodemailer@9';
import {createHandler,type Job,type Mail} from './core.ts';
import {createVerificationHandler} from './verification.ts';

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
const verifyUser=async(token:string)=>{const {data,error}=await admin.auth.getUser(token);return !error&&data.user?.email_confirmed_at?data.user.id:null};
const send=async(mail:Mail)=>{
  const client=transport();
  try{const result=await client.sendMail({from:{name:'기업의 날',address:username},...mail});if(!result.accepted?.length)throw Error('not accepted');return result.messageId}catch(error){console.error('SMTP delivery failure',smtpDiagnostic(error));throw error}finally{client.close()}
};
const verificationHandler=createVerificationHandler({site,configured,verifyUser,send,
  reserve:async(user,email,hash,id)=>{await rpc('request_notification_email',{p_user_id:user,p_email:email,p_token_hash:hash,p_request_id:id})},
  confirm:async hash=>await rpc('confirm_notification_email_link',{p_token_hash:hash}),
  cancel:async user=>{await rpc('cancel_notification_email',{p_user_id:user})},
  finish:async(id,status,provider)=>{const {error}=await admin.from('email_delivery_logs').update({status,provider_id:provider||null}).eq('id',id);if(error)throw Error('delivery log')}
});
const handler=createHandler({site,configured,enabled,verifyUser,send,
  verifyScheduler:async token=>Boolean(await rpc('check_anniversary_scheduler',{p_token:token})),
  checkSmtp:async()=>{const client=transport();try{await client.verify();return {ok:true}}catch(error){return {ok:false,...smtpDiagnostic(error)}}finally{client.close()}},
  reserve:async user=>await rpc('reserve_anniversary_mail',{p_test_user:user}),
  revalidate,
  finish:async(id,status,provider)=>{await rpc('finish_anniversary_mail',{p_id:id,p_status:status,p_provider_id:provider||null})}
});
Deno.serve(async request=>{try{return await (new URL(request.url).pathname.includes('/email/')?verificationHandler:handler)(request)}catch{return new Response(JSON.stringify({error:'메일 서비스를 잠시 이용할 수 없습니다.'}),{status:503,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':site,'Cache-Control':'no-store'}})}});
