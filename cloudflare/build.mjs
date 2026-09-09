import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'rolldown';
import ts from 'typescript';
import {gzipSync} from 'node:zlib';
import '../portable/build.mjs';

const worker=(await import('../dist/server/index.js?cloudflare-build')).default;
const root=path.resolve('dist/cloudflare');
// This build owns only its dedicated generated output directory.
if(root!==path.join(process.cwd(),'dist','cloudflare'))throw new Error('Unexpected build directory');
await fs.rm(root,{recursive:true,force:true});
await fs.mkdir(path.join(root,'public'),{recursive:true});
const output=path.join(root,'public');
const origin=process.env.PUBLIC_SITE_URL || '';
if(origin) {const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new Error('PUBLIC_SITE_URL must be an HTTPS origin with no trailing slash');}
let input=await fs.readFile('lib/companies.ts','utf8');
for(const [name,file] of [['listed','listed-companies.json'],['catalogMeta','catalog-meta.json'],['officialLinks','official-links.json'],['curated','curated-overrides.json']])input=input.replace(`import ${name} from './${file}';`,`const ${name}=${await fs.readFile('lib/'+file,'utf8')};`);
const module=ts.transpileModule(input,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {companies}=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
const routes=['/','/anniversaries',...companies.map(c=>'/companies/'+c.id)];
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function write(file,body){const target=path.join(output,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,body);}
for(const route of [...routes,'/not-found']) {
  const response=await worker.fetch(new Request('https://build.invalid'+route));
  let html=await response.text();
  html=html.replace('<div id="root"','<div id="root" data-deployment="cloudflare"').replace('ChatGPT 로그인 지원','소셜 로그인 연결 준비 중');
  if(response.status===200)html=html.replace('name="robots" content="noindex,nofollow"','name="robots" content="index,follow"');
  if(origin&&response.status===200)html=html.replace('</head>',`<link rel="canonical" href="${escape(origin+route)}"></head>`);
  await write(route==='/not-found'?'404.html':route==='/'?'index.html':route.slice(1)+'.html',html);
}
for(const c of companies.filter(c=>c.anniversary)) {
  const r=await worker.fetch(new Request('https://build.invalid/api/calendar/'+c.id));
  if(r.status!==200)throw new Error('Calendar build failed: '+c.id);
  await write('api/calendar/'+c.id,await r.text());
}
await write('app.js',await fs.readFile('portable/generated/client.txt'));
await write('style.css',await fs.readFile('portable/generated/style.txt'));
await write('robots.txt','User-agent: *\nAllow: /\nDisallow: /api/\n'+(origin?'Sitemap: '+origin+'/sitemap.xml\n':''));
if(origin)await write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>'<url><loc>'+escape(origin+route)+'</loc></url>').join('')+'</urlset>');
await write('_headers',`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
/app.js
  Cache-Control: public, max-age=0, must-revalidate
/style.css
  Cache-Control: public, max-age=0, must-revalidate
/api/calendar/*
  Content-Type: text/calendar; charset=utf-8
  Content-Disposition: attachment; filename="company-anniversary.ics"
  X-Robots-Tag: noindex
/404.html
  X-Robots-Tag: noindex
`);
await build({input:'cloudflare/worker.ts',platform:'browser',output:{file:path.join(root,'worker.js'),format:'esm',minify:true}});
const workerGzip=gzipSync(await fs.readFile(path.join(root,'worker.js'))).length;
if(workerGzip>3*1024*1024)throw new Error('Worker exceeds free bundle size');
await fs.writeFile(path.join(root,'build-info.json'),JSON.stringify({builtAt:new Date().toISOString(),pages:routes.length,companies:companies.length,origin,workerGzip},null,2));
console.log(`Cloudflare ready: ${routes.length} pages, ${companies.length} companies, Worker ${workerGzip} gzip bytes. ${origin?'Sitemap enabled.':'Set PUBLIC_SITE_URL after the first deployment to enable sitemap and canonical URLs.'}`);
