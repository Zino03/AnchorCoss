# AnchorCoss — 빗물받이 막힘 감지 대시보드

청정강원(coss) x 햄버거(앵커) 팀의 **빗물받이 막힘 감지를 위한 센서 & 오염물 거름망** 작품의 웹 대시보드입니다.

거름망에 쌓이는 쓰레기 무게를 **로드셀 2개(좌/우)**로 측정하고, 기상청 강수 정보와 함께 판정해 수거 시점을 알려줍니다.
하드웨어 완성 전에도 개발·시연할 수 있도록 **가상 데이터 생성기**로 동작하며, 실물 센서 데이터도 같은 포맷으로 연결할 수 있게 설계합니다.

> 구현 범위: 웹 대시보드만 (펌웨어·통신·모바일 앱·거름망 제작 제외)

## 상태 체계

| 상태 | 의미 |
|---|---|
| 정상 | 적재 거의 없음 |
| 주의 | 적재 진행 중 |
| 위험 (수거 필요) | 총 중량 또는 한쪽 중량이 수거 기준 초과 |
| 점검 필요 | 통신 두절 또는 센서 이상 |

보조 표시: 우천 중 · 급증 · 편중(한쪽 쏠림). 알림은 화면 배너/토스트로만 제공합니다.

## 기술 스택

React 19 · Vite 7 · Vitest 3 · Leaflet(지도) · Recharts(그래프) · JavaScript · 순수 CSS

## 시작하기

Node.js 22 이상, npm 필요.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 판정 로직 테스트
npm run build     # 배포용 빌드 (dist/)
npm run preview   # 빌드 결과 미리보기
npm run scenario  # 시나리오별 가상 데이터·정답 상태 출력
                  # 예: npm run scenario -- gradual 1  (특정 시나리오, 1분 간격)
```

## 환경변수

`.env.example`을 `.env.local`로 복사해 값을 채웁니다 (`.env.local`은 git에 올라가지 않습니다).

| 이름 | 설명 |
|---|---|
| `KMA_SERVICE_KEY` | 공공데이터포털 기상청 API 인증키 (Decoding 키) |

키가 없어도 시뮬레이터의 수동 강우 입력으로 개발·시연할 수 있습니다.

## 폴더 구조

```
api/            서버리스 함수 (기상청 프록시 /api/weather)
lib/            기상청 API 호출·파싱
scripts/        시나리오 출력 등 보조 스크립트
public/         정적 파일
src/
  components/   화면 컴포넌트
  logic/        상태 정의·판정 로직 (judge.js, states.js)
  sim/          가상 데이터 생성기 (simulator.js, scenario.js)
  config.js     지점·임계값 설정
  App.jsx, main.jsx, styles.css
```

## 구현 현황

- [x] 개발 환경 세팅 (빌드·테스트 동작 확인)
- [x] 상태 정의·임계값 설정, 데이터 계약 (`states.js`, `config.js`, `types.js`)
- [x] 가상 데이터 생성기·시나리오 8종 (`src/sim/`)
- [ ] 판정 로직 + 테스트
- [ ] 대시보드 화면
- [ ] 기상청 API 연동 (인증키 수령 후)

## 배포

Vercel에 GitHub 레포를 연결하고 환경변수 `KMA_SERVICE_KEY`를 설정합니다. 리전은 `vercel.json`에서 `icn1`(서울)로 지정되어 있습니다.

## 문서

기획서(`기획서.md`)와 디자인 가이드(`DESIGN.md`)는 현재 레포 바깥(`anchor/` 폴더)에 있습니다. 팀과 공유하려면 레포의 `docs/` 폴더로 옮기고 여기에 링크를 추가하세요.
