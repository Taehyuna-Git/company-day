export interface AccountEnv {PUBLIC_SITE_URL?:string;SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string}
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
// Edge verifies identity and owns SMTP credentials. No service-role key is needed here.
export async function accountApi(request:Request,env:AccountEnv):Promise<Response>{
  const url=new URL(request.url);
  if(request.method!=='POST')return response({error:'POST 요청이 필요합니다.'},405);
  if(!env.PUBLIC_SITE_URL||request.headers.get('Origin')!==env.PUBLIC_SITE_URL||url.origin!==env.PUBLIC_SITE_URL)return response({error:'허용되지 않은 요청입니다.'},403);
  if(!['/api/account/email/request','/api/account/email/confirm'].includes(url.pathname))return response({error:'주소를 찾을 수 없습니다.'},404);
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer ')||authorization.length>16000)return response({error:'로그인이 필요합니다.'},401);
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return response({error:'계정 서비스 연결 준비 중입니다.'},503);
  const body=await request.text();
  if(body.length>4096)return response({error:'요청이 너무 큽니다.'},413);
  try{
    const result=await fetch(env.SUPABASE_URL+'/functions/v1/anniversary-mail/email/'+url.pathname.split('/').pop(),{
      method:'POST',headers:{'Content-Type':'application/json',Origin:env.PUBLIC_SITE_URL,Authorization:authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY},body,signal:AbortSignal.timeout(55000),redirect:'error'
    });
    return new Response(await result.text(),{status:result.status,headers});
  }catch{return response({error:'처리 결과를 확인하지 못했습니다. 메일 요청이었다면 받은 편지함을 먼저 확인해 주세요. 자동으로 재발송하지 않습니다.'},502)}
}
