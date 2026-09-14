'use client';
import {useEffect,useState} from 'react';
import {useAccount} from './email-account';
import {accountConfig} from '../lib/account-config';
import {getAccountClient} from '../lib/supabase-client';
export function MailDelivery(){
  const {user,session}=useAccount();
  const [state,setState]=useState<{configured:boolean;enabled:boolean}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[last,setLast]=useState<{status:string;created_at:string}|null>(null);
  const endpoint=accountConfig.url+'/functions/v1/anniversary-mail';
  async function history(){const client=getAccountClient();if(!client||!user)return;const {data}=await client.from('anniversary_mail_jobs').select('status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle();setLast(data)}
  useEffect(()=>{const controller=new AbortController();setState(null);setLast(null);fetch(endpoint,{headers:{apikey:accountConfig.key},signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{configured:boolean;enabled:boolean}>}).then(data=>{if(!controller.signal.aborted)setState(data)}).catch(()=>{if(!controller.signal.aborted)setState({configured:false,enabled:false})});void history();return()=>controller.abort()},[user?.id]);
  async function send(){if(busy||!session)return;setBusy(true);setMessage('');setError(false);try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:accountConfig.key,Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'test'})});const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||'테스트 메일을 보내지 못했습니다.');setMessage('테스트 메일을 발송했습니다. 받은 편지함과 스팸함을 확인해 주세요.');await history()}catch(e){setError(true);setMessage(e instanceof Error?e.message:'발송 상태를 확인하지 못했습니다.')}finally{setBusy(false)}}
  return <div className="mail-delivery"><p className="notice">{state===null?'메일 서비스 연결을 확인하고 있어요.':state.enabled?'선택한 기념일 알림을 한국 시간 기준으로 자동 발송합니다. 같은 날 알림은 한 통으로 모아 보내요.':state.configured?'테스트 메일을 보낼 수 있습니다. 자동 발송은 최종 연결 중입니다.':'메일 발송 서버 연결을 마무리하고 있습니다. 저장한 설정은 연결 후 적용됩니다.'}</p><button className="oauth" disabled={busy||!state?.configured} onClick={()=>void send()}>{busy?'메일 보내는 중…':'테스트 메일 받기'}</button><small>인증된 알림 이메일로 발송 · 1분 간격, 하루 최대 3번</small>{message&&<p className={error?'account-error':'account-success'} role={error?'alert':'status'}>{message}</p>}{last&&<p className="notice">최근 발송: {new Date(last.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · {last.status==='sent'?'발송 완료':last.status==='reserved'?(Date.now()-Date.parse(last.created_at)<600000?'발송 처리 중':'발송 확인 필요'):last.status==='skipped'?'변경된 설정에 따라 취소':'발송 확인 필요'}</p>}<p className="notice">공식 창립기념일이 확인된 기업만 자동 알림에 포함됩니다. 기업 뉴스 이메일은 아직 준비 중입니다.</p></div>;
}

