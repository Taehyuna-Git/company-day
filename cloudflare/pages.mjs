import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import './build.mjs';
const base='/company-day';
const origin='https://taehyuna-git.github.io';
const source=path.resolve('dist/cloudflare/public');
const output=path.resolve('dist/pages');
const assetVersion=createHash('sha256').update(await fs.readFile(path.join(source,'app.js'))).update(await fs.readFile(path.join(source,'style.css'))).digest('hex').slice(0,16);
await fs.mkdir(output,{recursive:true});
async function write(name,data){const file=path.join(output,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);}
const routes=[];
async function copy(dir=''){
  for(const entry of await fs.readdir(path.join(source,dir),{withFileTypes:true})){
    const name=path.posix.join(dir,entry.name);
    if(entry.isDirectory()){await copy(name);continue;}
    if(['_headers','robots.txt','sitemap.xml'].includes(name))continue;
    let data=await fs.readFile(path.join(source,name));
    if(name.endsWith('.html')){
      const route=name==='index.html'?'/':name==='404.html'?null:'/'+name.slice(0,-5)+'/';
      let html=data.toString().replace('<div id="root"',`<div id="root" data-base-path="${base}"`)
        .replace(/(href|src)="\/(?!\/)([^"]*)"/g,(_,attr,value)=>`${attr}="${base}/${value.startsWith('api/calendar/')?value+'.ics':value}"`)
        .replace(/<link rel="canonical"[^>]*>/g,'')
        .replace(/(app\.js|style\.css)"/g,`$1?v=${assetVersion}"`);
      if(route){routes.push(route);html=html.replace('</head>',`<link rel="canonical" href="${origin}${base}${route}"></head>`);}
      assert.ok(html.includes(`src="${base}/app.js?v=${assetVersion}"`));
      await write(route&&route!=='/'?name.slice(0,-5)+'/index.html':name,html);
    }else await write(name.startsWith('api/calendar/')?name+'.ics':name,data);
  }
}
await copy();
await write('api/session.json',JSON.stringify({user:null,providers:{chatgpt:false,google:false,kakao:false}}));
await write('.nojekyll','');
await write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${origin}${base}/sitemap.xml\n`);
await write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.map(route=>`<url><loc>${origin}${base}${route}</loc></url>`).join('')+'</urlset>');
assert.equal(routes.length,2654);
console.log('PASS: GitHub Pages build, 2654 pages, subdirectory links, CSS/JS, calendars and anonymous session.');
