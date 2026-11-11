# 노른자

편의점 입지 추천 플랫폼의 데스크톱 웹 프런트엔드입니다. Next.js App Router, TypeScript, CSS Modules를 사용합니다.

## 실행

Node.js 20.9 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

```bash
npm run typecheck
npm test
npm run build
npm start
```

## 화면

- `/`: Figma 원본 심볼의 두 부분이 모이고 워드마크가 나타나는 인트로. 약 3.5초 후 `/analysis`로 전환합니다. 건너뛰기, Escape 키, `prefers-reduced-motion`을 지원합니다.
- `/analysis`: 인트로 없이 바로 들어가는 입지 분석 화면. 데스크톱 최소 너비는 1024px입니다. 정보 패널은 별도로 스크롤되고 다음 단계 버튼은 하단에 고정됩니다.

카카오 지도를 둔산동에서 시작합니다. 검색창에서 지역·주소·건물명을 검색하고 결과를 선택하면 해당 위치로 이동합니다. 지도 위 100m × 100m 그리드를 클릭하면 여러 셀을 선택할 수 있고, 다시 클릭하면 해제됩니다. 지도 이동·확대 후에도 선택은 유지됩니다. 다른 검색 결과로 이동하거나 ‘선택 초기화’를 누르면 기존 선택을 해제합니다.

선택 전 주소·면적·통계는 `—`입니다. 선택 후에는 셀별로 고정된 가상 통계를 합산하며 화면에 ‘가상 데이터’로 표시합니다. 실제 편의점 마커는 카카오에서 현재 화면 기준으로 검색한 일부 결과이며, 가상 통계와 연동하지 않습니다. 선택한 그리드의 후보 비교부터 조건 설정·진행·결과·분석 이력까지 데모로 연결되어 있습니다. 계정·행정구역 선택은 아직 구현하지 않았습니다.

## 단계별 데모

메인 지도에서 그리드를 선택한 뒤 **다음** 버튼으로 후보 비교에 들어갑니다. **예시 영역으로 데모 시작**을 누르면 둔산동의 100m 격자 4개가 후보 A·B·C·D로 표시됩니다.

1. **후보 비교**: 선택한 그리드 하나가 후보 하나입니다. 그리드를 북쪽 행부터, 같은 행에서는 서쪽부터 A·B·C·D 순으로 표시하며 지도와 패널을 연동합니다. 5개를 넘어도 모든 선택 셀을 비교하고, Z 다음에는 AA·AB로 이어집니다. 각 후보 면적은 10,000㎡이며 후보 구성을 바꾸려면 이전 단계에서 그리드를 선택하거나 해제합니다.
2. **조건 설정**: 목적·업종·목표 매출·점포 형태·타깃·요청사항을 바꾸고 추가 옵션 금액을 합산합니다. 실제 결제나 분석 요청은 발생하지 않습니다.
3. **진행 현황**: 약 18초 동안 5개 단계와 진행률을 표시합니다. 다른 화면으로 이동하거나 새로고침해도 완료됩니다.
4. **결과 리포트**: 가상 점수·지표·추천 후보를 확인합니다. PDF 다운로드는 브라우저 인쇄 창에서 PDF로 저장하는 방식입니다. 메일 발송은 미리보기와 본문 복사만 제공하며 실제 메일을 보내지 않습니다.
5. **팀 분석 지도**: 각 100m 그리드 중심에 A·B·C 라벨과 해당 후보의 점수를 표시합니다. 지도 셀이나 왼쪽 그리드 목록을 누르면 해당 셀만 강조되고 상세 점수·좌표 디버그가 함께 바뀝니다. 분석 중·후보 상태에는 점수를 표시하지 않습니다. 같은 셀을 여러 번 분석했다면 선택한 리포트의 값이 우선이며, 그 외에는 최신 이력을 표시합니다. 필터에서 과거 리포트를 선택하면 그 시점의 그리드를 확인하고 리포트를 다시 열 수 있습니다.

화면 단계와 보고서 ID는 URL 쿼리에 기록해 뒤로가기를 지원합니다. 선택·후보·설정·리포트와 분석 지도에서 선택한 그리드는 현재 탭의 `sessionStorage`에 저장합니다. 다른 브라우저나 다른 기기와 공유되는 데이터베이스는 없습니다. 처음 제공하는 예시 이력의 ‘분석 중’ 상태는 데모 설명을 위해 유지됩니다.

핵심 파일은 `src/components/demo/`, `src/lib/demo.ts`, `src/types/demo.ts`입니다. 공통 내비게이션은 `src/components/shared/GlobalNavigation.tsx`를 사용합니다.

## 분석 요청 좌표 디버그

좌표 디버그 패널에서 현재 선택한 그리드의 요청 JSON을 확인하고 복사할 수 있습니다. 후보 비교 화면과 같은 순서로 A·B·C 라벨을 붙이며, 중복되거나 유효하지 않은 셀 ID는 제외합니다. 선택하지 않은 상태에서는 `grids`가 빈 배열입니다.

조건 설정에서 분석 요청 버튼을 누르면 그 시점의 좌표 요청을 독립적인 데모 스냅샷으로 캡처합니다. 패널에서 현재 선택과 캡처한 요청을 구분해 확인할 수 있으며 이후 선택을 바꾸어도 캡처된 좌표는 바뀌지 않습니다. 최근 요청 스냅샷은 화면의 메모리에만 보관하므로 새로고침하면 초기화됩니다. 현재 선택과 저장된 리포트의 좌표는 기존 `sessionStorage`에서 복구한 선택 영역으로 다시 확인할 수 있습니다. 아직 분석 API에 전송하지 않습니다.

`src/lib/analysis-request.ts`의 `createAnalysisGridRequest(selection)`이 `src/types/analysis-request.ts`의 요청 형식을 만듭니다. `crs`는 전송할 좌표의 WGS84 위경도 체계인 `EPSG:4326`, `gridCrs`는 원래 100m 정사각형 격자를 만든 미터 좌표계인 `EPSG:5179`입니다. 각 `southWest`와 `northEast`는 각각 투영 격자의 남서·북동 꼭지점을 WGS84로 변환한 실제 좌표(`corners[0]`, `corners[2]`)이며, 위경도 최솟값·최댓값을 조합한 지도 경계 상자가 아닙니다. 좌표는 계산된 정밀도를 그대로 유지합니다.

단일 그리드 요청 예시:

```json
{
  "crs": "EPSG:4326",
  "gridCrs": "EPSG:5179",
  "gridSizeMeters": 100,
  "grids": [
    {
      "gridId": "5179:100:9898:18171",
      "label": "A",
      "southWest": {
        "lat": 36.351255995040496,
        "lng": 127.38632091553187
      },
      "northEast": {
        "lat": 36.352158589676776,
        "lng": 127.3874341165458
      }
    }
  ]
}
```

## 카카오 설정

1. Kakao Developers에서 노른자 앱의 **카카오맵 사용 설정을 ON**으로 켭니다.
2. JavaScript 키의 SDK 도메인에 `http://localhost:3000`, `http://127.0.0.1:3000` 및 운영 도메인을 등록합니다.
3. 프로젝트 루트 `.env.local`에 아래 값을 설정합니다. 기존 파일이 있다면 덮어쓰지 않고 필요한 항목만 수정합니다.

```dotenv
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=JavaScript_키
KAKAO_REST_API_KEY=REST_API_키
```

지도 SDK는 공개 JavaScript 키를 사용합니다. REST API 키는 `/api/places` 서버 경로에서만 사용하며 브라우저에 전달하지 않습니다. `.env.local`은 Git에서 제외합니다. 운영 배포 시에는 호스팅 환경변수에도 두 값을 등록한 뒤 빌드합니다.

`OPEN_MAP_AND_LOCAL` 비활성화 오류는 앱의 카카오맵 사용 설정을 확인합니다. 지도 인증 실패는 JavaScript 키 종류와 SDK 도메인 등록을 확인합니다. 로컬 Node에서 `SELF_SIGNED_CERT_IN_CHAIN` 등 인증서 오류가 나고 macOS 시스템 인증서로 연결이 가능한 환경에서는 `NODE_EXTRA_CA_CERTS=/etc/ssl/cert.pem npm run dev`로 실행할 수 있습니다. TLS 검증을 끄지는 않습니다.

공식 문서: [지도 시작하기](https://apis.map.kakao.com/web/guide/), [Local API](https://developers.kakao.com/docs/ko/local/dev-guide), [쿼터](https://developers.kakao.com/docs/ko/getting-started/quota).

## 지도 연동 지점

- `src/components/analysis/AnalysisWorkspace.tsx`: 선택한 셀 ID, 지도 위치, 검색 결과 이동 및 패널 통계를 연결합니다. 인트로에서는 `preview` 모드로 지도 인증을 생략합니다.
- `src/components/map/KakaoMap.tsx`: 지도·그리드·편의점 마커·지역명 조회. SDK 이벤트와 오버레이를 정리하고, 확대 수준과 셀 개수에 따라 그리드 생성을 제한합니다.
- `src/lib/kakao-loader.ts`: 브라우저 SDK를 한 번 로드하며 로딩 실패·시간 초과·재시도를 처리합니다.
- `src/app/api/places/route.ts`: 키워드와 주소 검색을 병렬 호출하고 최대 8개 결과를 반환합니다. 검색 결과를 영구 저장하거나 서버 캐시하지 않습니다.
- `src/lib/grid.ts`: EPSG:5179 미터 좌표계에서 100m 셀을 생성하고 WGS84 위경도로 변환합니다. 셀 ID는 `5179:100:열:행`이며, 면적은 투영좌표 기준 셀 수 × 10,000㎡입니다. 공식 인구 격자와 동일한 원점·ID 체계라고 가정하지 않습니다.
- `src/lib/mock-analysis.ts`: 셀 ID로부터 고정된 가상값을 생성합니다. 실데이터 연결 시 이 부분을 교체합니다. 중복 셀은 한 번만 합산하고 빈 선택은 `null`입니다.
- `src/types/analysis.ts`, `src/types/map.ts`: 지도·선택 영역·검색 결과 인터페이스입니다.

`npm test`로 좌표 변환, 셀 ID 안정성, 선택 합산·중복 제거, 검색 응답·오류 처리, 옵션 합계·그리드와 후보의 1:1 대응·후보 순서와 라벨·리포트 스냅샷·진행률을 검증합니다. 좌표 요청 테스트는 후보와 요청 그리드의 대응, 원본 꼭지점 정밀도, 중복 제거와 요청 스냅샷의 독립성을 확인합니다. 분석 지도 테스트는 셀별 점수·위치, 미완료 점수 숨김, 보고서별 선택 및 중첩 이력의 우선순위를 확인합니다. 실제 타일과 지도 이벤트는 등록된 도메인의 브라우저에서 확인합니다.

## 스타일과 애니메이션

- `src/app/globals.css`: Figma 색상 토큰과 로컬 Noto Sans KR 폰트
- `src/components/intro/IntroExperience.tsx`: 인트로 유지 시간과 전환 시간
- `src/components/intro/IntroExperience.module.css`: 심볼·워드마크 애니메이션
- `public/assets/`: Figma에서 내려받은 원본 SVG. 실행 중 Figma 임시 URL에 의존하지 않습니다.

디자인 원본: [인트로](https://www.figma.com/design/agkA3qqX9Q1PXrH5OQSjwR/Archive-Develop?node-id=34-2669), [메인](https://www.figma.com/design/agkA3qqX9Q1PXrH5OQSjwR/Archive-Develop?node-id=34-2072).
