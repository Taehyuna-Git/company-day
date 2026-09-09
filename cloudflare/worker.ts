interface Env { ASSETS: {fetch(request:Request):Promise<Response>} }
// Independent deployment: never trust the Sites identity headers on public requests.
export default {
  async fetch(request:Request, env:Env):Promise<Response> {
    const url=new URL(request.url);
    const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
    if(url.pathname==='/api/session') {
      return new Response(request.method==='HEAD'?null:JSON.stringify({user:null,providers:{chatgpt:false,google:false,kakao:false}}),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
    }
    const response=await env.ASSETS.fetch(request);
    if(response.status!==404)return response;
    const page=await env.ASSETS.fetch(new Request(new URL('/404.html',url),request));
    return new Response(request.method==='HEAD'?null:page.body,{status:404,headers:{...Object.fromEntries(page.headers),...headers}});
  }
};
