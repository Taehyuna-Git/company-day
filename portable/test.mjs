import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
let input=await fs.readFile('lib/companies.ts','utf8');
for(const [name,file] of [['listed','listed-companies.json'],['catalogMeta','catalog-meta.json'],['officialLinks','official-links.json'],['curated','curated-overrides.json']])input=input.replace(`import ${name} from './${file}';`,`const ${name}=${await fs.readFile('lib/'+file,'utf8')};`);
const src=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const{companies,matches,occasion}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
assert.equal(companies.find(c=>c.stockCode==='017670').anniversary,'1984-03-29');
assert.notEqual(companies.find(c=>c.stockCode==='017670').founded,'1984-03-29','Keep legal incorporation separate from anniversary');
assert.equal(companies.find(c=>c.id==='samsung-display').anniversary,'2012-07-01');
for(const c of companies.filter(c=>c.anniversary)){assert.ok(c.source);assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(c.anniversary));}
for(const query of ['삼성','ㅅㅅ','samsung','tkatjd'])assert.ok(companies.filter(c=>matches(c,query)).some(c=>c.id==='samsung-electronics'),query);
assert.equal(companies.length,2652);
assert.equal(companies.filter(c=>c.market==='KOSPI').length,832);
assert.equal(companies.filter(c=>c.market==='KOSDAQ').length,1819);
assert.equal(new Set(companies.map(c=>c.id)).size,companies.length);
assert.equal(new Set(companies.filter(c=>c.stockCode).map(c=>c.stockCode)).size,2651);
for(const c of companies){assert.ok(c.name&&c.summary);assert.ok(!c.website||/^https?:\/\//.test(c.website));if(c.stockCode)assert.ok(matches(c,c.stockCode));}
for(const q of ['LG전자','셀트리온','알테오젠','POSCO','0220W0'])assert.ok(companies.some(c=>matches(c,q)),q);
assert.equal(companies.filter(c=>matches(c,'없는기업')).length,0);
assert.equal(companies.filter(c=>matches(c,'ㄴㅇㅂ'))[0].id,'naver');
const samsung=companies[0];assert.equal(occasion(samsung,new Date('2026-10-31T15:00:00Z')).days,0);assert.equal(occasion(samsung,new Date('2026-11-01T15:00:00Z')).year,2027);assert.equal(occasion(samsung,new Date('2026-09-07T00:00:00Z')).days,55);assert.equal(occasion(samsung,new Date('2026-09-07T00:00:00Z')).age,57);
const worker=(await import('../dist/server/index.js')).default;
for(const [route,file,type] of [['/style.css','portable/generated/style.txt','text/css'],['/app.js','portable/generated/client.txt','text/javascript']]) {
  const response=await worker.fetch(new Request('https://example.com'+route));
  assert.equal(response.status,200);
  assert.ok(response.headers.get('content-type').startsWith(type));
  assert.equal(await response.text(),await fs.readFile(file,'utf8'),route+' must return raw asset bytes, not a JavaScript string export');
}
const homeHtml=await (await worker.fetch(new Request('https://example.com/'))).text();
const chobiHtml=await (await worker.fetch(new Request('https://example.com/companies/krx-001550'))).text();
assert.ok(chobiHtml.includes('올해 설립주년')&&chobiHtml.includes('법인 설립일 기준'));
assert.ok(chobiHtml.includes('공식 창립기념일 미확인'));
assert.equal((await worker.fetch(new Request('https://example.com/api/calendar/samsung-display'))).status,200);
assert.ok(!homeHtml.includes('anniversary-panel'),'Anonymous homepage must not show followed anniversaries');
assert.equal((homeHtml.match(/class="company-card"/g)||[]).length,3,'Home should show only three companies');
for(const route of ['/','/anniversaries',...companies.filter((c,i)=>i<8||i%100===0).map(c=>'/companies/'+c.id)]){const r=await worker.fetch(new Request('https://example.com'+route));assert.equal(r.status,200,route);assert.ok((await r.text()).includes('기업의 날'));}
assert.equal((await worker.fetch(new Request('https://example.com/no-such-company'))).status,404);
assert.equal((await worker.fetch(new Request('https://example.com/api/calendar/krx-001550'))).status,404);
const cal=await worker.fetch(new Request('https://example.com/api/calendar/samsung-electronics'));assert.equal(cal.status,200);const ics=await cal.text();assert.ok(ics.includes('RRULE:FREQ=YEARLY'));assert.ok(ics.includes('DTSTART;VALUE=DATE:20261101'));assert.ok(ics.includes('DTEND;VALUE=DATE:20261102'));
assert.equal((await worker.fetch(new Request('https://example.com/',{method:'POST'}))).status,405);
console.log('PASS: Korean/initials/English/keyboard search, timezone/year rollover, 10 rendered routes, calendar, 404, method restrictions.');
const anonymous=await worker.fetch(new Request('https://example.com/api/session'));
assert.deepEqual(await anonymous.json(),{user:null});
assert.equal(anonymous.headers.get('cache-control'),'private, no-store');
const signedHeaders={'oai-authenticated-user-id':'test-user','oai-authenticated-user-email':'test@example.com','oai-authenticated-user-full-name':encodeURIComponent('테스트 사용자'),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
assert.deepEqual(await (await worker.fetch(new Request('https://example.com/api/session',{headers:signedHeaders}))).json(),{user:{name:'테스트 사용자',email:'test@example.com',provider:'ChatGPT'}});
assert.deepEqual(await (await worker.fetch(new Request('https://example.com/api/session',{headers:{'oai-authenticated-user-id':'test-user'}}))).json(),{user:null});
assert.deepEqual(await (await worker.fetch(new Request('https://example.com/api/session',{headers:{...signedHeaders,'oai-authenticated-user-full-name':'%invalid'}}))).json(),{user:{name:'test@example.com',email:'test@example.com',provider:'ChatGPT'}});
assert.equal((await worker.fetch(new Request('https://example.com/api/session',{method:'POST'}))).status,405);
assert.equal(await (await worker.fetch(new Request('https://example.com/api/session',{method:'HEAD'}))).text(),'');
console.log('PASS: session identity, anonymous, partial identity, invalid name encoding, cache and method controls.');
