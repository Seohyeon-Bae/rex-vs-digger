# 티라노 vs 포크레인

PC와 모바일에서 관전하는 3D 전투 시뮬레이터입니다.

- [GitHub에서 게임 플레이](https://seohyeon-bae.github.io/rex-vs-digger/)
- [공개 사이트에서 플레이](https://rex-vs-digger.bhj060300.chatgpt.site/)

버전: 1.9.2

수량을 정하고 전투를 시작하세요. 카메라 조작, 개체 정보, 상세 설정과 전투 기록을 지원합니다. 전투 계산은 Web Worker에서 처리합니다.

## 직접 실행

저장소를 내려받은 폴더에서 `python -m http.server 8000`을 실행하고 브라우저로 http://localhost:8000 에 접속하세요. 별도 빌드는 필요하지 않습니다. 파일을 직접 여는 대신 HTTP 서버로 실행해야 합니다.

## GitHub Pages

저장소 Settings → Pages에서 Deploy from a branch, main, /(root)를 선택하면 같은 게임을 공개할 수 있습니다. 게임 파일과 Worker는 하위 경로에서도 동작하는 상대 주소를 사용합니다.

음원의 출처와 이용 조건은 [음원 안내](assets/audio/CREDITS.txt)를 참고하세요.
