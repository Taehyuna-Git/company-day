# 로그인 연결 상태

현재 Sites 배포에서는 플랫폼이 제공하는 ChatGPT 로그인을 사용합니다. 로그인 링크는 `/signin-with-chatgpt`, 로그아웃 링크는 `/signout-with-chatgpt`로 최상위 탐색합니다. 이 경로와 `/callback`은 앱에서 구현하지 않습니다.

`/api/session`은 Sites가 검증하여 전달한 사용자 헤더를 읽고 이름과 이메일만 반환합니다. 응답은 private, no-store이며 브라우저 저장소에 인증 정보를 보관하지 않습니다. 이 서버 코드를 다른 호스팅으로 옮기면 외부 요청의 사용자 헤더를 신뢰해서는 안 됩니다. 해당 호스팅의 검증된 인증 계층으로 교체해야 합니다.

## Google·카카오 후속 설정

현재 외부 제공자 로그인은 미구현이며 버튼은 비활성 상태입니다. 설정 값만 넣어서 활성화되는 구조가 아닙니다.

1. Google Cloud에서 프로젝트와 OAuth 동의 화면 및 웹 애플리케이션 클라이언트를 등록합니다.
2. Kakao Developers에서 앱을 만들고 카카오 로그인 사용 설정을 진행합니다.
3. 외부 OAuth를 지원하는 배포 환경과 인증 방식을 확인한 뒤, 확정된 콜백 주소를 두 서비스에 등록합니다. Sites의 `/callback`은 사용하지 않습니다.
4. 클라이언트 비밀키는 저장소나 채팅에 넣지 않고 서버 비밀 환경 변수로 설정합니다.
5. 토큰 검증, state/PKCE, 세션, 로그아웃과 실제 계정 로그인을 구현·검증한 후 버튼을 활성화합니다.

공식 설정 안내: https://developers.google.com/identity/protocols/oauth2/web-server 및 https://developers.kakao.com/docs/latest/ko/kakaologin/prerequisite

관심 기업 DB 저장, 계정별 목록과 알림 발송은 아직 연결되지 않았습니다. 현재 로그인 화면은 이 상태를 명시합니다. 현재 배포 접근 권한은 소유자 전용입니다.
