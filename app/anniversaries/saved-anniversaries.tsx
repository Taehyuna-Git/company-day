'use client';
import {useState} from 'react';
import Link from 'next/link';
import {companies,koreaDate,occasion} from '@/lib/companies';
import {useAccount} from '../email-account';
import {useFollows} from '../follows';
import {Login} from '../explorer';

export default function SavedAnniversaries(){
  const {user,loading}=useAccount();
  const {follows,ready,error,reload}=useFollows();
  const [login,setLogin]=useState(false);
  const ids=new Set(follows.map(f=>f.company_id));
  const saved=user?companies.filter(c=>ids.has(c.id)):[];
  const dated=saved.flatMap(c=>{const next=occasion(c);return next?[{c,next}]:[]})
    .sort((a,b)=>a.next.days-b.next.days||a.c.name.localeCompare(b.c.name,'ko'));
  const undated=saved.filter(c=>!c.anniversary).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  const year=Number(koreaDate().slice(0,4));
  return <section className="detail-section saved-anniversaries" aria-labelledby="saved-anniversaries-title">
    <h2 id="saved-anniversaries-title">저장한 기업의 기념일{user&&ready&&<span className="saved-anniversary-count">{saved.length}곳</span>}</h2>
    {loading?<p role="status">로그인 상태를 확인하고 있어요.</p>:!user?<><p>로그인하면 내가 저장한 기업들의 기념일을 모아 볼 수 있어요.</p><button className="load-more" onClick={()=>setLogin(true)}>로그인하고 보기</button></>:error?<p role="alert">{error} <button onClick={()=>void reload()}>다시 불러오기</button></p>:!ready?<p role="status">저장한 기업의 기념일을 불러오고 있어요.</p>:!saved.length?<p>아직 저장한 기업이 없어요. <Link href="/">기업을 찾아 북마크해 보세요 ↗</Link></p>:<>
      <p className="footnote">알림 설정 여부와 관계없이 저장한 모든 기업을 표시합니다. 가까운 기념일부터 확인해 보세요.</p>
      {dated.length>0&&<ul className="saved-anniversary-list">{dated.map(({c,next})=>{
        const age=year-Number(c.anniversary!.slice(0,4)),milestone=age>0&&age%5===0;
        return <li key={c.id}><Link className={'saved-anniversary-card'+(milestone?' milestone':'')} href={'/companies/'+c.id}>
          <span className="saved-anniversary-date">{Number(c.anniversary!.slice(5,7))}월 {Number(c.anniversary!.slice(8))}일</span>
          <span className="saved-anniversary-info"><strong>{c.name} ↗</strong><span>올해 {age}주년 {milestone&&<b className="milestone-badge">{age}주년 기념</b>}</span>{next.year!==year&&<small>다음 기념일: {next.year}년 · {next.age}주년</small>}</span>
          <span className="saved-anniversary-dday">{next.days===0?'D-DAY':'D-'+next.days}</span>
        </Link></li>;
      })}</ul>}
      {undated.length>0&&<div className="saved-anniversary-pending"><h3>창립기념일 확인 중 · {undated.length}곳</h3><p className="footnote">공식 창립기념일이 확인되면 위 목록에 표시됩니다.</p><ul>{undated.map(c=><li key={c.id}><Link href={'/companies/'+c.id}>{c.name} ↗</Link><span>기념일 확인 중</span></li>)}</ul></div>}
    </>}
    <Login open={login} onOpenChange={setLogin}/>
  </section>;
}

