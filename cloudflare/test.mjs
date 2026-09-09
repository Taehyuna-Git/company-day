import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import worker from '../dist/cloudflare/worker.js';
const root='dist/cloudflare/public/';
const info=JSON.parse(await fs.readFile('dist/cloudflare/build-info.json','utf8'));
assert.equal(info.companies,2652);
assert.equal(info.pages,2654);
const home=await fs.readFile(root+'index.html','utf8');
assert.equal((home.match(/class="company-card"/g)||[]).length,3);
assert.ok(home.includes('data-deployment="cloudflare"'));
assert.ok(home.includes('content="index,follow"'));
assert.ok(!home.includes('anniversary-panel'));
assert.ok(!home.includes('ChatGPT 로그인 지원'));
const paths=await fs.readdir(root+'companies');
assert.equal(paths.length,2652);
for(const path of paths) {
  const html=await fs.readFile(root+'companies/'+path,'utf8');
  assert.ok(html.includes('content="index,follow"'),path);
  assert.ok(html.includes('대표이사'),path);
  assert.ok(!html.includes('build.invalid'),path);
}
const css=await fs.readFile(root+'style.css','utf8');
assert.ok(css.includes('.company-card'));
assert.ok(!css.startsWith('export default'));
const js=await fs.readFile(root+'app.js','utf8');
assert.ok(js.includes('cloudflare'));
assert.ok(js.includes('data-deployment')||js.includes('dataset.deployment'));
const calendar=await fs.readFile(root+'api/calendar/samsung-electronics','utf8');
assert.ok(calendar.includes('RRULE:FREQ=YEARLY'));
assert.ok((await fs.readFile(root+'_headers','utf8')).includes('text/calendar'));
const forged=new Request('https://test.workers.dev/api/session',{headers:{'oai-authenticated-user-id':'attacker','oai-authenticated-user-email':'fake@example.com',Cookie:'session=forged'}});
const env={ASSETS:{fetch:async request=>new Response(request.url.endsWith('/404.html')?'missing':'not found',{status:request.url.endsWith('/404.html')?200:404})}};
const response=await worker.fetch(forged,env);
assert.deepEqual(await response.json(),{user:null,providers:{chatgpt:false,google:false,kakao:false}});
assert.equal(response.headers.get('cache-control'),'private, no-store');
assert.equal((await worker.fetch(new Request('https://test.workers.dev/api/session',{method:'POST'}),env)).status,405);
assert.equal((await worker.fetch(new Request('https://test.workers.dev/missing'),env)).status,404);
assert.equal(await (await worker.fetch(new Request('https://test.workers.dev/api/session',{method:'HEAD'}),env)).text(),'');
if(info.origin) {
  const sitemap=await fs.readFile(root+'sitemap.xml','utf8');
  assert.equal((sitemap.match(/<loc>/g)||[]).length,2654);
  assert.ok(sitemap.includes(info.origin+'/companies/samsung-electronics'));
  assert.ok(home.includes('rel="canonical"'));
}
console.log('PASS: 2652 company pages, public SEO, assets, calendar, anonymous home, forged identity rejected, methods and 404.');
