import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import nodemailer from 'npm:nodemailer@9';
import {createHandler,type Job} from './core.ts';

const site='https://company-day-kr.taehyuna-github.workers.dev';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const username='taehyuna.github@gmail.com';
const configured=()=>Boolean(Deno.env.get('SMTP_PASSWORD'));
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
  reserve:async user=>await rpc('reserve_anniversary_mail',{p_test_user:user}),
  revalidate,
  finish:async(id,status,provider)=>{await rpc('finish_anniversary_mail',{p_id:id,p_status:status,p_provider_id:provider||null})},
  send:async mail=>{
    const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:username,pass:Deno.env.get('SMTP_PASSWORD')!},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
    try{const result=await transport.sendMail({from:{name:'기업의 날',address:username},...mail});if(!result.accepted?.length)throw Error('not accepted');return result.messageId}finally{transport.close()}
  }
});
Deno.serve(async request=>{try{return await handler(request)}catch{return new Response(JSON.stringify({error:'메일 서비스를 잠시 이용할 수 없습니다.'}),{status:503,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':site,'Cache-Control':'no-store'}})}});
