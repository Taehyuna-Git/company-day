# 기업의 날: 무료 우선 운영 상태

갱신: 2026-09-13

## 운영에 연결된 기능

- Cloudflare 사이트와 Supabase Free 데이터베이스
- 이메일 가입·로그인·비밀번호 재설정, Gmail SMTP 가입 인증
- Google 로그인 제공자 설정과 로그인 버튼 (최초 동의 후 최종 로그인 확인 필요)
- 계정별 관심 기업, 커스텀 그룹, 같은 창립일 모음
- 올해 기념주년과 5년 단위 배지, 관심 기업 기념일만 표시
- 표시 이름·알림 설정 저장, 본인 계정 탈퇴

적용된 SQL은 `supabase/migrations`의 20260910 초기 계정 스키마와 20260912 세 마이그레이션입니다. 현재 프로젝트에 다시 실행하지 않습니다. 사용자별 접근은 PostgreSQL RLS로 제한합니다.

## 남은 기능

- 카카오 개발자 앱 및 Supabase 제공자 연결
- 별도 수신 이메일 변경의 인증 메일 발송
- 기념일·뉴스 이메일, 뉴스 수집·요약·중요도 판정, Cron

`cloudflare/account-api.ts`는 별도 수신 주소 인증용 Resend 구현입니다. 서버 키와 발신 서비스가 아직 없으므로 현재 발송하지 않습니다. Supabase Gmail SMTP가 이 Worker API에 자동 연결되는 것은 아닙니다.

## 무료 우선 원칙

유료 플랜이나 유료 AI API를 활성화하지 않습니다. 자동 알림은 사용자별 묶음 메일과 발송 예산을 적용하는 후속 단계로 진행합니다. 수신 주소 인증 API의 내부 예산은 하루 70건·월 2,000건이며, Supabase 자체 가입 인증 메일은 이 카운터와 별도입니다. 공급자의 실제 한도는 연결 시 확인해야 합니다.

## 배포와 검증

공개 배포 설정은 `deployment.public.json`입니다. 비밀키와 SMTP 앱 비밀번호는 저장소에 포함하지 않습니다. 배포 명령과 GitHub 연결 값은 `CLOUDFLARE.md`를 참고하세요.

```sh
npm ci
npm run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm test
```

DB 테스트는 PGlite PostgreSQL에서 사용자 격리, 그룹 소유, 계정 삭제 범위, 인증 링크 만료·재사용·발송 예산을 검증합니다. API 테스트는 외부 서비스를 모의 처리하므로 실제 이메일 발송 성공을 의미하지 않습니다.
