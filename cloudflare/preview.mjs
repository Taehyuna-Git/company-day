import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=path.resolve('dist/cloudflare/public');
await fs.access(path.join(base,'index.html')).catch(()=>{throw new Error('Run npm run build first.');});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try {
    const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    if(route==='/api/session'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':JSON.stringify({user:null,providers:{chatgpt:false,google:false,kakao:false}}));return;}
    const relative=route.replace(/^\/+|\/+$/g,'');
    let found;
    for(const name of (relative?[relative,relative+'.html'] : ['index.html'])) {
      const file=path.resolve(base,name);
      if(!file.startsWith(base+path.sep))continue;
      try {if((await fs.stat(file)).isFile()){found=file;break;}}catch{}
    }
    const file=found||path.join(base,'404.html');
    const type=route.startsWith('/api/calendar/')&&found?'text/calendar; charset=utf-8':types[path.extname(file)]||'application/octet-stream';
    res.writeHead(found?200:404,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:await fs.readFile(file));
  }catch{res.writeHead(400);res.end('Invalid request');}
}).listen(4180,'127.0.0.1',()=>console.log('Preview: http://localhost:4180'));
