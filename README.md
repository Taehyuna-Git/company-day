# 기업의 날

기업 검색과 관심 기업 기념일을 관리하는 웹 서비스입니다.

운영 사이트: https://company-day-kr.taehyuna-github.workers.dev/

GitHub는 소스 저장소이며, 웹사이트는 Cloudflare Workers, 회원 인증과 개인 데이터는 Supabase를 사용합니다.

## 실행 및 검증

Node.js 24를 권장합니다.

```sh
npm ci
npm run build
npm test
npm start
```

브라우저에서 http://localhost:4180 으로 접속하면 은은한 파스텔 UI, 기업 검색, 무작위 기업 3곳, 기업 상세 페이지와 캘린더를 확인할 수 있습니다.

## Cloudflare Workers에 GitHub 연결

- 저장소: Taehyuna-Git/company-day
- 프로젝트 루트: package.json이 있는 위치
- 빌드 명령: npm run build
- 배포 명령: npm run deploy
- npm run build:cloudflare / npm run deploy:cloudflare 도 동일하게 지원합니다.
- 운영 주소와 Supabase 공개 연결값은 `deployment.public.json`에 있습니다. 이 publishable key는 브라우저용 공개 키이며, DB 접근은 사용자별 RLS로 제한합니다.
- 별도 배포 시 PUBLIC_SITE_URL, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_ACCOUNTS_ENABLED 환경변수로 덮어쓸 수 있습니다.
- Workers 설정 → Builds에서 main 브랜치를 연결하면 이후 GitHub 업데이트를 자동 배포할 수 있습니다. 빌드: `npm run build`, 배포: `npm run deploy`.
- Google/Kakao OAuth Secret, SMTP 앱 비밀번호, Supabase 관리자 키는 이 파일이나 GitHub에 넣지 않습니다. 해당 서비스의 비밀 설정에만 저장합니다.

ZIP 파일 자체를 저장소에 올리지 마세요. 압축 안의 app, components, lib, portable, cloudflare 등의 폴더와 package.json을 저장소 최상위에 함께 올려야 합니다. README.md만 있으면 실행 가능한 사이트가 아닙니다.

## 포함 기능과 남은 기능

- 코스피 832곳, 코스닥 1,819곳, 비상장 1곳: 총 2,652개 기업
- 한글·초성·영문·종목코드 검색과 시장 필터
- 접속·새로고침마다 무작위 기업 3곳
- 기업 정보, 법인 설립일/창립기념일 구분, 주년 및 캘린더 추가
- 모바일 화면, 최근 조회, 스타일과 JavaScript 포함
- Supabase 이메일 회원가입·인증·로그인·비밀번호 재설정, 알림 수신 설정과 회원 탈퇴
- 계정별 관심 기업 저장, 그룹 생성·배정·해제, 같은 창립일 모아보기
- 로그인한 계정의 관심 기업에 한해 홈 기념일 표시, 올해 n주년 및 5년 단위 배지
- Supabase에서 활성화한 Google·카카오 제공자는 로그인 화면에 자동 표시됩니다. 각 제공자의 앱 설정과 비밀키 연결이 필요합니다.
- 창립기념일 자동 이메일과 테스트 메일 운영: 인증된 수신 주소·수신 동의·D-Day·한국 시간 설정 적용, 하루 한 통으로 묶음 발송. 공식 기념일이 확인된 기업만 대상입니다.
- 별도 알림 이메일 변경 인증 API와 뉴스 자동 발송은 추가 연결이 필요합니다. 기념일 메일 운영 상태는 [ANNIVERSARY-MAIL.md](ANNIVERSARY-MAIL.md)를 참고하세요.
- Sites 전용 ChatGPT 로그인은 독립 Cloudflare 배포에서 제공하지 않습니다.

추가 배포 설명: [CLOUDFLARE.md](CLOUDFLARE.md). 데이터 출처: [DATA-SOURCES.md](DATA-SOURCES.md).

## 데이터베이스

새 Supabase 프로젝트는 `supabase/migrations`의 SQL을 파일명 순서대로 한 번만 적용합니다. 기존 운영 DB에는 이미 적용되어 있으므로 다시 실행하지 않습니다. 사용자별 조회·수정 권한은 DB의 RLS에서 검사합니다.
