# 기업의 날: 무료 우선 운영 및 1단계 연결

작성일: 2026-09-10. 이 문서는 설정 절차이며 배포/메일 발송 완료를 의미하지 않는다.

## 현재 준비된 코드

- `app/email-account.tsx`: 이메일 가입/로그인, 인증 메일 안내, 비밀번호 재설정, 계정 설정, 수신 이메일 변경/확인 화면.
- `supabase/migrations/202609100001_accounts.sql`: 사용자별 RLS, 수신 주소 소유 확인, 일회용 인증 링크, 앱 메일 예산 제한.
- `cloudflare/account-api.ts`: Supabase에서 로그인 신원 검증 후 인증 메일 처리. 서비스 관리자 키와 Resend 키는 서버 전용.
- 기존 Google OAuth 클라이언트와 `cloudflare/google-auth.mjs` 초안은 보존한다. 독립 Google 검증 방식은 현재 활성 기능이 아니다.

## 실제 활성화 전 연결 순서

1. Supabase 조직 `기업의 날`의 Free 프로젝트 `company-day`가 생성되었다. 프로젝트 ref는 `gnnrlkxplhwyqufoapuv`, 실제 리전은 도쿄다. DB 비밀번호는 소유자가 직접 설정하고 보관한다.
2. 위 SQL 구조는 이 프로젝트에 2026-09-10 적용 완료했다. 중복 실행하지 않는다. 새로운 별도 프로젝트에만 초기 SQL을 한 번 실행한다. 기존 SQLite/Drizzle 파일을 Supabase에 실행하지 않는다.
3. Supabase Auth에서 이메일 인증 필수, 비밀번호 최소 길이 12, URL allowlist를 정확한 실제 Cloudflare 사이트의 루트 주소 및 `/?account=confirmed`, `/?account=recovery`로 설정한다. 임의의 모든 도메인을 허용하지 않는다.
4. 회원 데이터 보호/보관/탈퇴 및 연락처 안내를 운영자 정보에 맞춰 완성한다. 자동 탈퇴 UI는 아직 구현하지 않았으므로 공개 전 삭제 요청 처리 수단을 마련한다.
5. 소유자 테스트는 Supabase 기본 SMTP의 허용 수신자/제한 내에서 한다. 일반 가입 공개에는 별도 SMTP 및 발신 인증이 필요하다. 인증을 끄고 이메일 주소만으로 가입을 허용하지 않는다.
6. Cloudflare에 현재 React 사이트 전체와 Worker를 함께 배포한다. GitHub Pages는 공개 기업 검색용으로 유지하며 이메일/비밀번호 입력 기능은 그 도메인에서 활성화되지 않는다.
7. 다음 공개 빌드 변수를 설정하고 빌드한다: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SITE_URL`. 최종 검증할 때만 `PUBLIC_ACCOUNTS_ENABLED=true`.
8. Worker 런타임에는 `PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`를 설정하고 `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`는 Cloudflare Secrets로 넣는다. `MAIL_FROM`은 인증된 발신 주소이다. 메일 발신 연결 전에는 `MAIL_ENABLED=false`를 유지한다.
9. 두 테스트 계정으로 가입 인증, 로그인, 비밀번호 재설정, 설정 변경, 수신 주소 변경과 재인증, 로그아웃을 실제 확인한다. 비밀키/비밀번호를 GitHub, 빌드 공개 변수, 채팅에 넣지 않는다.

## 무료 비용 제한

- 조직은 Free에 유지한다. 자동 업그레이드나 유료 옵션을 켜지 않는다.
- 앱 인증 메일은 DB 트랜잭션으로 하루 70건, 월 2,000건까지 예약한다. 동일 사용자 60초 재발송 대기, 24시간 5회 제한이다. 실패/예약 중 발송도 한도에 포함한다.
- 위 카운터는 **앱 API를 통한 메일만** 센다. Supabase Auth 가입·비밀번호 재설정 메일은 SMTP 공급자 전체 한도로 별도 관리한다. Resend Free의 총 한도(일 100/월 3,000)와 Auth 자체 rate limit도 확인한다. 이 코드만으로 외부 발송의 전체 사용량을 보장하지 않는다.
- Resend 기본 테스트 도메인은 소유자 이메일에만 발송 가능하다. 공개 수신자 발송은 발신 도메인 DNS 인증 또는 그에 맞는 다른 SMTP 공급자가 필요하다. 무료 사이트 주소는 발신 도메인 소유를 대체하지 않는다.
- 50명 규모의 기념일과 뉴스는 3단계에서 사용자별 일일 묶음 메일로 설계한다. 아직 Cron/뉴스 메일을 발송하지 않는다.
- AI API 호출은 연결하지 않았다. 먼저 규칙 기반 중요도 판정으로 시작하고 유료 모델 연결은 별도로 결정한다.
- 3단계에서는 동일 DB 예산 예약 함수를 모든 발송 경로에 공통 적용하고, 중복 방지 및 발송 로그 정리를 추가한다. Supabase Auth 로그와 앱 메일 로그에 이메일 본문/인증 토큰을 기록하지 않는다.
- Supabase Free 한도/비활성 일시 정지 정책은 운영 시 공식 요금표를 확인한다. Free는 무중단 보장을 제공하는 계약이 아니다.

## 검증 명령

```sh
npm ci
node cloudflare/pages.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm test
node scripts/test-accounts-db.mjs
node scripts/test-account-api.mjs
```

DB 테스트는 PGlite PostgreSQL에서 실제 SQL/RLS를 실행한다. 외부 계정 또는 이메일 발송 없이 격리, 인증 토큰 재사용/만료, 재발송 제한과 일일 한도를 확인한다. API 테스트는 외부 Auth와 메일을 모의 처리하므로 실서비스 연결 검증을 대체하지 않는다.

## 후속 단계

2단계: 관심 기업 저장, 그룹, 기념일 달력, 올해/다음 기념일 주년 구분, 5년 단위 배지.
3단계: 공식 뉴스 API 수집, 출처/이용 가능한 본문 범위 확인, 중요도 근거와 요약, 중복 없는 일일 Cron 발송.
