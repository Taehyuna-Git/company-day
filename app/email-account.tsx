'use client';
import {createContext,useContext,useEffect,useState,type ReactNode,type FormEvent} from 'react';
import type {Session} from '@supabase/supabase-js';
import {getAccountClient} from '../lib/supabase-client';
import {accountConfig} from '../lib/account-config';
import {sitePath} from '../portable/site-path';
type AccountUser={id:string;name:string;email:string};
type Value={user:AccountUser|null;loading:boolean;session:Session|null;needsAction:boolean;recovery:boolean;verificationToken:string;authError:string;refresh:()=>void};
const Account=createContext<Value>({user:null,loading:true,session:null,needsAction:false,recovery:false,verificationToken:'',authError:'',refresh:()=>{}});
export const useAccount=()=>useContext(Account);
export function AccountProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[recovery,setRecovery]=useState(false),[token,setToken]=useState(''),[needsAction,setNeedsAction]=useState(false),[attempt,setAttempt]=useState(0);
  const [authError,setAuthError]=useState('');
  useEffect(()=>{
    const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));const verification=fragment.get('verify-email');
    if(verification&&/^[a-f0-9]{64}$/.test(verification)){setToken(verification);setNeedsAction(true);history.replaceState(null,'',location.pathname+location.search)}
    if(query.get('account')||query.get('error')||fragment.get('error')){setNeedsAction(true);if(query.get('account')==='recovery')setRecovery(true)}
    const callbackError=query.get('error')||fragment.get('error');
    if(callbackError)setAuthError(callbackError==='access_denied'?'로그인이 취소되었거나 계정 연결이 허용되지 않았습니다.':'로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 로그인 서비스 설정 확인이 필요합니다.');
    const client=getAccountClient();if(!client){setLoading(false);return}let active=true;
    const {data:{subscription}}=client.auth.onAuthStateChange((event,current)=>{if(active){setSession(current);setLoading(false);if(event==='PASSWORD_RECOVERY'){setRecovery(true);setNeedsAction(true)}}});
    client.auth.getSession().then(({data,error})=>{if(active){setSession(error?null:data.session);setLoading(false)}}).catch(()=>{if(active)setLoading(false)}).finally(()=>{
      if(callbackError&&active){const clean=new URL(location.href);for(const key of ['error','error_code','error_description'])clean.searchParams.delete(key);clean.hash='';history.replaceState(null,'',clean.pathname+clean.search)}
    });
    return()=>{active=false;subscription.unsubscribe()};
  },[attempt]);
  useEffect(()=>{
    const client=getAccountClient(),uid=session?.user.id;if(!client||!uid)return;
    let active=true;client.from('profiles').select('display_name').eq('user_id',uid).single().then(({data})=>{if(active&&data&&!data.display_name.trim())setNeedsAction(true)});
    return()=>{active=false};
  },[session?.user.id]);
  const user=session?.user?{id:session.user.id,email:session.user.email||'',name:session.user.email?.split('@')[0]||'회원'}:null;
  return <Account.Provider value={{user,session,loading,recovery,verificationToken:token,needsAction,authError,refresh:()=>setAttempt(v=>v+1)}}>{children}</Account.Provider>;
}
function errorMessage(error:unknown){const code=(error as {code?:string})?.code;return code==='invalid_credentials'?'이메일 또는 비밀번호를 확인해 주세요.':code==='email_not_confirmed'?'받은 편지함에서 이메일 인증을 완료해 주세요.':code==='over_email_send_rate_limit'?'메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.':'요청을 처리하지 못했습니다. 입력 정보와 서비스 연결을 확인해 주세요.'}
export function AccountContent({panel='account'}:{panel?:'favorites'|'account'}){
  const {user,loading,session,recovery,verificationToken,authError}=useAccount();
  const [mode,setMode]=useState<'login'|'signup'|'reset'>('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState(false),[resetDone,setResetDone]=useState(false);
  const client=getAccountClient();
  const [providers,setProviders]=useState<{google?:boolean;kakao?:boolean}>({});
  useEffect(()=>{if(!client)return;const controller=new AbortController();fetch(accountConfig.url+'/auth/v1/settings',{headers:{apikey:accountConfig.key},signal:controller.signal}).then(r=>r.ok?r.json() as Promise<{external?:{google?:boolean;kakao?:boolean}}>:null).then(data=>{if(data)setProviders(data.external||{})}).catch(()=>{});return()=>controller.abort()},[client]);
  async function social(provider:'google'|'kakao'){
    if(!client||busy)return;setBusy(true);setMessage('');
    const {error}=await client.auth.signInWithOAuth({provider,options:{redirectTo:new URL(sitePath('/')+'?account=confirmed',location.origin).href}});
    if(error){setFailure(true);setMessage('소셜 로그인 연결에 실패했습니다. 다시 시도해 주세요.');setBusy(false)}
  }
  async function authenticate(event:FormEvent){event.preventDefault();if(!client||busy)return;setBusy(true);setMessage('');setFailure(false);
    try{
      const redirect=new URL(sitePath('/'),location.origin);redirect.searchParams.set('account',mode==='reset'?'recovery':'confirmed');
      if(recovery&&user&&!resetDone){const {error}=await client.auth.updateUser({password});if(error)throw error;setResetDone(true);history.replaceState(null,'',location.pathname);setMessage('비밀번호를 변경했습니다.')}
      else if(mode==='login'){const {error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}
      else if(mode==='signup'){const {error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect.href}});if(error)throw error;setMessage('가입이 가능한 주소라면 인증 메일이 도착합니다. 받은 편지함과 스팸함을 확인해 주세요.')}
      else {const {error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect.href});if(error)throw error;setMessage('등록된 이메일이라면 비밀번호 재설정 안내가 도착합니다.')}
      setPassword('');
    }catch(error){setFailure(true);setMessage(errorMessage(error))}finally{setBusy(false)}
  }
  if(loading)return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if(!client)return <div className="account-content">{accountConfig.siteUrl&&typeof location!=='undefined'&&location.hostname.endsWith('.github.io')?<><p>회원 기능은 새 기업의 날 사이트에서 이용할 수 있어요.</p><a className="oauth" href={accountConfig.siteUrl+'/?account=login'}>새 사이트에서 로그인 ↗</a></>:<p>이메일 로그인과 알림 설정을 준비하고 있습니다.</p>}<p className="notice">기업 검색과 캘린더 추가는 지금 바로 이용할 수 있어요.</p></div>;
  if(user&&!(recovery&&!resetDone))return <Settings key={user.id+panel} panel={panel} user={user} accessToken={session!.access_token} verificationToken={verificationToken}/>;
  const changing=Boolean(recovery&&user&&!resetDone);
  return <div className="account-content">
    {authError&&!message&&<p className="account-error" role="alert">{authError}</p>}
    {!changing&&mode==='login'&&(providers.google||providers.kakao)&&<div className="account-social">{providers.google&&<button className="oauth" disabled={busy} onClick={()=>void social('google')}>Google로 계속하기</button>}{providers.kakao&&<button className="oauth kakao" disabled={busy} onClick={()=>void social('kakao')}>카카오로 계속하기</button>}</div>}
    {!changing&&<div className="account-tabs" aria-label="계정 메뉴">{(['login','signup','reset'] as const).map(value=><button key={value} aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setMessage('');setPassword('')}}>{value==='login'?'로그인':value==='signup'?'회원가입':'비밀번호 찾기'}</button>)}</div>}
    {verificationToken&&!user&&<p className="notice">수신 이메일 변경을 요청한 계정으로 로그인해 주세요.</p>}
    <form className="account-form" onSubmit={authenticate}>
      {!changing&&<label>이메일<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>}
      {(changing||mode!=='reset')&&<label>{changing?'새 비밀번호':'비밀번호'}<input type="password" required minLength={mode==='signup'||changing?12:1} maxLength={128} autoComplete={mode==='signup'||changing?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>}
      {(mode==='signup'||changing)&&<small>비밀번호는 12자 이상으로 설정해 주세요.</small>}
      <button className="oauth" disabled={busy}>{busy?'처리 중…':changing?'비밀번호 변경':mode==='login'?'이메일로 로그인':mode==='signup'?'가입하고 인증 메일 받기':'재설정 메일 받기'}</button>
    </form>
    {message&&<p role={failure?'alert':'status'} className={failure?'account-error':'account-success'}>{message}</p>}
    <p className="notice">이메일은 계정 인증에 사용됩니다. 기념일·뉴스 알림은 로그인 후 별도로 선택할 수 있어요.</p>
    <details className="notice"><summary>개인정보 이용 안내</summary><p>기업의 날은 회원 인증을 위해 이메일을, 개인 설정을 위해 닉네임·관심 기업·그룹·알림 수신 주소를 저장합니다. 인증과 데이터 저장에는 Supabase를 사용하며 데이터베이스는 일본 도쿄에 있습니다. 인증 메일은 Gmail 발신 계정을 통해 보냅니다. 기념일·뉴스 메일은 별도 신청 시에만 발송합니다. 계정 삭제 시 개인 설정과 관심 기업도 삭제됩니다.</p></details>
  </div>;
}
function Settings({user,accessToken,verificationToken,panel}:{user:AccountUser;accessToken:string;verificationToken:string;panel:'favorites'|'account'}){
  const client=getAccountClient()!;
  const [nickname,setNickname]=useState(''),[savedNickname,setSavedNickname]=useState(''),[editingNickname,setEditingNickname]=useState(false);
  const [deleteEmail,setDeleteEmail]=useState(''),[showDelete,setShowDelete]=useState(false);
  const [recipient,setRecipient]=useState(''),[newEmail,setNewEmail]=useState(''),[pending,setPending]=useState(''),[anniversary,setAnniversary]=useState(false),[news,setNews]=useState(false),[days,setDays]=useState([0,1,3]),[hour,setHour]=useState(9),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState(false),[confirmed,setConfirmed]=useState(false);
  async function load(){
    const results=await Promise.all([client.from('profiles').select('display_name').eq('user_id',user.id).single(),client.from('notification_preferences').select('anniversary_enabled,news_enabled,lead_days,send_hour').eq('user_id',user.id).single(),client.from('notification_emails').select('email').eq('user_id',user.id).maybeSingle(),client.from('email_verification_requests').select('email,expires_at').eq('user_id',user.id).maybeSingle()]);
    if(results.some(r=>r.error))throw Error('설정을 불러오지 못했습니다.');
    const profile=results[0].data,preferences=results[1].data,email=results[2].data,verification=results[3].data;
    setNickname(profile?.display_name||'');setSavedNickname(profile?.display_name||'');setAnniversary(preferences!.anniversary_enabled);setNews(preferences!.news_enabled);setDays(preferences!.lead_days);setHour(preferences!.send_hour);setRecipient(email?.email||'');setPending(verification&&new Date(verification.expires_at).getTime()>Date.now()?verification.email:'');setReady(true);
  }
  useEffect(()=>{let active=true;load().catch(()=>{if(active){setFailure(true);setMessage('계정 설정을 불러오지 못했습니다. 다시 불러오기를 눌러 주세요.')}});return()=>{active=false}},[user.id]);
  async function perform(action:()=>Promise<void>,success:string){if(busy)return;setBusy(true);setMessage('');setFailure(false);try{await action();setMessage(success)}catch(error){setFailure(true);setMessage(error instanceof Error?error.message:'처리하지 못했습니다.')}finally{setBusy(false)}}
  async function api(path:string,body:object){const r=await fetch('/api/account/email/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},body:JSON.stringify(body),cache:'no-store'});const data=await r.json() as {error?:string};if(!r.ok)throw Error(data.error||'요청에 실패했습니다.')}
  return <div className="account-content">{panel==='account'&&<p className="account-email">로그인 이메일 · {user.email}</p>}
    {panel==='account'&&verificationToken&&!confirmed&&<div className="account-verification"><p>이 주소를 알림 수신 이메일로 사용할까요?</p><button className="oauth" disabled={busy} onClick={()=>perform(async()=>{await api('confirm',{token:verificationToken});setConfirmed(true);await load()},'알림 이메일 인증을 완료했습니다.')}>이메일 인증 완료</button></div>}
    {!ready?<button disabled={busy} onClick={()=>perform(load,'계정 설정을 불러왔습니다.')}>다시 불러오기</button>:<>
    {panel==='account'&&<div className="nickname-settings">
      {!savedNickname?<p>처음 오셨네요. 사이트에서 사용할 닉네임을 정해 주세요.</p>:<div className="nickname-row"><small>닉네임 · <strong>{savedNickname}</strong></small><button disabled={busy} onClick={()=>{setNickname(savedNickname);setEditingNickname(v=>!v)}}>{editingNickname?'닫기':'닉네임 변경'}</button></div>}
      {(!savedNickname||editingNickname)&&<form className="nickname-form" onSubmit={e=>{e.preventDefault();const value=nickname.trim();if(!value)return;void perform(async()=>{const {error}=await client.from('profiles').update({display_name:value}).eq('user_id',user.id);if(error)throw Error('닉네임을 저장하지 못했습니다.');setSavedNickname(value);setEditingNickname(false)},'닉네임을 저장했습니다.')}}><input aria-label="닉네임" autoComplete="nickname" required maxLength={80} value={nickname} placeholder="사용할 닉네임" onChange={e=>setNickname(e.target.value)} disabled={busy}/><button disabled={busy||!nickname.trim()}>저장</button></form>}
    </div>}
    {panel==='favorites'&&<form className="account-form" onSubmit={e=>{e.preventDefault();perform(async()=>{const b=await client.from('notification_preferences').update({anniversary_enabled:anniversary,news_enabled:news,lead_days:days,send_hour:hour}).eq('user_id',user.id);if(b.error)throw Error('알림 설정 저장에 실패했습니다.')},'설정을 저장했습니다.')}}>
      <fieldset disabled={busy}><legend>받고 싶은 알림</legend><label className="account-check"><input type="checkbox" checked={anniversary} onChange={e=>setAnniversary(e.target.checked)}/>창립기념일 알림</label><label className="account-check"><input type="checkbox" checked={news} onChange={e=>setNews(e.target.checked)}/>기업 뉴스 모아보기</label></fieldset>
      <fieldset disabled={busy}><legend>기념일 알림 시점</legend><div className="account-days">{[0,1,3,7].map(day=><label key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(e.target.checked?[...days,day]:days.filter(n=>n!==day))}/>{day===0?'당일':day+'일 전'}</label>)}</div></fieldset>
      <label>메일 받을 시간 · 한국 시간<select value={hour} onChange={e=>setHour(Number(e.target.value))} disabled={busy}>{Array.from({length:24},(_,n)=><option key={n} value={n}>{n}시</option>)}</select></label>
      <p className="notice">알림 발송은 후속 단계에서 연결됩니다. 지금은 설정만 저장합니다.</p><button className="oauth" disabled={busy||days.length===0}>설정 저장</button>
    </form>}
    {panel==='account'&&<><p>현재 알림 이메일<br/><strong>{recipient||'인증된 수신 주소 없음'}</strong></p>{pending&&<p className="notice">인증 대기: {pending}</p>}
    <form className="account-form" onSubmit={e=>{e.preventDefault();perform(async()=>{await api('request',{email:newEmail.trim()});await load()},'인증 메일을 보냈습니다. 기존 수신 주소는 인증이 끝날 때까지 유지됩니다.')}}><label>새 알림 이메일<input type="email" required maxLength={254} value={newEmail} onChange={e=>setNewEmail(e.target.value)} disabled={busy}/></label><button className="oauth" disabled={busy}>이 주소로 인증 메일 보내기</button></form></>}
    </>}
    {message&&<p className={failure?'account-error':'account-success'} role={failure?'alert':'status'}>{message}</p>}
    {panel==='account'&&<><div className="account-actions"><button className="account-signout" disabled={busy} onClick={()=>perform(async()=>{const {error}=await client.auth.signOut();if(error)throw Error('로그아웃에 실패했습니다.')},'로그아웃했습니다.')}>로그아웃</button><button className="account-signout account-delete" disabled={busy} aria-expanded={showDelete} onClick={()=>setShowDelete(v=>!v)}>회원 탈퇴</button></div>
    {showDelete&&<div className="notice account-delete-confirm"><p>탈퇴하면 관심 기업·그룹·알림 설정이 영구 삭제됩니다. 계속하려면 가입 이메일을 입력해 주세요.</p><form className="account-form" onSubmit={e=>{e.preventDefault();if(deleteEmail!==user.email)return;void perform(async()=>{const {error}=await client.rpc('delete_my_account');if(error)throw Error('탈퇴 처리에 실패했습니다. 다시 시도해 주세요.');await client.auth.signOut({scope:'local'})},'계정을 삭제했습니다.')}}><input aria-label="탈퇴 확인 이메일" type="email" value={deleteEmail} onChange={e=>setDeleteEmail(e.target.value)}/><button disabled={busy||deleteEmail!==user.email}>계정 영구 삭제</button></form></div>}</>}
  </div>;
}
