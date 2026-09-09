'use client';
import {createContext,useContext,useEffect,useState, type ReactNode} from 'react';
import {basePath,sitePath} from '../portable/site-path';
type User = {name:string;email:string;provider:'ChatGPT'};
const Account = createContext<{user:User|null;loading:boolean;error:boolean;chatgpt:boolean;retry:()=>void}>({user:null,loading:true,error:false,chatgpt:false,retry:()=>{}});
export function AccountProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  const [chatgpt,setChatgpt]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError(false);
    fetch(sitePath(basePath()?'/api/session.json':'/api/session'),{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error('Session unavailable');return r.json()})
      .then(data=>{const session=data as {user:User|null;providers?:{chatgpt:boolean}};setUser(session.user);setChatgpt(session.providers?.chatgpt ?? true)})
      .catch(()=>{if(!controller.signal.aborted){setUser(null);setError(true)}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return ()=>controller.abort();
  },[attempt]);
  return <Account.Provider value={{user,loading,error,chatgpt,retry:()=>setAttempt(v=>v+1)}}>{children}</Account.Provider>;
}
export const useAccount=()=>useContext(Account);
export function AccountContent(){
  const {user,loading,error,chatgpt,retry}=useAccount();
  const [returnTo,setReturnTo]=useState('/');
  useEffect(()=>setReturnTo(location.pathname+location.search+location.hash),[]);
  if(loading)return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if(error)return <div role="alert"><p>로그인 상태를 확인하지 못했어요.</p><button className="oauth" onClick={retry}>다시 확인</button></div>;
  if(user)return <div className="account-content"><span className="account-badge">ChatGPT 로그인됨</span><h3>{user.name}</h3><p className="account-email">{user.email}</p><p className="notice">관심 기업 저장과 알림 설정은 다음 단계에서 연결할 예정이에요.</p><a className="oauth" href="/signout-with-chatgpt?return_to=%2F" target="_top">로그아웃</a></div>;
  return <div className="account-content">{chatgpt&&<a className="oauth chatgpt" href={'/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo)} target="_top">ChatGPT로 계속하기 ↗</a>}<button className="oauth" disabled>Google로 계속하기 · 연결 준비 중</button><button className="oauth kakao" disabled>카카오로 계속하기 · 연결 준비 중</button><p className="notice">Google·카카오 로그인은 서비스 연결 후 이용할 수 있어요. 기업 검색과 캘린더 추가는 로그인 없이 이용할 수 있어요.</p></div>;
}
