# Cloudflare 무료 배포

기존 Sites 배포는 `.openai/hosting.json`과 `portable/build.mjs`를 사용합니다. 독립 배포는 `wrangler.cloudflare.json`과 `cloudflare/build.mjs`를 사용합니다. 대상 설정을 혼용하지 마세요.

## 완료된 이전

- 기존 React 화면과 기업 데이터 2,652곳을 재사용해 검색 가능한 HTML 2,654개를 생성합니다.
- HTML, CSS, JavaScript, 캘린더는 Workers Static Assets로 제공합니다. 페이지를 볼 때 서버 렌더링 CPU를 사용하지 않습니다.
- 브라우저 실행 시 현재 날짜로 화면을 다시 계산하고 기업 둘러보기 3곳을 다시 무작위 선정합니다. 정적 HTML의 날짜 표기는 빌드 시점 기준이므로 검색엔진용 날짜도 갱신하려면 재배포하세요.
- 공개 검색을 허용하고, PUBLIC_SITE_URL 지정 시 사이트맵과 canonical 주소를 생성합니다.
- 독립 서버는 Sites 인증 헤더를 신뢰하지 않습니다. ChatGPT 로그인은 숨기며 Google·카카오는 앱 등록과 별도 인증 구현이 남아 있습니다.
- 관심 기업·이메일·알림톡 저장/발송은 아직 연결되지 않았습니다. 기존 기업 데이터와 출처 기록은 보존합니다.

## 실행

Node 22.13 이상에서 프로젝트 디렉터리를 열고 실행하세요.

```sh
npm ci
npm run build:cloudflare
npm run test:cloudflare
npx wrangler login
npm run deploy:cloudflare
```

이 프로젝트는 npm lockfile을 사용합니다. 첫 배포 후 Wrangler가 출력한 실제 HTTPS 주소를 PUBLIC_SITE_URL 환경 변수에 넣고 다시 빌드·검증·배포하세요. 임의 주소를 등록하지 마세요. PowerShell 예:

```powershell
$env:PUBLIC_SITE_URL='https://실제로-발급된-주소.workers.dev'
npm run build:cloudflare
npm run test:cloudflare
npm run deploy:cloudflare
```

주소 값에는 마지막 `/`를 넣지 않습니다. GitHub를 연결하는 경우 Cloudflare Workers Builds의 빌드 명령은 `npm run build:cloudflare`, 배포 명령은 `npm run deploy:cloudflare`이며 실제 주소를 빌드 환경 변수로 설정합니다. 무료 빌드 사용량에도 한도가 있습니다.

## 비용과 데이터베이스

Workers Free만 사용합니다. R2, 유료 플랜, 유료 알림 서비스, 외부 유료 API를 활성화하지 않습니다. 현재 제공되는 기업 정보는 배포 파일에 들어 있으므로 D1 계정을 새로 만들지 않아도 조회 기능이 작동합니다. 무료 한도를 넘으면 서비스가 제한될 수 있습니다.

Sites가 관리하는 D1은 사용자 Cloudflare 계정으로 자동 이전되지 않습니다. 계정별 관심 기업을 구현할 때 새 무료 D1을 만들고 기존 `drizzle/0000_company_foundation.sql`을 적용한 뒤 바인딩을 연결해야 합니다. 기존 사용자 데이터가 있다면 별도의 내보내기와 가져오기가 필요합니다. 이 배포는 기존 D1을 수정하지 않습니다.

Cloudflare 로그인 인증 정보는 Wrangler 전용 설정 폴더에 저장하며 저장소에 넣지 않습니다. 추가 로그인 비밀키는 `wrangler secret put`으로 설정해야 합니다. `workers.dev`는 무료 기본 주소이며 커스텀 도메인 구매는 필요하지 않습니다.

현재 상태: 로컬 이전 완료. 실제 배포와 Cloudflare 계정 연결 상태는 작업 결과를 확인하세요.
