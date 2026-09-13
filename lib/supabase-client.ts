import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {accountConfig} from './account-config';
let client:SupabaseClient|null=null;
export function getAccountClient(){
  if(typeof window==='undefined'||!accountConfig.enabled||!accountConfig.url||!accountConfig.key)return null;
  // GitHub Pages remains a public catalog; email/password accounts run on Cloudflare.
  if(location.hostname.endsWith('.github.io'))return null;
  return client??=createClient(accountConfig.url,accountConfig.key,{auth:{flowType:'pkce',storageKey:'companyday-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
