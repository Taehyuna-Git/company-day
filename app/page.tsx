import Explorer from './explorer';
import {createDiscovery} from '@/lib/discovery';
export const dynamic='force-dynamic';
export default function Home() { return <Explorer discovery={createDiscovery()}/>; }
