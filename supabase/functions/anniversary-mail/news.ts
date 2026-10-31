import type {Mail} from './core.ts';
export type NewsItem={companyId:string;company:string;title:string;url:string;source:string;publishedAt:string;fingerprint:string;important:boolean;reason:string};
export type NewsJob={id:string;user_id:string;recipient:string;payload:{date:string;items:NewsItem[]}};
const newsEscape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function newsImportance(title:string):string{
  const rules:[RegExp,string][]=[[/대표이사.{0,15}(선임|교체|사임|해임)|CEO.{0,15}(교체|선임|사임)|신임\s*(대표|CEO)/i,'대표이사 변경'],[/(인수|합병|M&A|공개매수)/i,'인수·합병'],[/(상장폐지|거래정지|회생절차|법정관리|파산)/,'주요 경영 변화'],[/(유상증자|분할|대규모.{0,10}(투자|계약|수주|공시)|조\s*원.{0,10}(투자|계약|수주))/,'투자·공시 관련']];
  return rules.find(([pattern])=>pattern.test(title))?.[1]||'';
}
export async function normalizeNews(companyId:string,company:string,raw:unknown,now=Date.now()):Promise<NewsItem[]>{
  if(!Array.isArray(raw))return [];
  const out:NewsItem[]=[],seen=new Set<string>();
  for(const input of raw.slice(0,10)){
    if(!input||typeof input!=='object')continue;
    const a=input as Record<string,unknown>;
    if(typeof a.title!=='string'||typeof a.url!=='string'||typeof a.publishedAt!=='string')continue;
    const title=a.title.replace(/<[^>]*>/g,'').trim().slice(0,300),time=Date.parse(a.publishedAt);
    const compact=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    if(!title||!compact(title).includes(compact(company))||!Number.isFinite(time)||time>now+300000||time<now-72*3600000)continue;
    let url:URL;try{url=new URL(a.url)}catch{continue}
    if(url.protocol!=='https:'||url.hostname!=='news.google.com'||url.username||url.password)continue;
    const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(compact(title))))).map(n=>n.toString(16).padStart(2,'0')).join('');
    if(seen.has(fingerprint))continue;seen.add(fingerprint);
    const reason=newsImportance(title);
    out.push({companyId,company:company.slice(0,100),title,url:url.href,source:typeof a.source==='string'?a.source.replace(/<[^>]*>/g,'').slice(0,100):'',publishedAt:new Date(time).toISOString(),fingerprint,important:Boolean(reason),reason});
  }
  return out.sort((a,b)=>Number(b.important)-Number(a.important)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,3);
}
export function makeNewsMessage(job:NewsJob,site:string):Mail{
  const important=job.payload.items.some(i=>i.important);
  const subject=`${important?'[중요 후보] ':''}[기업의 날] 관심 기업 뉴스 ${job.payload.items.length}건`;
  const intro='저장한 기업의 최근 72시간 뉴스 중 아직 보내지 않은 소식을 모았습니다.';
  const note='중요 후보는 기사 제목의 키워드로 분류합니다. AI 요약이나 사실 검증 결과가 아니므로 원문을 확인해 주세요.';
  const text=[intro,...job.payload.items.map(i=>`${i.important?'[중요 후보 · '+i.reason+'] ':''}${i.company}\n${i.title}\n${i.source} · ${i.publishedAt.slice(0,10)}\n${i.url}`),note,`수신 설정 변경·중지: ${site}/?account=notifications`].join('\n\n');
  const html=`<div style="max-width:640px;margin:auto;padding:24px;background:#fafaf6;color:#344b40;font-family:Arial,sans-serif;line-height:1.7"><h1 style="font-size:22px">오늘의 관심 기업 소식</h1><p>${intro}</p>${job.payload.items.map(i=>`<div style="padding:18px;margin:14px 0;border-radius:14px;background:${i.important?'#fff0ee':'#edf4e9'}">${i.important?`<strong style="color:#a83f35">중요 후보 · ${newsEscape(i.reason)}</strong><br>`:''}<small>${newsEscape(i.company)}</small><h2 style="font-size:17px;margin:8px 0"><a style="color:#344b40" href="${newsEscape(i.url)}">${newsEscape(i.title)}</a></h2><small>${newsEscape(i.source)} · ${new Date(i.publishedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</small><br><a href="${newsEscape(i.url)}">기사 원문 보기 ↗</a></div>`).join('')}<p style="font-size:12px">${note}</p><p style="font-size:12px">최대 15건 · 원문 링크 제공 · Google 뉴스 피드<br><a href="${site}/?account=notifications">뉴스 이메일 설정·수신 중지</a></p></div>`;
  return {to:job.recipient,subject,text,html,messageId:`<${job.id}@companyday.news>`};
}
type NewsDeps={site:string;configured:()=>boolean;enabled:()=>Promise<boolean>;verifyUser:(token:string)=>Promise<string|null>;verifyScheduler:(token:string)=>Promise<boolean>;collect:(user:string|null)=>Promise<void>;preview:(user:string)=>Promise<unknown>;reserve:()=>Promise<NewsJob|null>;revalidate:(job:NewsJob)=>Promise<NewsJob|null>;send:(mail:Mail)=>Promise<string>;finish:(id:string,status:string,provider?:string)=>Promise<void>};
export function createNewsHandler(d:NewsDeps){return async(request:Request)=>{
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':d.site,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method==='GET')return reply({configured:d.configured(),enabled:d.configured()&&await d.enabled()});
 if(request.method!=='POST')return reply({error:'POST 요청이 필요합니다.'},405);
 let action:string;try{const raw=await request.text();if(raw.length>2048)return reply({error:'요청이 너무 큽니다.'},413);action=JSON.parse(raw)?.action}catch{return reply({error:'잘못된 요청입니다.'},400)}
 let user:string|null=null;
 if(action==='preview'){
  if(request.headers.get('Origin')!==d.site)return reply({error:'허용되지 않은 요청입니다.'},403);
  const auth=request.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer ')||auth.length>16000)return reply({error:'로그인이 필요합니다.'},401);
  user=await d.verifyUser(auth.slice(7));if(!user)return reply({error:'다시 로그인해 주세요.'},401);
 }else if(action==='dispatch'){
  const token=request.headers.get('x-job-token')||'';
  if(token.length!==72||!await d.verifyScheduler(token))return reply({error:'허용되지 않은 요청입니다.'},401);
 }else return reply({error:'지원하지 않는 요청입니다.'},400);
 if(!await d.enabled())return reply({error:'뉴스 서비스를 잠시 점검하고 있습니다.'},503);
 const started=Date.now();
 try{
  await d.collect(user);
  if(user)return reply(await d.preview(user)); // Preview never reserves mail or calls SMTP.
  if(!d.configured())return reply({error:'메일 발송 서버 연결이 필요합니다.'},503);
  let processed=0;
  for(let n=0;n<3&&Date.now()-started<40000;n++){
   const reserved=await d.reserve();if(!reserved)break;
   const job=await d.revalidate(reserved);
   if(!job){await d.finish(reserved.id,'skipped');continue}
   let provider:string;
   try{provider=await d.send(makeNewsMessage(job,d.site))}catch(e){await d.finish(job.id,(e as {code?:string})?.code==='EAUTH'?'failed':'uncertain');continue}
   await d.finish(job.id,'sent',provider);processed++;
  }
  return reply({processed});
 }catch(e){if(/daily_budget|monthly_budget/.test(e instanceof Error?e.message:''))return reply({processed:0,limited:true});return reply({error:'뉴스를 준비하지 못했습니다. 잠시 후 다시 확인해 주세요.'},503)}
};}
