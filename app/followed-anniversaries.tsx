import Link from 'next/link';
import {CalendarDays} from 'lucide-react';
import {Company,occasion} from '@/lib/companies';

// Supply only the signed-in account's follows loaded by an authenticated server.
// Null is also used while authentication or follows are unavailable/loading.
export type AccountFollows = {userId:string;companies:Company[]} | null;
export function FollowedAnniversaries({account=null}:{account?:AccountFollows}) {
  if(!account?.userId)return null;
  const upcoming=account.companies.filter(c=>c.anniversary)
    .sort((a,b)=>occasion(a)!.days-occasion(b)!.days);
  if(!upcoming.length)return null;
  return <section className="anniversary-panel" aria-label="관심 기업의 다가오는 창립기념일">
    <div className="panel-label"><CalendarDays size={18}/> 다가오는 창립기념일</div>
    {upcoming.map(c=>{const o=occasion(c)!;return <Link href={'/companies/'+c.id} className="anniversary-row" key={c.id}>
      <div className="date-block">{Number(c.anniversary!.slice(5,7))}월<strong>{Number(c.anniversary!.slice(8))}</strong></div>
      <div><b>{c.name}</b><span>{o.age}주년 · {o.year}년</span></div>
      <small>{o.days===0?'D-DAY':`D-${o.days}`}</small>
    </Link>})}
  </section>;
}
