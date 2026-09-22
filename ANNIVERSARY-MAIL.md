# 기념일 이메일 발송

현재 상태 (2026-09-22): 기념일 이메일 기능을 배포하고 자동 발송을 활성화했습니다. Gmail 연결 검사가 성공했고, 2026-09-21 17:23:51 KST 테스트 메일은 SMTP 접수 및 DB sent 기록을 확인했습니다. 받은편지함 도착 여부는 사용자가 아직 확인해 주지 않았으므로 수신 완료로 단정하지 않습니다. 공개 상태는 configured=true, enabled=true입니다. 확인된 창립기념일은 13곳이며 legacy JWT OFF + 함수 내부 인증을 사용합니다.

운영 검증 (2026-09-22 22:55 KST 기준): 최근 24시간 Cron 288회 모두 succeeded, 최근 1시간 HTTP 호출 12회 모두 200. 자동 처리 경로는 정상 응답하며 당일 발송 조건에 해당하는 예약 메일 기록은 아직 없습니다. 조건을 맞추기 위해 실제 기업 날짜나 사용자 설정을 변경하지 않았습니다. 초기 인증 실패 테스트 1건은 uncertain 기록으로 보존했고, 이후 테스트 1건이 sent입니다.

## 구성

- Supabase Edge Function `anniversary-mail`: Gmail SMTP 465/TLS, 기존 발신 주소 `taehyuna.github@gmail.com`.
- Supabase Cron: 5분마다 실행. 한국 시간의 선택한 시각 이후 그날의 미발송 대상 처리. 사이트 방문 불필요.
- 전체 기념일 수신 동의, 기업별 수신 동의, D-Day 0/1/3/7과 인증된 수신 주소를 모두 확인.
- 사용자별 하루 한 통에 해당 기업들을 모아서 발송. 공식 창립기념일 미확인 기업 제외.
- 테스트: 인증된 로그인 계정의 DB 수신 주소로만 발송. 클라이언트의 이메일·사용자 ID는 사용하지 않음. 기념일이 없어도 테스트 가능.
- 테스트 60초 간격/24시간 3회, 앱 전체 메일 하루 70건/월 2,000건 제한. Supabase Auth 인증 메일은 별도.
- DB 예약의 고유 키와 트랜잭션 락으로 동시 Cron 중복 방지. SMTP 결과가 불명확하면 자동 재발송하지 않음. 로그에 `uncertain` 표시. SMTP 수신 서버 승인과 받은편지함 배달은 구분.
- Gmail 인증 실패(EAUTH)는 메일 접수 전 실패이므로 `failed`로 기록하고 사용자에게 발송 계정 연결 오류를 안내. 그 외 오류는 보수적으로 `uncertain` 유지. 비밀번호 입력에 포함된 공백은 제거.
- 운영자용 `check-smtp`는 기존 Vault 스케줄 토큰으로만 호출 가능. Gmail 연결·인증만 검사하며 메일 발송이나 발송 예약은 하지 않음. 진단에는 허용된 오류 코드와 SMTP 상태 숫자만 포함하고 비밀번호·메일 내용·원문 응답은 기록하지 않음.
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

알림 이메일 변경은 `내 계정 → 새 알림 이메일 → 인증 메일 보내기`에서 요청합니다. 같은 Gmail SMTP를 사용하는 `anniversary-mail/email/request`가 발송하고 `/email/confirm`이 인증을 완료합니다. Cloudflare API는 요청만 전달하며 별도 Resend 연결이나 서비스 키가 필요하지 않습니다. 로그인 이메일은 바뀌지 않습니다.

인증 링크는 요청한 계정의 로그인과 명시적인 인증 버튼 클릭을 모두 요구하며, 30분 동안 한 번만 유효합니다. GET/메일 미리보기로는 수신 주소가 변경되지 않습니다. DB에는 SHA-256 해시만 저장합니다. 링크의 토큰은 URL fragment로 전달하고 페이지가 읽은 뒤 주소에서 제거합니다. 같은 탭의 sessionStorage에 잠시 보관해 Google 로그인 후에도 이어서 인증할 수 있습니다. 성공하면 지웁니다. 재발송은 기존 링크를 무효화합니다.

인증 전까지 기존 수신 주소는 유지됩니다. 인증 요청은 60초 간격/24시간 5회이며 기념일 메일과 하루 70건·월 2,000건 예산을 공유합니다. SMTP 응답을 확인하지 못하면 인증 발송 기록은 `reserved`로 남고 자동 재시도하지 않습니다. Gmail이 접수한 뒤 기록 갱신만 실패한 경우에는 재발송을 유도하지 않도록 성공 응답을 유지합니다. 뉴스/AI 이메일은 이번 범위에 포함되지 않습니다.

검증: `node scripts/test-anniversary-mail.mjs` 및 `npx tsc --noEmit`, `npm run build`. DB와 메일 API 모의 검증은 실제 SMTP 배달 검증을 대신하지 않습니다.

참고: [Supabase SMTP 예제](https://github.com/supabase/supabase/blob/master/examples/edge-functions/supabase/functions/send-email-smtp/index.ts), [Cron으로 함수 호출](https://supabase.com/docs/guides/functions/schedule-functions).

