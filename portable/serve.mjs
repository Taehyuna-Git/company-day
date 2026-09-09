import http from 'node:http';
import worker from '../dist/server/index.js';
http.createServer(async(req,res)=>{try{const r=await worker.fetch(new Request('http://localhost:4173'+req.url,{method:req.method}));res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch(e){console.error(e);res.writeHead(500);res.end('Preview error')}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://localhost:4173'));
