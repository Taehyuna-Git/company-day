'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Header} from '../explorer';
import SavedAnniversaries from './saved-anniversaries';
import {companies,koreaDate,occasion,commemoration} from '@/lib/companies';
export default function Anniversaries(){
  const [limit,setLimit]=useState(30),[monthLimit,setMonthLimit]=useState(20);
  const today=koreaDate(),year=Number(today.slice(0,4));
  const events=companies.flatMap(c=>{const event=commemoration(c),next=occasion(c);return event&&next?[{c,event,next}]:[]});
  const month=events.filter(({event})=>event.date.slice(5,7)===today.slice(5,7)).sort((a,b)=>a.event.date.slice(5).localeCompare(b.event.date.slice(5)));
  const now=events.filter(({next})=>next.days===0),upcoming=events.sort((a,b)=>a.next.days-b.next.days||a.c.name.localeCompare(b.c.name,'ko'));
  const rows=(list:typeof events)=> <ul className="saved-anniversary-list">{list.map(({c,event,next})=>{
    const age=year-Number(event.date.slice(0,4));
    return <li key={c.id}><Link className={'saved-anniversary-card'+(age>0&&age%5===0?' milestone':'')} href={'/companies/'+c.id}>
      <span className="saved-anniversary-date">{Number(event.date.slice(5,7))}월 {Number(event.date.slice(8))}일</span>
      <span className="saved-anniversary-info"><strong>{c.name} ↗</strong><span>{event.label} · 올해 {age}주년</span>{event.basis==='incorporation'&&<small>법인 설립일 기준</small>}</span>
      <span className="saved-anniversary-dday">{next.days===0?'D-DAY':'D-'+next.days}</span>
    </Link></li>;
  })}</ul>;
  return <><Header/><main className="detail-shell"><div className="breadcrumb"><Link href="/">기업 탐색</Link> / 기념일</div><h1>기업의 중요한 날</h1>
    <p className="footnote">한국 시간 {today} 기준 · 회사 공식 창립일은 ‘창립기념일’, 별도 창립일이 확인되지 않은 경우는 ‘설립기념일’로 표시합니다. 설립기념일은 법인 설립일을 기준으로 한 일정입니다.</p>
    <SavedAnniversaries/>
    <section className="detail-section" style={{marginTop:25}}><h2>오늘의 기념일 · {now.length}곳</h2>{now.length?rows(now):<p>오늘 기념일을 맞는 등록 기업이 없어요.</p>}</section>
    <section className="detail-section"><h2>이번 달 기념일 · {month.length}곳</h2>{rows(month.slice(0,monthLimit))}{month.length>monthLimit&&<button className="load-more" onClick={()=>setMonthLimit(n=>n+20)}>이번 달 더 보기</button>}</section>
    <section className="detail-section"><h2>다가오는 기념일</h2>{rows(upcoming.slice(0,limit))}{upcoming.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+30)}>더 보기 ({Math.min(limit,upcoming.length)} / {upcoming.length})</button>}</section>
  </main></>;
}
