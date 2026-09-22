# Cloudflare 배포

운영 사이트: https://company-day-kr.taehyuna-github.workers.dev/

## 구성

- 기업 2,652곳의 데이터와 React 화면으로 HTML 2,654개를 생성합니다.
- HTML, CSS, JavaScript, 캘린더는 Workers Static Assets에서 제공합니다.
- 기업 둘러보기는 접속할 때 3곳을 무작위로 고르고, 기념주년은 현재 날짜로 계산합니다.
- Supabase가 이메일·소셜 로그인과 계정별 관심 기업, 그룹, 알림 설정을 저장합니다. 새 D1 데이터베이스는 필요하지 않습니다.
- Google 제공자는 Supabase에 연결됐습니다. 카카오는 앱 설정이 남았습니다.
- 알림 이메일 변경 인증과 기념일 자동 발송은 Supabase Edge Function의 Gmail SMTP를 사용합니다. 뉴스 이메일은 아직 연결되지 않았습니다.
- Cloudflare의 계정 API에는 `PUBLIC_SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`가 필요합니다. 서버 비밀키와 SMTP 비밀번호는 Supabase에만 둡니다.

## 빌드와 배포

Node.js 24를 사용합니다.

```sh
npm ci
npm run build
npm test
npm run deploy
```

처음 사용하는 컴퓨터에서는 배포 전에 `npx wrangler login`을 실행합니다. 설정 파일은 `wrangler.cloudflare.json`입니다.

`deployment.public.json`에 운영 주소와 Supabase 공개 키가 있습니다. 빌드 환경 변수 `PUBLIC_SITE_URL`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_ACCOUNTS_ENABLED`로 덮어쓸 수 있습니다. 이 파일에는 서버 비밀키를 넣지 않습니다.

## GitHub 자동 연결 설정

- 저장소: `Taehyuna-Git/company-day`
- 기존 Worker: `company-day-kr`
- 배포 브랜치: `main`
- 루트 디렉터리: 저장소 루트
- 빌드 명령: `npm run build`
- 배포 명령: `npm run deploy`

2026-09-13 Cloudflare Workers Builds에 이 저장소를 연결했습니다. main에 변경을 올리면 위 명령으로 자동 빌드·배포합니다. 다른 브랜치의 미리보기 빌드는 꺼두었습니다. 배포 결과는 Cloudflare의 Deployments에서 확인합니다.

GitHub Actions의 기존 Pages 배포도 유지합니다. Pages는 검색용으로 제공하며 로그인 버튼에서 Cloudflare 운영 사이트로 안내합니다.

## 운영 범위

Workers Free와 Supabase Free를 사용하며 유료 옵션은 활성화하지 않았습니다. 로그인 비밀키는 Supabase 제공자 설정에 저장합니다. Gmail SMTP는 Supabase 가입 인증과 비밀번호 재설정용입니다. 별도 알림 발송 설정과 혼용하지 않습니다.
