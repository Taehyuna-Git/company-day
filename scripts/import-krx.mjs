import fs from 'node:fs/promises';
const dir=process.argv[2]||'../company-data';
const rows=JSON.parse(await fs.readFile(`${dir}/listing.json`,'utf8'));
const unique=new Map();
for(const r of rows){if(unique.has(r.code)&&unique.get(r.code).market!==r.market)throw Error('Conflicting market');if(!unique.has(r.code))unique.set(r.code,r)}
const value=s=>s&&s!=='-'?s.trim():'';
const url=s=>{s=value(s);if(!s)return '';try{const u=new URL(/^https?:\/\//i.test(s)?s:'https://'+s);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?s:undefined;
const records=[];let profiles=0;
for(const r of unique.values()){
 let p;try{p=JSON.parse(await fs.readFile(`${dir}/profiles/${r.code}.json`,'utf8'))}catch{}
 const f=p?.fields||{};if(p)profiles++;
 records.push({id:'krx-'+r.code,stockCode:r.code,name:r.name,en:value(f['영문명']),market:r.market,sector:r.sector,summary:value(f['주요제품'])||r.products||r.sector,tags:[],group:'',color:r.market==='KOSPI'?'#386e68':'#706293',website:url(f['홈페이지'])||url(r.website),ceo:value(f['대표이사'])||value(r.ceo),address:value(f['주소']),phone:value(f['전화번호']),founded:date(f['설립일']),listedOn:date(r.listedOn),region:r.region,catalogSource:p?.source||'https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage',verifiedAt:p?.fetchedAt.slice(0,10)||new Date().toISOString().slice(0,10)});
}
const meta={collectedAt:new Date().toISOString(),total:records.length,kospi:records.filter(r=>r.market==='KOSPI').length,kosdaq:records.filter(r=>r.market==='KOSDAQ').length,profiles,fields:Object.fromEntries(['en','ceo','address','phone','website','founded'].map(k=>[k,records.filter(r=>r[k]).length])),sources:['https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage','https://finance.naver.com/sise/sise_market_sum.naver','https://finance.daum.net/domestic/market_cap'],duplicatesRemoved:rows.length-records.length};
await fs.writeFile('lib/listed-companies.json',JSON.stringify(records));
await fs.writeFile('lib/catalog-meta.json',JSON.stringify(meta,null,2));
console.log(meta);
