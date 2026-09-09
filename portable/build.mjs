// A process-free Windows build of the same React pages for Cloudflare Workers.
import {build} from 'rolldown';
import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const plugin={name:'company-source',resolveId(source){if(source==='next/link')return path.join(root,'portable/link.tsx');if(source.startsWith('@/'))return this.resolve(path.join(root,source.slice(2)));},async load(id){if(id.endsWith('.txt'))return {code:'export default '+JSON.stringify(await fs.readFile(id,'utf8')),moduleType:'js'};},transform(code,id){if(/\.tsx?$/.test(id)&&!id.includes('node_modules'))return {code:ts.transpileModule(code,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,map:null}}};
await fs.mkdir('portable/generated',{recursive:true});await fs.mkdir('dist/server',{recursive:true});
const browser=await build({input:'portable/client.tsx',platform:'browser',plugins:[plugin],transform:{define:{'process.env.NODE_ENV':'"production"'}},output:{format:'esm',minify:true}});
await fs.writeFile('portable/generated/client.txt',browser.output[0].code);
const css=(await fs.readFile('app/globals.css','utf8')).replace(/^@import.*;\r?\n/gm,'')+'\n[data-slot="dialog-overlay"]{position:fixed;inset:0;background:#16233855;z-index:50;backdrop-filter:blur(3px)}[data-slot="dialog-content"]{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:51;display:grid;gap:16px;width:calc(100% - 32px);box-shadow:0 20px 80px #18233c33}[data-slot="dialog-close"]{position:absolute;right:10px;top:10px;padding:6px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}';
await fs.writeFile('portable/generated/style.txt',css);
await build({input:'portable/worker.tsx',platform:'browser',plugins:[plugin],transform:{define:{'process.env.NODE_ENV':'"production"'}},output:{file:'dist/server/index.js',format:'esm',minify:true}});
await fs.writeFile('dist/server/wrangler.json',JSON.stringify({name:'company-day',main:'index.js',compatibility_date:'2026-06-01',compatibility_flags:['nodejs_compat']},null,2));
console.log('Portable Worker build complete. Same React sources; no external runtime dependencies.');


