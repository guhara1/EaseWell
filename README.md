# 간다GO · 경기남부 출장마사지 지역 안내 사이트

Google 검색 정책(E-E-A-T · 도움되는 콘텐츠 · 스팸 정책)을 준수하는 경기남부 생활권 허브형
정적 사이트입니다. 의존성 없는 Node.js 생성기(`build.mjs`)가 `data/*.json`을 읽어
`dist/`에 정적 HTML을 만듭니다.

## 빌드 · 미리보기

```bash
npm run build     # dist/ 생성 (HTML 140개)
npm run serve     # 빌드 후 http://localhost:4321 로 미리보기
```

빌드 결과: **HTML 140개 · sitemap 139 URL · 모든 meta description 80자 이내 · 내부링크 깨짐 0**

## 구조

```
data/
  site.json                  # 상호·전화·텔레그램·네비게이션 등 전역 설정
  gyeonggi-south/
    areas.json     (9)       # 권역
    cities.json    (18)      # 도시 (+ 행정구, 차별화 본문)
    life-areas.json(29)      # 생활권
    stations.json  (40)      # 지하철역 (환승역도 역명 기준 1개)
    use-cases.json (9)       # 이용 장소
    checks.json    (8)       # 예약 전 확인
    policies.json  (4)       # 운영 기준
src/styles/
  tokens.css                 # 프리미엄 팔레트 디자인 토큰 (Pretendard 유지)
  overlay.css                # 컴포넌트 오버레이 레이어
build.mjs                    # 생성기 (레이아웃·푸터·스키마·내부링크)
```

## 적용된 요구사항

- **푸터 오렌지 CTA** — `웹사이트 제작문의`·`제휴문의` 버튼(오렌지 그라디언트)에 텔레그램 링크.
- **상호/전화** — 상호 `간다GO`, 전화예약 `0508-202-4719`(모든 페이지 헤더·푸터·문의 페이지, `tel:` 링크).
- **Meta description 80자 이내** — 전 페이지. 초과 시 자동 절단 가드(`clampDesc`) 포함.
- **스키마(JSON-LD)** — 전 페이지 `Organization` + `WebPage` + `BreadcrumbList` + `ImageObject`,
  FAQ 페이지 `FAQPage`, 문의 페이지 `ContactPage`. 가짜 `Review`/`AggregateRating`/`LocalBusiness` 미사용.
- **프리미엄 팔레트** — 기존 토큰 시스템을 웜 잉크 + 오렌지 + 골드 프리미엄 팔레트로 교체하고
  히어로/푸터/카드 오버레이 추가. Pretendard 유지, 다크모드 대응.
- **내부링크 강화** — 메인→권역→도시→행정구→생활권→역세권→이용장소→예약전확인으로 롱테일
  앵커텍스트 연결. 메인·이용장소 페이지에 권위 있는 외부 링크(구글 지도) 포함.
- **E-E-A-T** — 전 페이지 작성자·검수자 + `Who/How/Why` 블록.
- **스팸 방지** — 지역명만 바꾼 본문 금지(도시별 차별화 본문), 환승역/출구별 분리 페이지 미생성,
  상위노출 보장·선정적·과장 표현 미사용.

## ⚠️ 배포 전 반드시 교체할 값 (`data/site.json`)

| 키 | 현재(플레이스홀더) | 설명 |
|---|---|---|
| `baseUrl` | `https://ganda-go.com` | 실제 도메인. canonical·og·sitemap에 사용 |
| `telegram.reservation` | `https://t.me/gandago_reserve` | 예약 문의 텔레그램 |
| `telegram.webBuild` | `https://t.me/gandago_web` | 웹사이트 제작문의 텔레그램 |
| `telegram.partnership` | `https://t.me/gandago_partner` | 제휴문의 텔레그램 |

값 교체 후 `npm run build` 재실행하면 전 페이지에 반영됩니다.

## 확장(1차-B/C) 로드맵

현재 1차-A 골격(메인·권역·도시·행정구·핵심 생활권·핵심 역세권·이용장소·예약전확인·운영기준)이
완성되어 있습니다. 대표 행정동/읍면동은 `data/gyeonggi-south/`에 데이터로 추가하고
템플릿을 재사용해 순차 색인합니다. 본문 품질·검색 수요가 확보되기 전에는 `noindex`로 관리해
저품질 대량 색인을 피합니다.
