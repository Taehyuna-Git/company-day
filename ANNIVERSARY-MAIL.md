# 기념일 이메일 발송

현재 상태 (2026-09-14): 코드와 자동 검증 완료. Supabase 신규 스키마·확인된 기념일 13곳·Cron 생성 및 anniversary-mail 함수 배포 완료. 사용자의 명시적 승인에 따라 legacy JWT 검증 옵션을 끄고 함수 내부 인증으로 전환했으며 저장 상태를 확인했습니다. 공개 상태 응답은 HTTP 정상 응답으로 configured=false, enabled=false입니다. Cloudflare에도 메일 기능 커밋 6f21463의 배포가 반영됐습니다. SMTP_PASSWORD 사용자 입력과 실제 메일 수신 검증이 남아 있으며, 검증 전까지 자동 발송은 비활성화 상태를 유지합니다.

## 구성

- Supabase Edge Function `anniversary-mail`: Gmail SMTP 465/TLS, 기존 발신 주소 `taehyuna.github@gmail.com`.
- Supabase Cron: 5분마다 실행. 한국 시간의 선택한 시각 이후 그날의 미발송 대상 처리. 사이트 방문 불필요.
- 전체 기념일 수신 동의, 기업별 수신 동의, D-Day 0/1/3/7과 인증된 수신 주소를 모두 확인.
- 사용자별 하루 한 통에 해당 기업들을 모아서 발송. 공식 창립기념일 미확인 기업 제외.
- 테스트: 인증된 로그인 계정의 DB 수신 주소로만 발송. 클라이언트의 이메일·사용자 ID는 사용하지 않음. 기념일이 없어도 테스트 가능.
- 테스트 60초 간격/24시간 3회, 앱 전체 메일 하루 70건/월 2,000건 제한. Supabase Auth 인증 메일은 별도.
- DB 예약의 고유 키와 트랜잭션 락으로 동시 Cron 중복 방지. SMTP 결과가 불명확하면 자동 재발송하지 않음. 로그에 `uncertain` 표시. SMTP 수신 서버 승인과 받은편지함 배달은 구분.
- 전송 직전 이메일·수신 동의·기업 설정을 다시 확인. 탈퇴 시 발송 기록과 예약도 삭제.

## 최초 연결 순서

1. `npm run build:mail`로 현재 기업 데이터와 함수 단일 파일 생성.
2. Supabase SQL Editor에서 `supabase/generated/anniversary-setup.sql` 실행. 기존 20260910/20260912 마이그레이션은 재실행하지 않음. 새 마이그레이션은 한 번만 적용. Cron은 만들어지지만 `anniversary_mail_settings.enabled=false`라 발송 요청이 발생하지 않음.
3. Edge Functions에서 `anniversary-mail` 생성. `supabase/generated/anniversary-mail.ts` 전체를 `index.ts`에 넣고 배포. `verify_jwt=false` 사용: 함수가 일반 사용자 JWT와 Vault 스케줄 토큰을 각각 직접 확인함. 게이트웨이 설정만 끄고 함수 내부 인증을 제거해서는 안 됨.
4. 사용자 본인이 Edge Functions → Secrets에서 `SMTP_PASSWORD`를 저장. 값은 위 Gmail 계정의 앱 비밀번호. 채팅·저장소에 기재하지 않음. Auth SMTP에 저장한 비밀번호가 Edge Functions로 자동 전달되지는 않음. 나머지 서버 키는 Supabase 기본 환경 변수 사용.
5. 사이트에서 로그인 → 저장한 기업 → 테스트 메일 받기. 사용자 본인이 테스트하거나 특정 수신자에 대한 명시적 발송 요청이 있을 때만 도구로 버튼 클릭. `sent` 로그와 수신함 확인.
6. 검증 후 `update public.anniversary_mail_settings set enabled=true where id=true;`로 스케줄 발송 활성화. 화면은 함수 GET 응답을 읽어 자동 발송 활성 상태 표시.
7. Cron 실행 기록·Edge Function 로그와 실제 지정시각 기념일 대상 발송 확인. 사용자의 실제 기념일 데이터를 테스트용으로 변경하지 않음.

## 업데이트와 운영

웹사이트 GitHub/Cloudflare 자동 배포와 Supabase 함수/SQL 배포는 별개입니다. 함수 변경 시 재배포하고, 공식 창립기념일 데이터 변경 시 `npm run build:mail` 뒤 `supabase/generated/anniversary-catalog.sql`을 적용합니다.

중지: `update public.anniversary_mail_settings set enabled=false where id=true;` (사용자 설정은 보존).

Cron 인증값은 DB의 Supabase Vault에 생성·저장됩니다. 브라우저에 공개되는 키는 없습니다. 발송 시각을 놓친 대상은 같은 한국 날짜 안에서 재확인하며, 전날 알림을 다음 날 보내지는 않습니다. 다량의 대상은 후속 Cron 실행에서 이어집니다.

새 알림 이메일의 소유권 인증 API는 기존 Cloudflare Resend 구현이며 아직 별도 연결 전입니다. 이 기능은 이미 인증된 `notification_emails` 주소를 사용합니다. 기존 가입 시 인증된 주소는 그대로 사용 가능합니다. 뉴스/AI 이메일은 이번 범위에 포함되지 않습니다.

검증: `node scripts/test-anniversary-mail.mjs` 및 `npx tsc --noEmit`, `npm run build`. DB와 메일 API 모의 검증은 실제 SMTP 배달 검증을 대신하지 않습니다.

참고: [Supabase SMTP 예제](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/index.ts), [Cron으로 함수 호출](https://supabase.com/docs/guides/functions/schedule-functions).

