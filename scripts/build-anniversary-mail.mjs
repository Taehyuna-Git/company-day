import fs from 'node:fs/promises';
import ts from 'typescript';
let source=await fs.readFile('lib/companies.ts','utf8');
for(const [name,file] of [['listed','listed-companies.json'],['catalogMeta','catalog-meta.json'],['officialLinks','official-links.json'],['curated','curated-overrides.json']])source=source.replace(`import ${name} from './${file}';`,`const ${name}=${await fs.readFile('lib/'+file,'utf8')};`);
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {companies}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const dated=companies.filter(c=>c.anniversary);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const values=dated.map(c=>'('+[c.id,c.name,c.anniversary].map(quote).join(',')+')').join(',\n');
const sql=`-- Generated from the website's confirmed anniversary catalog. Run on catalog updates.\nbegin;\ninsert into public.anniversary_catalog(company_id,name,anniversary) values\n${values}\non conflict(company_id) do update set name=excluded.name,anniversary=excluded.anniversary;\ndelete from public.anniversary_catalog where company_id not in (${dated.map(c=>quote(c.id)).join(',')});\ncommit;\n`;
await fs.mkdir('supabase/generated',{recursive:true});
await fs.writeFile('supabase/generated/anniversary-catalog.sql',sql);
const index=await fs.readFile('supabase/functions/anniversary-mail/index.ts','utf8');
const core=await fs.readFile('supabase/functions/anniversary-mail/core.ts','utf8');
await fs.writeFile('supabase/generated/anniversary-mail.ts',core+'\n'+index.replace("import {createHandler,type Job} from './core.ts';",''));
const parts=await Promise.all(['supabase/migrations/202609140001_anniversary_mail.sql','supabase/generated/anniversary-catalog.sql','supabase/migrations/202609140002_anniversary_schedule.sql'].map(p=>fs.readFile(p,'utf8')));
await fs.writeFile('supabase/generated/anniversary-setup.sql','-- Apply once to the existing company-day Supabase project. No secrets are returned.\nbegin;\n'+parts.map(s=>s.replace(/^delete from public\.anniversary_catalog[^\n]*\n/gm,'').replace(/^begin;\r?\n/mi,'').replace(/^commit;\r?$/gmi,'')).join('\n')+'\ncommit;\n');
console.log(`Prepared function and ${dated.length} confirmed anniversaries.`);

