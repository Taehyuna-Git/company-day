import assert from 'node:assert/strict';
import worker from '../dist/cloudflare/runtime/worker.js';
const originalFetch=globalThis.fetch;
let calls=0;
const item=(title,link,day,source='테스트일보')=>`<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${day}</pubDate><source>${source}</source></item>`;
const xml='<rss><channel>'+[
 item('삼성전자 신제품 &amp; 성장 - 테스트일보','https://news.google.com/rss/articles/a','2026-01-03'),
 item('삼성전자 신제품 &amp; 성장 - 테스트일보','https://news.google.com/rss/articles/duplicate','2026-01-03'),
 item('다른 기업 소식','https://news.google.com/rss/articles/other','2026-01-05'),
 item('삼성전자 잘못된 링크','javascript:alert(1)','2026-01-06'),
 item('삼성전자 외부 링크','https://attacker.example/','2026-01-06'),
 item('삼성전자 날짜 오류','https://news.google.com/rss/articles/bad','nonsense'),
 item('삼성전자 <script>내용</script> 실적','https://news.google.com/rss/articles/b','2026-01-02'),
 item('삼성전자 신규 소식','https://news.google.com/rss/articles/c','2026-01-04'),
 item('삼성전자 옛 소식','https://news.google.com/rss/articles/d','2026-01-01')].join('')+'</channel></rss>';
const env={ASSETS:{fetch:()=>{throw Error('Unexpected static fallback')}}};
try{
 globalThis.fetch=async input=>{calls++;const url=new URL(input);assert.equal(url.hostname,'news.google.com');assert.equal(url.searchParams.get('q'),'"삼성전자"');return new Response(xml)};
 let response=await worker.fetch(new Request('https://site.test/api/news/not-a-company?url=https://attacker.example'),env);
 assert.equal(response.status,404);assert.equal(calls,0);
 response=await worker.fetch(new Request('https://site.test/api/news/samsung-electronics',{method:'POST'}),env);assert.equal(response.status,405);assert.equal(calls,0);
 response=await worker.fetch(new Request('https://site.test/api/news/samsung-electronics'),env);
 const data=await response.json();assert.equal(data.articles.length,3);assert.equal(data.articles[0].title,'삼성전자 신규 소식');assert.equal(data.articles[1].title,'삼성전자 신제품 & 성장');assert.ok(data.articles.every(a=>!a.title.includes('<')));assert.equal(response.headers.get('cache-control'),'public, max-age=900');
 globalThis.fetch=async()=>new Response('upstream unavailable',{status:503});
 response=await worker.fetch(new Request('https://site.test/api/news/samsung-electronics'),env);assert.equal(response.status,502);assert.equal(response.headers.get('cache-control'),'no-store');
 console.log('PASS: news company allowlist, fixed upstream, safe titles/links, deduplication, newest three, and upstream failure.');
}finally{globalThis.fetch=originalFetch}
