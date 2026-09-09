import fs from 'node:fs/promises';
import path from 'node:path';
const outputRoot=path.resolve('../../outputs');
const target=path.resolve(outputRoot,process.argv[2]||'company-day-github');
if(path.dirname(target)!==outputRoot)throw new Error('Export must be a direct child of outputs');
// Never overwrite an earlier export; preserve any user changes in that folder.
await fs.mkdir(target,{recursive:false});
const dirs=['app','components','hooks','lib','portable','cloudflare','db','drizzle','scripts','public'];
for(const dir of dirs)await fs.cp(dir,path.join(target,dir),{recursive:true,filter:source=>!source.replaceAll('\\','/').includes('/generated')});
for(const file of ['package.json','package-lock.json','tsconfig.json','README.md','CLOUDFLARE.md','LOGIN.md','DATA-SOURCES.md','.gitignore','wrangler.cloudflare.json','next.config.ts','drizzle.config.ts','components.json']) {
  await fs.copyFile(file,path.join(target,file));
}
console.log('GitHub source export:',target);
const manifest=JSON.parse(await fs.readFile(path.join(target,'package.json'),'utf8'));
Object.assign(manifest.scripts,{
  build:'node cloudflare/build.mjs',
  dev:'node cloudflare/preview.mjs',
  start:'node cloudflare/preview.mjs',
  test:'node portable/test.mjs && node cloudflare/test.mjs',
  deploy:'wrangler deploy --config wrangler.cloudflare.json'
});
await fs.writeFile(path.join(target,'package.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(target,'README.md'),`# 기업의 날

이 저장소는 실제 기업 검색 웹사이트의 전체 소스입니다. GitHub Code 화면은 이 설명 문서를 표시하며, 실제 웹사이트는 Cloudflare에서 빌드·배포한 주소로 접속합니다.

## 실행 및 검증

Node.js 24를 권장합니다.

\`\`\`sh
npm ci
npm run build
npm test
npm start
\`\`\`

브라우저에서 http://localhost:4180 으로 접속하면 은은한 파스텔 UI, 기업 검색, 무작위 기업 3곳, 기업 상세 페이지와 캘린더를 확인할 수 있습니다.

## Cloudflare Workers에 GitHub 연결

- 저장소: 비공개 유지
- 프로젝트 루트: package.json이 있는 위치
- 빌드 명령: npm run build
- 배포 명령: npm run deploy
- npm run build:cloudflare / npm run deploy:cloudflare 도 동일하게 지원합니다.
- 무료 workers.dev 주소 발급 후 PUBLIC_SITE_URL 빌드 환경 변수에 실제 HTTPS 주소(끝 슬래시 제외)를 넣고 재배포하면 사이트맵과 canonical이 생성됩니다.

ZIP 파일 자체를 저장소에 올리지 마세요. 압축 안의 app, components, lib, portable, cloudflare 등의 폴더와 package.json을 저장소 최상위에 함께 올려야 합니다. README.md만 있으면 실행 가능한 사이트가 아닙니다.

## 포함 기능과 남은 기능

- 코스피 832곳, 코스닥 1,819곳, 비상장 1곳: 총 2,652개 기업
- 한글·초성·영문·종목코드 검색과 시장 필터
- 접속·새로고침마다 무작위 기업 3곳
- 기업 정보, 법인 설립일/창립기념일 구분, 주년 및 캘린더 추가
- 모바일 화면, 최근 조회, 스타일과 JavaScript 포함
- Google·카카오 로그인 및 계정별 관심 기업 저장은 아직 연결 전입니다.
- Sites 전용 ChatGPT 로그인은 독립 Cloudflare 배포에서 제공하지 않습니다.

추가 배포 설명: [CLOUDFLARE.md](CLOUDFLARE.md). 데이터 출처: [DATA-SOURCES.md](DATA-SOURCES.md).
`);
