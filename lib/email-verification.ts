const key='companyday-email-verification';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
// Keep a verification link across an OAuth redirect in this tab, never in a URL
// sent to Google or a referrer. Database expiry remains authoritative.
export function pendingEmailToken(storage:Store,fragment:string,now=Date.now()){
  const supplied=new URLSearchParams(fragment.replace(/^#/,'')).get('verify-email');
  if(supplied&&/^[a-f0-9]{64}$/.test(supplied)){
    try{storage.setItem(key,JSON.stringify({token:supplied,expires:now+30*60*1000}))}catch{}
    return supplied;
  }
  try{const saved=JSON.parse(storage.getItem(key)||'null');if(saved&&/^[a-f0-9]{64}$/.test(saved.token)&&saved.expires>now)return saved.token as string;storage.removeItem(key)}catch{}
  return '';
}
export function clearEmailToken(storage:Store){try{storage.removeItem(key)}catch{}}
