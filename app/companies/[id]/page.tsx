import {notFound} from 'next/navigation';
import {companies} from '@/lib/companies';
import Detail from './detail';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const{id}=await params;const c=companies.find(c=>c.id===id);return {title:c?.name??'기업을 찾을 수 없습니다',description:c?.summary};}
export default async function CompanyPage({params}:{params:Promise<{id:string}>}){const{id}=await params;const c=companies.find(c=>c.id===id);if(!c)notFound();return <Detail c={c}/>}
