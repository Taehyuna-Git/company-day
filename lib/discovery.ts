import {companies} from './companies';
export type Discovery = Record<string,string[]>;
export function createDiscovery():Discovery {
  return Object.fromEntries(['전체','KOSPI','KOSDAQ','비상장'].map(market=>{
    const pool=companies.filter(c=>market==='전체'||c.market===market);
    for(let i=0;i<Math.min(3,pool.length);i++){
      const j=i+Math.floor(Math.random()*(pool.length-i));
      [pool[i],pool[j]]=[pool[j],pool[i]];
    }
    return [market,pool.slice(0,3).map(c=>c.id)];
  }));
}
