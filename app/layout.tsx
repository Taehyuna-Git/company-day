import {AccountProvider} from './account';
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: {default:'기업의 날 — 기업을 찾고, 중요한 날을 기억하세요',template:'%s | 기업의 날'},description:'코스피·코스닥·주요 비상장 기업의 정보와 창립기념일을 한곳에서. 초성·영문 검색과 캘린더 추가를 무료로 이용하세요.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ko"><body><AccountProvider>{children}</AccountProvider></body></html>}
