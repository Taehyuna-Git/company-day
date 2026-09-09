import {headers} from 'next/headers';
import {sessionResponse} from '@/lib/session';
export const dynamic = 'force-dynamic';
export async function GET() { return sessionResponse(await headers()); }
