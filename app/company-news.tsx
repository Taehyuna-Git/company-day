'use client';
import {useEffect,useState} from 'react';
import {accountConfig} from '../lib/account-config';
type Article={title:string;url:string;source:string;publishedAt:string};
export function CompanyNews({id}:{id:string}){
  const [articles,setArticles]=useState<Article[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
  const [stale,setStale]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError(false);setArticles([]);
    const origin=location.hostname.endsWith('.github.io')?accountConfig.siteUrl:'';
    fetch(origin+'/api/news/'+encodeURIComponent(id),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<{articles:Article[];stale?:boolean}>}).then(data=>{if(!controller.signal.aborted){setArticles(data.articles);setStale(Boolean(data.stale))}}).catch(()=>{if(!controller.signal.aborted)setError(true)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[id,attempt]);
  if(loading)return <p className="footnote" role="status">최신 뉴스를 불러오고 있어요.</p>;
  if(error)return <div className="news-empty"><p>지금은 뉴스를 불러오지 못했어요.</p><button onClick={()=>setAttempt(v=>v+1)}>다시 불러오기</button></div>;
  if(!articles.length)return <p className="footnote">기업명이 포함된 뉴스가 아직 없어요. 아래 검색 링크에서도 확인할 수 있어요.</p>;
  return <div className="company-news"><ul>{articles.map(article=><li key={article.url}><a href={article.url} target="_blank" rel="noopener noreferrer"><span>{article.title}</span><span aria-hidden="true">↗</span></a><small>{article.source||'언론사 미표시'} · <time dateTime={article.publishedAt}>{new Date(article.publishedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'})}</time></small></li>)}</ul><p className="footnote">{stale?'뉴스 갱신이 지연되어 마지막으로 받아온 기사를 표시합니다.':'Google 뉴스에서 수집한 기사 · 조회 시 15분마다 갱신'}</p></div>;
}
