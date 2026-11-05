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
npm run dev:host  # 같은 와이파이의 다른 기기(센서)에서 접속 가능하게 실행
npm run fake-sensor # 센서 흉내: 수신 API로 샘플 전송 (npm run dev 실행 중일 때)
npm run db:reset  # 센서 DB 비우기 (-- --yes 로 실제 삭제, 개발 서버를 끄고 실행)
npm run scenario  # 판정 성능 비교표 (제안 방식 vs 단순 임계값)
                  # 예: npm run scenario -- gradual 1  (특정 시나리오 상세, 1분 간격)
                  #     npm run scenario -- all        (전체 상세)
```

## 환경변수

`.env.example`을 `.env.local`로 **복사**해 값을 채웁니다 (`.env.local`은 git에 올라가지 않습니다. `.env.example`은 지우지 마세요).

| 이름 | 설명 |
|---|---|
| `KMA_SERVICE_KEY` | 공공데이터포털 기상청 API 인증키 (Decoding 키) |
| `DEVICE_TOKEN` | 센서 수신 API 인증 토큰 (임의의 긴 문자열, 하드웨어팀에 전달) |
| `DB_PATH` | SQLite 파일 위치 (선택, 기본 `data/anchor.db`) |

키가 없어도 시뮬레이터의 수동 강우 입력으로 개발·시연할 수 있습니다.

## 데이터 모드 (상단바)

| 모드 | 강우 | 빗물받이 #1 (실물 지점) | 나머지 지점 |
|---|---|---|---|
| 시뮬레이션 (기본) | 시나리오 강우, 또는 "강우 수동" 슬라이더 | 가상 | 가상 |
| 실시간 | 기상청 초단기실황 1시간 강수량(RN1), 10분마다 갱신 | **서버에 수신된 센서 데이터** (3초마다 확인, 최근 1시간 복원) | 가상 |

- 실시간 모드에서 실물 데이터가 없으면 #1은 "점검 필요(수신 기록 없음)"으로 표시된다 (가짜 값을 만들지 않음).
- 실물 지점은 **실제 시계**로, 가상 지점은 시뮬레이터 시계(실제보다 빠름)로 판정한다.
- 우천 장면 시연은 시뮬레이션 모드에서 (실시간 모드는 실제 날씨를 쓰므로 맑으면 강우 0).

- 대상 지역: `src/config.js`의 `REGION` (청주 충북대 부근, 기상청 격자 68·106은 위경도로 자동 계산)
- 서버 API: `GET /api/weather[?lat=&lng=]` → `{ ok, region, nx, ny, baseDate, baseTime, rainMm, pty, ptyLabel, tempC, humidity, windMs }`
- `/api/weather`는 `npm run dev`(Vite 미들웨어)와 Vercel 배포에서만 동작합니다. `npm run preview`에서는 실시간 모드가 "연결 실패"로 표시됩니다.

## 센서 수신 서버 (로컬 전용)

SQLite(Node 내장 `node:sqlite`, Node 22.13+)에 저장한다. 파일 DB라서 **Vercel에서는 동작하지 않고**(501 응답), 시연 노트북에서 `npm run dev`로 실행한다.

```
POST /api/sensor-data
헤더  x-device-token: <DEVICE_TOKEN>
본문  { "stationId": "st-1", "ts": 1730000000000, "leftG": 312, "rightG": 287, "rssi": -58, "batteryPct": 91 }
      또는 위 객체의 배열 (재전송용, 최대 500건)
```

- `ts`는 선택 (없으면 서버 수신 시각). 초 단위도 받음. 1분 넘게 미래이거나 하루보다 오래되면 수신 시각으로 대체
- 단위는 g. 센서 이상은 음수 또는 `null`로 보내면 판정에서 "점검 필요"로 처리 (서버는 거절하지 않고 저장)
- 강우는 센서가 보내지 않음 → 서버가 수신 시점의 기상청 값을 붙여 저장
- 같은 지점·시각·값의 재전송은 중복으로 무시
- 조회: `GET /api/stations` (지점 목록), `GET /api/stations?id=st-1&since=<ms>` 또는 `&afterId=<n>`

**하드웨어와 연결할 때**
1. `npm run dev:host`로 실행 → 터미널에 표시되는 `Network: http://<노트북IP>:5173` 주소를 하드웨어팀에 전달
2. 노트북과 센서가 같은 와이파이(또는 노트북 핫스팟)에 있어야 함. Windows 방화벽에서 Node.js 접근 허용
3. 상단바에서 **실시간** 모드로 전환
4. 테스트 데이터(`npm run fake-sensor`)는 같은 DB에 쌓이므로, 발표·합동 테스트 전에 `npm run db:reset -- --yes`로 비울 것

## 폴더 구조

```
api/            API 핸들러 (weather: 기상청 프록시, sensor-data: 센서 수신, stations: 이력 조회)
server/         SQLite 저장소(db.js)·수신 검증(ingest.js)·공통 도우미(http.js)
data/           SQLite 파일 (git 제외)
lib/            기상청 API 호출·파싱·위경도→격자 변환 (kma.js)
scripts/        시나리오 출력 등 보조 스크립트
public/         정적 파일
src/
  components/   화면 컴포넌트 (TopBar, ScenarioControls, Summary, PriorityList, MapView, DrainDetail, LoadCellGauge, WeightChart, CommStatus, Timeline, Toasts, StateBadge)
  ui/           화면 표시용 순수 함수·차트 색 (format.js, colors.js)
  logic/        상태 정의·판정 로직·데이터 계약 (states.js, judge.js, evaluate.js, types.js)
  sim/          가상 데이터 생성기·엔진·화면용 훅 (scenario.js, simulator.js, engine.js, useSimulation.js)
  config.js     지점·임계값 설정
  App.jsx, main.jsx, styles.css
```

## 구현 현황

- [x] 개발 환경 세팅 (빌드·테스트 동작 확인)
- [x] 상태 정의·임계값 설정, 데이터 계약 (`states.js`, `config.js`, `types.js`)
- [x] 가상 데이터 생성기·시나리오 8종 (`src/sim/`)
- [x] 판정 로직 + 테스트, 단순 임계값 방식과 성능 비교 (`src/logic/judge.js`, `evaluate.js`)
- [x] 시뮬레이션 훅 `useSimulation` (`src/sim/engine.js`, `useSimulation.js`)
- [x] 대시보드 화면 (`docs/DESIGN.md` 기준): 상단바·시연 제어, 상태 요약, 수거 우선순위, 지도, 상세(로드셀 게이지·중량 그래프·통신 상태·타임라인), 위험 배너·토스트
- [x] 접근성 점검: 상태 글자색 대비 4.5:1 이상, 키보드 조작, 동작 줄이기 대응
- [x] 기상청 API 연동: 초단기실황 프록시 + 강우 모드(시뮬레이션/실시간) (`lib/kma.js`, `api/weather.js`, `src/sim/useWeather.js`)
- [x] 센서 수신 서버·DB: 수신 API + SQLite + 이력 조회, 실시간 모드에서 실물 지점 연동, 센서 흉내 스크립트
- [x] 임계값 하드웨어 기준 적용 (주의 250 / 2단계 500 / 위험 1000g, 로드셀 정격 1kg ×2), 30초 이동 중앙값, 1초 간격 대응 (`docs/기획서.md` 4.8·4.9)
- [ ] USB 시리얼 브리지 (Uno 시리얼 출력 → `POST /api/sensor-data`, 시리얼 출력 형식 확정 후)
- [ ] 영점(뜰채·뚜껑 무게) 처리 방식 결정 — 보류
- [ ] 판정 결과 서버 저장·일자별 통계 (후속)

## 배포

Vercel에 GitHub 레포를 연결하고 환경변수 `KMA_SERVICE_KEY`를 설정합니다. 리전은 `vercel.json`에서 `icn1`(서울)로 지정되어 있습니다.

## 문서

기획서(`기획서.md`)와 디자인 가이드(`DESIGN.md`)는 현재 레포 바깥(`anchor/` 폴더)에 있습니다. 팀과 공유하려면 레포의 `docs/` 폴더로 옮기고 여기에 링크를 추가하세요.
