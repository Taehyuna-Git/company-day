'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Mail,LoaderCircle} from 'lucide-react';
import {clearEmailToken} from '../lib/email-verification';
import {sitePath} from '../portable/site-path';
type Result='checking'|'verified'|'already_verified'|'expired'|'invalid'|'error';
export function EmailVerificationResult({token}:{token:string}){
  const [result,setResult]=useState<Result>(token?'checking':'invalid'),[attempt,setAttempt]=useState(0);
  const pending=useRef<{key:string;promise:Promise<Result>}|null>(null);
  useEffect(()=>{
    if(!token){setResult('invalid');return}
    let active=true;const key=token+':'+attempt;setResult('checking');
    // StrictMode/remount effects may observe the same request; DB confirmation is also idempotent.
    if(pending.current?.key!==key)pending.current={key,promise:fetch('/api/account/email/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),cache:'no-store',credentials:'omit'}).then(async response=>{
      const data=await response.json() as {status?:Result};
      return data.status&&['verified','already_verified','expired','invalid'].includes(data.status)?data.status:response.status===400?'invalid':'error';
    }).catch(()=>'error' as Result)};
    pending.current.promise.then(status=>{if(!active)return;setResult(status);if(status!=='error'){clearEmailToken(sessionStorage);window.dispatchEvent(new Event('notification-email-updated'))}});
    return()=>{active=false};
  },[token,attempt]);
  const success=result==='verified'||result==='already_verified';
  const title={checking:'이메일을 확인하고 있어요',verified:'인증되었습니다.',already_verified:'이미 인증된 링크예요',expired:'인증 시간이 지났어요',invalid:'사용할 수 없는 링크예요',error:'연결을 다시 확인해 주세요'}[result];
  const description={checking:'잠시만 기다려 주세요. 로그인은 필요하지 않아요.',verified:'이제 이 이메일로 신청한 알림을 보내 드릴게요. 로그인 이메일과 알림 설정은 그대로 유지됩니다.',already_verified:'이 링크의 인증은 이미 완료되었어요. 현재 알림 이메일은 계정 관리에서 확인할 수 있어요.',expired:'30분이 지나 링크가 만료되었어요. 계정 관리에서 새 인증 메일을 받아 주세요.',invalid:'취소되었거나 새 메일이 발송된 링크일 수 있어요. 가장 최근에 받은 메일의 버튼을 눌러 주세요.',error:'주소를 다시 입력할 필요는 없어요. 아래 버튼으로 인증 결과를 다시 확인할 수 있어요.'}[result];
  return <section className={'email-result '+(success?'is-success':'')} data-state={result} aria-live="polite">
    <span className="email-result-icon" aria-hidden="true">{result==='checking'?<LoaderCircle className="email-result-spinner" size={30}/>:success?<Check size={32}/>:<Mail size={30}/>}</span>
    <h3>{title}</h3><p>{description}</p>
    {result==='error'&&<button className="oauth" onClick={()=>setAttempt(n=>n+1)}>다시 확인</button>}
    {result!=='checking'&&<div className="email-result-actions"><a className="oauth" href={sitePath('/')}>기업 둘러보기</a><a href={sitePath('/')+'?account=confirmed'}>{success?'계정 관리':'새 인증 메일 받기'}</a></div>}
  </section>;
}
