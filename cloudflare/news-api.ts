declare const __NEWS_COMPANIES__: Record<string,string>;
type Article={title:string;url:string;source:string;publishedAt:string};
function plain(value:string){
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity:string)=>{
    const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    if(entity.startsWith('#')){const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):''}
    return named[entity.toLowerCase()]||'';
  }).replace(/<[^>]*>/g,'').trim();
}
export function parseNews(xml:string,name:string):Article[]{
  const articles:Article[]=[],seen=new Set<string>();
  for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){
    const get=(tag:string)=>plain(match[1].match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>'))?.[1]||'');
    const source=get('source');let title=get('title');const url=get('link'),publishedAt=get('pubDate');
    if(source&&title.endsWith(' - '+source))title=title.slice(0,-source.length-3);
    if(!title.replace(/\s/g,'').toLowerCase().includes(name.replace(/\s/g,'').toLowerCase()))continue;
    let link:URL;try{link=new URL(url)}catch{continue}
    const time=Date.parse(publishedAt);
    if(link.protocol!=='https:'||link.hostname!=='news.google.com'||link.username||link.password||!Number.isFinite(time)||time>Date.now()+86400000)continue;
    const key=title.toLowerCase().replace(/\s/g,'');if(seen.has(key))continue;seen.add(key);
    articles.push({title:title.slice(0,300),url:link.href,source:source.slice(0,100),publishedAt:new Date(time).toISOString()});
  }
  return articles.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,3);
}
const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Access-Control-Allow-Origin':'https://taehyuna-git.github.io'};
export async function newsApi(request:Request):Promise<Response>{
  const url=new URL(request.url),id=url.pathname.slice('/api/news/'.length);
  if(!Object.hasOwn(__NEWS_COMPANIES__,id))return new Response(JSON.stringify({error:'등록된 기업을 찾지 못했습니다.'}),{status:404,headers});
  const cache=(globalThis as unknown as {caches?:{default?:Cache}}).caches?.default;
  const key=new Request(url.origin+'/api/news/'+id);
  const cached=await cache?.match(key);if(cached)return request.method==='HEAD'?new Response(null,cached):cached;
  try{
    const feed=new URL('https://news.google.com/rss/search');
    feed.search=new URLSearchParams({q:'"'+__NEWS_COMPANIES__[id]+'"',hl:'ko',gl:'KR',ceid:'KR:ko'}).toString();
    const response=await fetch(feed,{headers:{Accept:'application/rss+xml, application/xml'},signal:AbortSignal.timeout(10000)});
    if(!response.ok||!response.body)throw Error('upstream');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1048576){await reader.cancel();throw Error('size')}chunks.push(value)}
    const buffer=new Uint8Array(total);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length}
    const xml=new TextDecoder().decode(buffer);if(!xml.includes('<rss'))throw Error('format');
    const result=new Response(JSON.stringify({articles:parseNews(xml,__NEWS_COMPANIES__[id]),updatedAt:new Date().toISOString()}),{headers:{...headers,'Cache-Control':'public, max-age=900'}});
    if(cache)await cache.put(key,result.clone());
    return request.method==='HEAD'?new Response(null,result):result;
  }catch{return new Response(JSON.stringify({error:'뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}),{status:502,headers:{...headers,'Cache-Control':'no-store'}})}
}
