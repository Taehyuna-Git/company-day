import {Miniflare,createFetchMock} from 'miniflare';
import fs from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
const origin='https://companyday.example',upstream='https://example.supabase.co';
const source=ts.transpileModule(await fs.readFile('cloudflare/account-api.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const mock=createFetchMock();mock.disableNetConnect();
const pool=mock.get(upstream),path='/functions/v1/anniversary-mail/email/confirm';
pool.intercept({path,method:'POST'}).reply(401,JSON.stringify({error:'verified account required'}));
// Match the installed workerd's supported date; this test executes the real Worker APIs.
const runtime=new Miniflare({modules:true,compatibilityDate:'2026-05-15',fetchMock:mock,bindings:{PUBLIC_SITE_URL:origin,SUPABASE_URL:upstream,SUPABASE_PUBLISHABLE_KEY:'test-public-key'},script:source+'\nexport default {fetch:accountApi};'});
const options=()=>({method:'POST',headers:{Origin:origin,Authorization:'Bearer invalid-test-token'},body:'{"token":"invalid"}'});
try{
  const response=await runtime.dispatchFetch(origin+'/api/account/email/confirm',options());
  assert.equal(response.status,401);assert.equal((await response.json()).error,'verified account required');
  mock.assertNoPendingInterceptors();
  console.log('PASS: actual Workers engine supports the proxy request options and forwards the upstream authentication response.');
}finally{await runtime.dispose();await mock.close()}
