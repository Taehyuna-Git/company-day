import Link from 'next/link';
export default function NotFound(){return <main className="detail-shell empty"><h1>기업을 찾을 수 없어요</h1><p>주소를 확인하거나 기업명으로 다시 검색해 주세요.</p><Link href="/" className="primary-button">기업 검색으로 돌아가기</Link></main>}
