import Link from 'next/link';
import {CalendarDays} from 'lucide-react';
import {Company,companies,koreaDate,occasion} from '@/lib/companies';
import {useAccount} from './email-account';
import {useFollows} from './follows';

// Supply only the signed-in account's follows loaded by an authenticated server.
// Null is also used while authentication or follows are unavailable/loading.
export type AccountFollows = {userId:string;companies:Company[]} | null;
export function FollowedAnniversaries({account:provided}:{account?:AccountFollows}) {
  const {user}=useAccount(),{follows,ready}=useFollows();
  const account=provided===undefined?(user&&ready?{userId:user.id,companies:companies.filter(c=>follows.some(f=>f.company_id===c.id))}:null):provided;
  if(!account?.userId)return null;
  const upcoming=account.companies.filter(c=>c.anniversary)
    .sort((a,b)=>occasion(a)!.days-occasion(b)!.days);
  if(!upcoming.length)return null;
  return <section className="anniversary-panel" aria-label="관심 기업의 다가오는 창립기념일">
    <div className="panel-label"><CalendarDays size={18}/> 다가오는 창립기념일</div>
    {upcoming.slice(0,6).map(c=>{const o=occasion(c)!;const age=Number(koreaDate().slice(0,4))-Number(c.anniversary!.slice(0,4));return <Link href={'/companies/'+c.id} className={'anniversary-row'+(age>0&&age%5===0?' milestone':'')} key={c.id}>
      <div className="date-block">{Number(c.anniversary!.slice(5,7))}월<strong>{Number(c.anniversary!.slice(8))}</strong></div>
      <div><b>{c.name}</b><span>올해 {age}주년 {age>0&&age%5===0&&<strong className="milestone-badge">기념주년</strong>}</span>{o.year!==Number(koreaDate().slice(0,4))&&<span>다음 기념일: {o.year}년 · {o.age}주년</span>}</div>
      <small>{o.days===0?'D-DAY':`D-${o.days}`}</small>
    </Link>})}
  </section>;
}
