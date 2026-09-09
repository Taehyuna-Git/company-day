import fs from 'node:fs/promises';
const list=JSON.parse(await fs.readFile('lib/listed-companies.json','utf8'));
const active=JSON.parse(await fs.readFile('../company-data/active-official-links.json','utf8'));
const result={};const normalize=s=>s.toLowerCase().replace(/주식회사|\(주\)|㈜|[^a-z0-9가-힣]/g,'');
let checked=0,readable=0,matched=0;
for(const c of list){let audit;try{audit=JSON.parse(await fs.readFile(`../company-data/official-audit/${c.stockCode}.json`,'utf8'))}catch{continue}checked++;if(!audit.pages.length)continue;readable++;
 const names=[normalize(c.name),normalize(c.en)].filter(s=>s.length>=3);
 if(!audit.pages.some(p=>names.some(n=>normalize(p.title+' '+p.text).includes(n))))continue;matched++;
 const links=audit.pages.flatMap(p=>p.links.filter(l=>(active[p.url]||[]).includes(l.url)).map(l=>({...l,source:p.url})));
 const channels=[];for(const l of links){const u=new URL(l.url),host=u.hostname.replace(/^www\./,'');let name='';
  if(/^(youtube.com|m.youtube.com)$/.test(host)&&/^\/(?:@|channel\/|c\/|user\/)[\w@-]+/.test(u.pathname))name='YouTube';
  if(host==='instagram.com'&&/^\/[\w.]+\/?$/.test(u.pathname)&&!/^\/(accounts|explore|reels|p)\/?$/.test(u.pathname))name='Instagram';
  if(host==='blog.naver.com'&&/^\/[\w-]+\/?$/.test(u.pathname))name='네이버 블로그';
  if(name&&!channels.some(x=>x.url===l.url))channels.push({name,url:l.url,source:l.source});
 }
 const careers=links.find(l=>/^https?:/.test(l.url)&&l.url.split('#')[0]!==l.source.split('#')[0]&&!l.url.endsWith('#')&&/^(?:채용|채용정보|인재채용|채용공고|인재영입|채용안내|Recruit|Recruitment|Careers|RECRUIT|CAREERS)$/.test(l.label.trim()));
 const contacts=[];for(const l of links){if(!l.url.startsWith('mailto:'))continue;const email=l.url.slice(7).split('?')[0];if(!/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(email)||contacts.some(x=>x.email===email))continue;
 // Only generic functional mailboxes; never re-label named personal contacts as representative mail.
 if(!/^(?:info|contact|sales|support|help|cs|ir|recruit|recruitment|hr|webmaster|admin)(?:[._-][\w.-]+)?@/i.test(email))continue;
 const role=/^ir@/i.test(email)?'IR 문의':/^(hr|recruit)/i.test(email)?'채용 문의':/^sales/i.test(email)?'영업 문의':/^(webmaster|admin)/i.test(email)?'홈페이지 관리':'공개 문의 이메일';contacts.push({email,label:role,source:l.source});}
 if(channels.length||careers||contacts.length)result[c.stockCode]={...(channels.length?{sns:channels.slice(0,6)}:{}),...(careers?{careers:careers.url,careersSource:careers.source}:{}),...(contacts.length?{publicContacts:contacts.slice(0,4)}:{}),linksVerifiedAt:audit.checkedAt.slice(0,10)};
}
await fs.writeFile('lib/official-links.json',JSON.stringify(result));
const stats={checked,readable,matched,enriched:Object.keys(result).length,sns:Object.values(result).filter(r=>r.sns).length,careers:Object.values(result).filter(r=>r.careers).length,publicContacts:Object.values(result).filter(r=>r.publicContacts).length};
await fs.writeFile('lib/enrichment-meta.json',JSON.stringify(stats,null,2));console.log(stats);
