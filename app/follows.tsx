'use client';
import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Bookmark} from 'lucide-react';
import Link from 'next/link';
import {useAccount} from './email-account';
import {getAccountClient} from '../lib/supabase-client';
import {companies} from '../lib/companies';
type Follow={company_id:string;group_id:string|null;anniversary_enabled:boolean};
type Group={id:string;name:string};
type State={owner:string;follows:Follow[];groups:Group[];ready:boolean;error:string};
const empty:State={owner:'',follows:[],groups:[],ready:false,error:''};
const Context=createContext({ ...empty, busy:false, reload:async()=>{}, toggle:async(_id:string)=>{}, group:async(_id:string,_group:string)=>{}, reminder:async(_id:string,_enabled:boolean)=>{}, addGroup:async(_name:string)=>{}, removeGroup:async(_id:string)=>{} });
export const useFollows=()=>useContext(Context);
export function FollowsProvider({children}:{children:ReactNode}){
  const {user}=useAccount(),uid=user?.id||'';
  const [state,setState]=useState<State>(empty),[busy,setBusy]=useState(false);
  const owner=useRef(uid);owner.current=uid;
  const lock=useRef(false);
  async function reload(){
    const client=getAccountClient();if(!uid||!client)return;
    const [a,b]=await Promise.all([client.from('company_follows').select('company_id,group_id,anniversary_enabled').eq('user_id',uid).order('created_at'),client.from('company_groups').select('id,name').eq('user_id',uid).order('created_at')]);
    if(owner.current!==uid)return;
    if(a.error||b.error){setState({...empty,owner:uid,error:'관심 기업을 불러오지 못했어요. 다시 시도해 주세요.'});return;}
    setState({owner:uid,follows:a.data||[],groups:b.data||[],ready:true,error:''});
  }
  useEffect(()=>{setState(empty);if(uid)void reload()},[uid]);
  async function mutate(action:()=>PromiseLike<{error:unknown}>){
    if(!uid||lock.current)return;lock.current=true;setBusy(true);
    try{const result=await action();if(result.error)throw result.error;await reload()}
    catch{if(owner.current===uid)setState(s=>({...s,error:'저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'}))}
    finally{lock.current=false;setBusy(false)}
  }
  const visible=state.owner===uid?state:empty;
  const client=getAccountClient();
  return <Context.Provider value={{...visible,busy,reload,
    toggle:async id=>{if(!client||!visible.ready||!companies.some(c=>c.id===id))return;await mutate(()=>visible.follows.some(f=>f.company_id===id)?client.from('company_follows').delete().eq('user_id',uid).eq('company_id',id):client.from('company_follows').insert({user_id:uid,company_id:id}))},
    group:async(id,group)=>{if(client)await mutate(()=>client.from('company_follows').update({group_id:group||null}).eq('user_id',uid).eq('company_id',id))},
    reminder:async(id,enabled)=>{if(client)await mutate(()=>client.from('company_follows').update({anniversary_enabled:enabled}).eq('user_id',uid).eq('company_id',id))},
    addGroup:async name=>{if(client&&name.trim())await mutate(()=>client.from('company_groups').insert({user_id:uid,name:name.trim()}))},
    removeGroup:async id=>{if(client)await mutate(()=>client.from('company_groups').delete().eq('user_id',uid).eq('id',id))}
  }}>{children}</Context.Provider>;
}
export function FollowButton({id,name,onLogin,compact=false}:{id:string;name:string;onLogin:()=>void;compact?:boolean}){
  const {user}=useAccount(),{follows,ready,busy,toggle,error}=useFollows();
  const saved=!!user&&follows.some(f=>f.company_id===id);
  return <button className={compact?'save':'primary-button'} aria-label={name+(saved?' 관심 기업 해제':' 관심 기업 등록')} aria-pressed={saved} disabled={!!user&&(!ready||busy)} title={error||undefined} onClick={()=>user?void toggle(id):onLogin()}><Bookmark size={18} fill={saved?'currentColor':'none'}/>{!compact&&(saved?'관심 기업 등록됨':'관심 기업 등록')}</button>;
}
export function MyCompanies(){
  const {user}=useAccount(),{follows,groups,ready,error,busy,addGroup,removeGroup,group,reminder,toggle,reload}=useFollows();
  const [selected,setSelected]=useState(''),[name,setName]=useState(''),[sameDate,setSameDate]=useState(false);
  if(!user)return null;
  const rows=follows.filter(f=>!selected||f.group_id===selected).flatMap(f=>{const c=companies.find(c=>c.id===f.company_id);return c?[{f,c}]:[]});
  const grouped=new Map<string,typeof rows>();
  for(const row of rows){const key=sameDate?(row.c.anniversary?.slice(5)||'기념일 확인 중'):'관심 기업';grouped.set(key,[...(grouped.get(key)||[]),row])}
  return <section className="my-companies"><h3>저장한 기업 <span className="muted">{follows.length}</span></h3>
    {error&&<p role="alert" className="account-error">{error} <button onClick={()=>void reload()}>다시 불러오기</button></p>}
    {!ready&&!error?<p role="status">관심 기업을 불러오고 있어요.</p>:<>
    <form className="group-create" onSubmit={async e=>{e.preventDefault();await addGroup(name);setName('')}}><input aria-label="기업을 묶을 그룹 이름" placeholder="그룹 이름 · 예: 거래처" maxLength={40} required value={name} onChange={e=>setName(e.target.value)}/><button disabled={busy||!name.trim()}>그룹 만들기</button></form>
    <div className="group-controls"><label>그룹 <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">전체</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>{selected&&<button disabled={busy} onClick={async()=>{await removeGroup(selected);setSelected('')}}>그룹만 해제</button>}<label><input type="checkbox" checked={sameDate} onChange={e=>setSameDate(e.target.checked)}/> 같은 창립일 모아보기</label></div>
    {!rows.length&&<p className="notice">기업의 북마크 버튼을 눌러 관심 기업을 등록해 보세요.</p>}
    {[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=><div key={date}>{sameDate&&<h4>{date} · {items.length}곳</h4>}{items.map(({c,f})=><article className="follow-item" key={c.id}><Link href={'/companies/'+c.id}>{c.name} ↗</Link><select aria-label={c.name+' 그룹'} value={f.group_id||''} disabled={busy} onChange={e=>void group(c.id,e.target.value)}><option value="">그룹 없음</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><label><input type="checkbox" checked={f.anniversary_enabled} disabled={busy} onChange={e=>void reminder(c.id,e.target.checked)}/>기념일 알림</label><button disabled={busy} aria-label={c.name+' 관심 기업 해제'} onClick={()=>void toggle(c.id)}>해제</button></article>)}</div>)}
    </>}
  </section>;
}
