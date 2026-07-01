// =============================================================
// 간다GO · 경기남부 출장마사지 정적 사이트 생성기 (의존성 없음)
// data/*.json → dist/*.html + sitemap.xml + robots.txt
// =============================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data");
const OUT = join(__dirname, "dist");

const site = readJSON(join(DATA, "site.json"));
const areas = readJSON(join(DATA, "gyeonggi-south/areas.json"));
const cities = readJSON(join(DATA, "gyeonggi-south/cities.json"));
const lifeAreas = readJSON(join(DATA, "gyeonggi-south/life-areas.json"));
const stations = readJSON(join(DATA, "gyeonggi-south/stations.json"));
const useCases = readJSON(join(DATA, "gyeonggi-south/use-cases.json"));
const checks = readJSON(join(DATA, "gyeonggi-south/checks.json"));
const policies = readJSON(join(DATA, "gyeonggi-south/policies.json"));

const urls = []; // sitemap 수집

function readJSON(p) { return JSON.parse(readFileSync(p, "utf8")); }
function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cityBy(slug) { return cities.find(c => c.slug === slug); }
function stationBy(slug) { return stations.find(s => s.slug === slug); }
function clampDesc(s) { return s.length > 80 ? s.slice(0, 79) + "…" : s; }

// ---- 공통 블록 -------------------------------------------------
const SHARED_FAQ = [
  { q: "경기남부 전 지역 방문이 가능한가요?", a: "실제 방문 주소, 가까운 생활권, 예약 가능 시간, 이동 기준을 확인한 뒤 안내합니다." },
  { q: "수원이나 성남처럼 행정구가 있는 도시는 구까지 확인해야 하나요?", a: "같은 도시 안에서도 행정구와 생활권에 따라 이동 기준이 달라질 수 있어 함께 확인하는 것이 좋습니다." },
  { q: "용인이나 화성처럼 넓은 지역은 추가 확인이 필요한가요?", a: "외곽 읍면, 신도시, 산업지구는 방문 주소와 차량 이동 기준, 추가 이동비를 먼저 확인해야 합니다." },
  { q: "지하철역 기준으로 찾을 수 있나요?", a: "역명은 위치 설명에 도움이 되지만 실제 방문 가능 여부는 주소와 건물 출입 방식까지 함께 확인해야 합니다." },
  { q: "환승역은 노선별 페이지를 따로 만드나요?", a: "아니요. 환승역도 역명 기준 1개 페이지로 관리해 중복 페이지를 줄입니다." },
  { q: "불법·선정적 서비스도 가능한가요?", a: "불법·선정적 서비스는 제공하거나 안내하지 않습니다." }
];

function whoHowWhy(scope) {
  return `<div class="eeat">
    <div><strong>Who</strong> · 이 페이지는 ${esc(site.author.name)}가 작성하고 ${esc(site.author.reviewer)}가 검수합니다.</div>
    <div class="whw">
      <div><strong>How</strong> · ${esc(scope)}을(를) 바탕으로 구성했습니다.</div>
      <div><strong>Why</strong> · 경기남부에서 방문형 서비스를 찾는 사용자가 자신의 지역과 이용 장소를 안전하게 확인할 수 있도록 돕기 위해 작성했습니다.</div>
      <div>불법·선정적 서비스는 제공하거나 안내하지 않습니다. 가짜 후기·허위 평점을 사용하지 않습니다.</div>
    </div>
  </div>`;
}

function faqBlock(items) {
  return `<section class="faq section"><h2>자주 묻는 질문</h2>${items.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</section>`;
}

function checklistBlock(items, title = "예약 전 체크리스트") {
  return `<section class="section"><h2>${esc(title)}</h2><ul class="checklist">${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></section>`;
}

function linkCluster(title, links) {
  const valid = links.filter(Boolean);
  if (!valid.length) return "";
  return `<section class="section"><h2>${esc(title)}</h2><nav class="linkcluster" aria-label="${esc(title)}">${valid.map(l => `<a href="${l.href}">${esc(l.text)}</a>`).join("")}</nav></section>`;
}

// ---- 헤더/푸터 -------------------------------------------------
const TG_ICON = `<svg class="tg-ico" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M9.8 15.6 9.6 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.6-12.2c.3-1.2-.5-1.7-1.2-1.4L3.3 10.1c-1.1.4-1.1 1-.2 1.3l4.1 1.3 9.5-6c.4-.3.8-.1.5.2z"/></svg>`;

function header() {
  return `<header class="site-header"><div class="container bar">
    <a class="brand" href="/gyeonggi-south/">간다<span class="dot">GO</span></a>
    <nav class="nav" aria-label="주요 메뉴">${site.nav.map(n => `<a href="${n.href}">${esc(n.label)}</a>`).join("")}</nav>
    <div class="header-cta">
      <span class="tel-pill">${esc(site.phoneLabel)} <span><a href="tel:${site.phone.replace(/-/g, "")}">${esc(site.phone)}</a></span></span>
      <a class="btn btn-primary" href="${site.telegram.reservation}" rel="noopener" target="_blank">${TG_ICON} 예약 문의</a>
    </div>
  </div></header>`;
}

function footer() {
  return `<footer class="site-footer"><div class="container">
    <div class="footer-cta">
      <div>
        <h2>제작·제휴 문의는 텔레그램으로</h2>
        <p>간다GO 스타일의 지역 안내 사이트 제작, 제휴 제안을 받습니다. 아래 버튼으로 편하게 문의하세요.</p>
      </div>
      <div class="btn-row">
        <a class="btn btn-orange btn-lg" href="${site.telegram.webBuild}" rel="noopener" target="_blank">${TG_ICON} 웹사이트 제작문의</a>
        <a class="btn btn-orange btn-lg" href="${site.telegram.partnership}" rel="noopener" target="_blank">${TG_ICON} 제휴문의</a>
      </div>
    </div>
    <div class="footer-grid">
      <div class="footer-brand">
        <div class="name">상호 · ${esc(site.name)}</div>
        <div class="tel">${esc(site.phoneLabel)} <a href="tel:${site.phone.replace(/-/g, "")}">${esc(site.phone)}</a></div>
        <p class="desc">경기남부 출장마사지·홈타이 지역 안내 및 예약 전 확인 서비스. 불법·선정적 서비스는 제공하거나 안내하지 않습니다.</p>
      </div>
      <div>
        <h4>바로가기</h4>
        <ul>
          <li><a href="/gyeonggi-south/area/">권역 안내</a></li>
          <li><a href="/gyeonggi-south/city/">도시 안내</a></li>
          <li><a href="/gyeonggi-south/life/">생활권</a></li>
          <li><a href="/gyeonggi-south/station/">지하철역</a></li>
          <li><a href="/gyeonggi-south/use/">이용 장소</a></li>
        </ul>
      </div>
      <div>
        <h4>이용 안내</h4>
        <ul>
          <li><a href="/gyeonggi-south/check/">예약 전 확인</a></li>
          <li><a href="/gyeonggi-south/policy/privacy-policy/">개인정보 처리방침</a></li>
          <li><a href="/gyeonggi-south/policy/service-standard/">불법·선정적 서비스 불가 안내</a></li>
          <li><a href="/gyeonggi-south/policy/authors/">작성자·검수자 안내</a></li>
          <li><a href="/gyeonggi-south/contact/">문의하기</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      © ${site.name} · 경기남부 지역 안내 · 전화예약 ${esc(site.phone)} ·
      <a href="/gyeonggi-south/policy/privacy-policy/">개인정보처리방침</a> ·
      <a href="/gyeonggi-south/policy/service-standard/">서비스 정책</a>
    </div>
  </div></footer>
  <div class="sticky-cta">
    <a class="btn btn-ghost btn-block" href="tel:${site.phone.replace(/-/g, "")}">📞 ${esc(site.phone)}</a>
    <a class="btn btn-primary btn-block" href="${site.telegram.reservation}" rel="noopener" target="_blank">${TG_ICON} 예약 문의</a>
  </div>`;
}

// ---- Schema (JSON-LD) -----------------------------------------
function orgSchema() {
  return {
    "@type": "Organization",
    "@id": site.baseUrl + "/#organization",
    name: site.name,
    description: site.org.description,
    url: site.baseUrl + "/gyeonggi-south/",
    telephone: site.phone,
    areaServed: site.org.areaServed,
    sameAs: [site.telegram.reservation]
  };
}
function breadcrumbSchema(crumbs) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem", position: i + 1, name: c.name,
      item: c.href ? site.baseUrl + c.href : undefined
    }))
  };
}
function webPageSchema(p) {
  return {
    "@type": "WebPage",
    "@id": site.baseUrl + p.canonical + "#webpage",
    url: site.baseUrl + p.canonical,
    name: p.title,
    description: p.description,
    inLanguage: "ko-KR",
    isPartOf: { "@id": site.baseUrl + "/#organization" },
    author: { "@type": "Person", name: site.author.name },
    reviewedBy: { "@type": "Person", name: site.author.reviewer }
  };
}
function faqSchema(items) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map(f => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a }
    }))
  };
}
function imageObjectSchema(ogPath, alt) {
  return { "@type": "ImageObject", url: site.baseUrl + ogPath, caption: alt };
}

// ---- 레이아웃 --------------------------------------------------
function crumbsHtml(crumbs) {
  return `<nav class="crumbs" aria-label="breadcrumb">${crumbs.map((c, i) => {
    const last = i === crumbs.length - 1;
    const sep = i > 0 ? " › " : "";
    return sep + (last || !c.href ? `<span aria-current="page">${esc(c.name)}</span>` : `<a href="${c.href}">${esc(c.name)}</a>`);
  }).join("")}</nav>`;
}

function layout(p) {
  const ogImage = p.ogImage || "/assets/og-default.svg";
  const alt = p.ogAlt || (p.h1 + " 안내 이미지");
  const schema = [orgSchema(), webPageSchema(p), breadcrumbSchema(p.breadcrumb), imageObjectSchema(ogImage, alt), ...(p.extraSchema || [])];
  const graph = { "@context": "https://schema.org", "@graph": schema };
  const canonicalAbs = site.baseUrl + p.canonical;
  urls.push({ loc: canonicalAbs, noindex: !!p.noindex });
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(clampDesc(p.description))}">
${p.noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<link rel="canonical" href="${canonicalAbs}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(clampDesc(p.description))}">
<meta property="og:url" content="${canonicalAbs}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:image" content="${site.baseUrl}${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="format-detection" content="telephone=yes">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
<a class="skip-link" href="#main">본문 바로가기</a>
${header()}
<main id="main" class="container">
${crumbsHtml(p.breadcrumb)}
${p.body}
</main>
${footer()}
</body>
</html>`;
}

function write(path, html) {
  const full = join(OUT, path, "index.html");
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
}

// ---- 페이지 생성 ----------------------------------------------
function buildHome() {
  const areaCards = areas.map(a => `<a class="card" href="/gyeonggi-south/area/${a.slug}/"><h3>${esc(a.name)}</h3><p>${esc(a.lead)}</p><div class="meta">${a.cityNames.slice(0, 4).map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></a>`).join("");
  const cityCards = cities.map(c => `<a class="card" href="/gyeonggi-south/city/${c.slug}/"><h3>${esc(c.name)}</h3><p>${esc(c.lifeAreas.slice(0, 3).join(" · "))}</p><div class="meta">${c.stations.slice(0, 3).map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div></a>`).join("");
  const lifeCards = lifeAreas.slice(0, 12).map(l => `<a class="card" href="/gyeonggi-south/life/${l.slug}/"><h3>${esc(l.name)}</h3><p>${esc(l.type)} · ${esc(l.cityName)}</p></a>`).join("");
  const body = `
  <section class="hero">
    <span class="eyebrow">경기남부 · 도시별 생활권 안내</span>
    <h1>경기남부 출장마사지 · 도시별·생활권별 지역 안내</h1>
    <p class="lead">수원, 성남, 용인, 화성, 오산, 평택, 안양, 안산, 시흥 등 경기남부 주요 도시와 생활권, 지하철역, 자택·호텔·오피스텔 이용 전 확인사항을 안내합니다.</p>
    <div class="cta-row">
      <a class="btn btn-primary btn-lg" href="/gyeonggi-south/city/">도시 안내</a>
      <a class="btn btn-ghost btn-lg" href="/gyeonggi-south/life/">생활권 보기</a>
      <a class="btn btn-ghost btn-lg" href="/gyeonggi-south/station/">지하철역 보기</a>
      <a class="btn btn-ghost btn-lg" href="/gyeonggi-south/check/">예약 전 확인</a>
    </div>
  </section>

  <section class="section">
    <span class="eyebrow">왜 도시별로 다를까</span>
    <h2>경기남부 출장마사지는 도시 이름만으로 판단하기 어렵습니다</h2>
    <p class="lead">경기남부는 서울과 가까운 도시, 신도시, 산업지구, 외곽 이동권이 함께 있는 넓은 지역입니다. 수원은 행정구와 역세권이, 성남은 분당·판교와 수정·중원 생활권이 다르고, 용인은 수지·기흥·처인의 이동 기준이 다릅니다. 화성은 동탄신도시와 병점·봉담·향남의 생활권이 다르며, 오산·평택은 남단 역세권과 차량 이동 기준을 함께 확인해야 합니다. 안양·군포·의왕·과천은 서울 인접 지하철 생활권이 강하고, 안산·시흥은 산업지구와 주거 생활권을 분리해서 봐야 합니다.</p>
  </section>

  <section class="section">
    <h2>권역별로 빠르게 찾기</h2>
    <div class="grid grid-3">${areaCards}</div>
  </section>

  <section class="section">
    <h2>경기남부 주요 도시 안내</h2>
    <div class="grid grid-3">${cityCards}</div>
  </section>

  <section class="section">
    <h2>경기남부 주요 생활권</h2>
    <div class="grid grid-4">${lifeCards}</div>
    <p style="margin-top:16px"><a href="/gyeonggi-south/life/">생활권 전체 보기 →</a></p>
  </section>

  ${checklistBlock([
    "방문 주소를 정확히 확인했나요?", "도시와 행정구, 행정동이 정확한가요?",
    "가까운 생활권과 지하철역을 확인했나요?", "신도시·산업지구·외곽 지역 중 어디에 해당하나요?",
    "공동현관 또는 건물 출입 방식이 있나요?", "호텔·숙소 이용 가능 여부를 확인했나요?",
    "오피스텔 관리 규정이 있나요?", "외곽 지역 추가 이동비가 필요한가요?",
    "개인정보 처리 기준을 확인했나요?", "불법·선정적 서비스 불가 안내를 확인했나요?"
  ], "예약 전 확인해야 할 내용")}

  ${linkCluster("도움되는 정보 · 관련 링크", [
    { href: "/gyeonggi-south/use/home/", text: "자택 이용 전 확인" },
    { href: "/gyeonggi-south/use/officetel/", text: "오피스텔 이용 전 확인" },
    { href: "/gyeonggi-south/use/hotel/", text: "호텔·숙소 이용 전 확인" },
    { href: "/gyeonggi-south/check/travel-fee/", text: "추가 이동비 기준" },
    { href: "/gyeonggi-south/policy/service-standard/", text: "불법·선정적 서비스 불가 안내" },
    { href: "https://www.google.com/maps/place/경기도", text: "경기도 지도(구글) 위치 확인" }
  ])}

  ${faqBlock(SHARED_FAQ)}
  ${whoHowWhy("경기남부 주요 도시, 행정구, 행정동, 생활권, 지하철역, 신도시·산업지구·외곽 이동 기준")}
  `;
  const page = {
    title: `경기남부 출장마사지｜수원·성남·용인·화성·오산 홈타이 생활권 안내`,
    description: "경기남부 출장마사지·홈타이 예약 전 주요 도시·생활권·지하철역 확인사항 안내.",
    canonical: "/gyeonggi-south/",
    h1: "경기남부 출장마사지",
    breadcrumb: [{ name: "경기남부 홈", href: "/gyeonggi-south/" }],
    extraSchema: [faqSchema(SHARED_FAQ)],
    body
  };
  const html = layout(page);
  write("gyeonggi-south", html);
  // 루트 index → 메인으로 canonical 지정 후 이동 (중복 색인 방지)
  const root = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${esc(page.title)}</title>
<link rel="canonical" href="${site.baseUrl}/gyeonggi-south/">
<meta http-equiv="refresh" content="0; url=/gyeonggi-south/">
<meta name="robots" content="noindex,follow"></head>
<body><p><a href="/gyeonggi-south/">경기남부 출장마사지 안내로 이동</a></p></body></html>`;
  const rootFull = join(OUT, "index.html");
  writeFileSync(rootFull, root);
}

function buildAreaIndex() {
  const body = `<div class="section"><span class="eyebrow">권역 안내</span><h1>경기남부 권역 안내</h1>
    <p class="lead">경기남부를 생활권 중심으로 9개 권역으로 나누어 안내합니다. 포함 도시와 대표 생활권, 이동 기준을 확인하세요.</p>
    <div class="grid grid-3">${areas.map(a => `<a class="card" href="/gyeonggi-south/area/${a.slug}/"><h3>${esc(a.name)}</h3><p>${esc(a.lead)}</p><div class="meta">${a.cityNames.slice(0, 4).map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 권역별 포함 도시와 대표 생활권, 이동 기준")}`;
  write("gyeonggi-south/area", layout({
    title: "경기남부 권역 안내｜9개 생활권 권역 | 간다GO",
    description: "경기남부 출장마사지 9개 권역별 포함 도시·대표 생활권·이동 기준 안내.",
    canonical: "/gyeonggi-south/area/", h1: "경기남부 권역 안내",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "권역 안내", href: "/gyeonggi-south/area/" }],
    body
  }));
}

function buildAreas() {
  for (const a of areas) {
    const cityLinks = a.cities.map(cityBy).filter(Boolean).map(c => ({ href: `/gyeonggi-south/city/${c.slug}/`, text: `${c.name} 안내` }));
    const lifeLinks = lifeAreas.filter(l => a.cities.includes(l.city)).map(l => ({ href: `/gyeonggi-south/life/${l.slug}/`, text: `${l.name} 생활권` }));
    const stationLinks = stations.filter(s => a.cities.includes(s.city)).slice(0, 8).map(s => ({ href: `/gyeonggi-south/station/${s.slug}/`, text: s.name }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">${esc(a.name)}</span>
      <h1>${esc(a.name)} 출장마사지 · 경기남부 생활권 안내</h1>
      <p class="lead">${esc(a.lead)}</p>
      <h2>권역 개요</h2><p>${esc(a.intro)}</p>
      <h2>이동 기준</h2><p>${esc(a.move)}</p>
    </div>
    ${linkCluster("포함 도시", cityLinks)}
    ${linkCluster("대표 생활권", lifeLinks)}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${checklistBlock(["방문 주소와 행정구·행정동을 확인했나요?", "신도시·산업지구·외곽 중 어디인가요?", "가까운 생활권과 지하철역을 확인했나요?", "외곽 지역 추가 이동비가 필요한가요?", "개인정보 처리 기준을 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/gyeonggi-south/use/officetel/", text: "오피스텔 이용 전 확인" },
      { href: "/gyeonggi-south/use/hotel/", text: "호텔·숙소 이용 전 확인" },
      { href: "/gyeonggi-south/check/address/", text: "방문 주소 확인" },
      { href: "/gyeonggi-south/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${a.name} 포함 도시, 대표 생활권, 지하철역, 이동 기준`)}`;
    write(`gyeonggi-south/area/${a.slug}`, layout({
      title: `${a.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
      description: a.metaDescription,
      canonical: `/gyeonggi-south/area/${a.slug}/`, h1: `${a.name} 출장마사지`,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "권역 안내", href: "/gyeonggi-south/area/" }, { name: a.name, href: `/gyeonggi-south/area/${a.slug}/` }],
      body
    }));
  }
}

function buildCityIndex() {
  const body = `<div class="section"><span class="eyebrow">도시 안내</span><h1>경기남부 도시 안내</h1>
    <p class="lead">경기남부 18개 주요 도시를 안내합니다. 행정구가 있는 도시는 도시 → 행정구 → 생활권 구조로 확인하세요.</p>
    <div class="grid grid-3">${cities.map(c => `<a class="card" href="/gyeonggi-south/city/${c.slug}/"><h3>${esc(c.name)}</h3><p>${esc(c.region)} · ${esc(c.lifeAreas.slice(0, 2).join(", "))}</p><div class="meta">${(c.districts.length ? c.districts.map(d => `<span class="tag">${esc(d.name)}</span>`) : c.lifeAreas.slice(0, 3).map(l => `<span class="tag">${esc(l)}</span>`)).join("")}</div></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 18개 도시별 행정구·생활권·역세권 안내")}`;
  write("gyeonggi-south/city", layout({
    title: "경기남부 도시 안내｜18개 주요 도시 | 간다GO",
    description: "경기남부 출장마사지 수원·성남·용인 등 18개 도시별 행정구·생활권 안내.",
    canonical: "/gyeonggi-south/city/", h1: "경기남부 도시 안내",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "도시 안내", href: "/gyeonggi-south/city/" }],
    body
  }));
}

function buildCities() {
  for (const c of cities) {
    const districtLinks = c.districts.map(d => ({ href: `/gyeonggi-south/city/${c.slug}/${d.slug}/`, text: `${c.name} ${d.name}` }));
    const lifeLinks = lifeAreas.filter(l => l.city === c.slug).map(l => ({ href: `/gyeonggi-south/life/${l.slug}/`, text: `${l.name} 생활권` }));
    const stationLinks = stations.filter(s => s.city === c.slug).map(s => ({ href: `/gyeonggi-south/station/${s.slug}/`, text: s.name }));
    const adjLinks = c.adjacent.map(a => ({ href: `/gyeonggi-south/city/${a.slug}/`, text: `${a.name} 안내` }));
    const districtSection = c.districts.length ? `<h2>행정구별 생활권</h2><ul>${c.districts.map(d => `<li><a href="/gyeonggi-south/city/${c.slug}/${d.slug}/"><strong>${esc(d.name)}</strong></a> — ${esc(d.note)}</li>`).join("")}</ul>` : "";
    const body = `
    <div class="prose section">
      <span class="eyebrow">${esc(c.region)}</span>
      <h1>${esc(c.name)} 출장마사지 · 생활권·역세권 지역 안내</h1>
      <p class="lead">${esc(c.intro)}</p>
      ${districtSection}
      <h2>대표 생활권</h2><p>${esc(c.living)}</p>
      <h2>가까운 역·인접 지역</h2><p>${esc(c.access)}</p>
      <h2>이용 장소별 기준</h2>
      <p>자택은 공동현관·엘리베이터·주차 여부를, 오피스텔은 방문자 등록과 관리 규정을, 호텔·숙소는 외부인 방문 정책과 객실 출입 방식을 먼저 확인합니다. 신도시·업무지구는 동·호수와 보안 규정을, 외곽·산업지구는 차량 이동 거리와 추가 이동비, 예약 가능 시간을 확인하는 것이 좋습니다.</p>
      <h2>안내 방향</h2><p>${esc(c.focus)}</p>
    </div>
    ${linkCluster("대표 생활권 바로가기", lifeLinks)}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${linkCluster("인접 도시", adjLinks.concat([{ href: `/gyeonggi-south/area/${c.regionSlug}/`, text: `${c.region} 권역` }]))}
    ${checklistBlock([
      `${c.name}의 정확한 방문 주소를 확인했나요?`,
      c.districts.length ? "행정구와 행정동이 정확한가요?" : "행정동과 생활권이 정확한가요?",
      "가까운 생활권과 지하철역을 확인했나요?",
      "신도시·산업지구·외곽 지역 중 어디에 해당하나요?",
      "공동현관·건물 출입 방식을 확인했나요?",
      "외곽 지역 추가 이동비가 필요한가요?",
      "개인정보 처리 기준과 서비스 정책을 확인했나요?"
    ])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/gyeonggi-south/use/home/", text: "자택 이용 전 확인" },
      { href: "/gyeonggi-south/use/officetel/", text: "오피스텔 이용 전 확인" },
      { href: "/gyeonggi-south/use/hotel/", text: "호텔·숙소 이용 전 확인" },
      { href: "/gyeonggi-south/check/address/", text: "방문 주소 확인" },
      { href: "/gyeonggi-south/check/service-policy/", text: "불법·선정적 서비스 불가 안내" },
      { href: "/gyeonggi-south/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ)}
    ${whoHowWhy(`${c.name} 행정구·행정동·생활권·역세권과 이용 장소별 확인사항`)}`;
    write(`gyeonggi-south/city/${c.slug}`, layout({
      title: `${c.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
      description: c.metaDescription,
      canonical: `/gyeonggi-south/city/${c.slug}/`, h1: `${c.name} 출장마사지`,
      ogAlt: `${c.name} ${c.lifeAreas[0]} 생활권 방문형 관리 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "도시 안내", href: "/gyeonggi-south/city/" }, { name: c.name, href: `/gyeonggi-south/city/${c.slug}/` }],
      body
    }));
    // 행정구 페이지
    for (const d of c.districts) buildDistrict(c, d);
  }
}

function buildDistrict(c, d) {
  const siblingLinks = c.districts.filter(x => x.slug !== d.slug).map(x => ({ href: `/gyeonggi-south/city/${c.slug}/${x.slug}/`, text: `${c.name} ${x.name}` }));
  const lifeLinks = lifeAreas.filter(l => l.city === c.slug && (l.districts || []).includes(d.name)).map(l => ({ href: `/gyeonggi-south/life/${l.slug}/`, text: `${l.name} 생활권` }));
  const stationLinks = stations.filter(s => s.city === c.slug && s.district === d.name).map(s => ({ href: `/gyeonggi-south/station/${s.slug}/`, text: s.name }));
  const body = `
  <div class="prose section">
    <span class="eyebrow">${esc(c.name)} · 행정구 안내</span>
    <h1>${esc(c.name)} ${esc(d.name)} 출장마사지 · ${esc(d.note.split(" ")[0])} 생활권 안내</h1>
    <p class="lead">${esc(c.name)} ${esc(d.name)}은(는) ${esc(d.note)}을(를) 중심으로 하는 생활권입니다. 같은 ${esc(c.name)} 안에서도 행정구별로 이동 기준과 이용 환경이 달라, 방문 주소와 함께 행정구·생활권을 확인하는 것이 정확합니다.</p>
    <h2>상위 도시</h2><p><a href="/gyeonggi-south/city/${c.slug}/">${esc(c.name)} 전체 안내</a>에서 다른 행정구와 도시 전체 생활권을 함께 확인할 수 있습니다. ${esc(c.name)}은(는) ${esc(c.region)}에 속합니다.</p>
    <h2>대표 생활권</h2><p>${esc(d.note)} 생활권을 중심으로 오피스텔·상권·주거지가 형성되어 있습니다. 이용 장소가 자택·오피스텔·숙소인지에 따라 공동현관과 출입 방식 확인이 먼저 필요합니다.</p>
    <h2>이용 장소별 기준</h2><p>오피스텔은 공동현관·엘리베이터·관리 규정과 방문 가능 시간을, 상권·업무지구는 건물 보안 규정과 예약 가능 시간을, 주거지는 공동현관 출입 방식을 확인하는 것이 좋습니다.</p>
  </div>
  ${linkCluster("같은 도시 다른 행정구", siblingLinks)}
  ${linkCluster("관련 생활권", lifeLinks.length ? lifeLinks : lifeAreas.filter(l => l.city === c.slug).slice(0, 3).map(l => ({ href: `/gyeonggi-south/life/${l.slug}/`, text: `${l.name} 생활권` })))}
  ${linkCluster("가까운 지하철역", stationLinks)}
  ${checklistBlock(["방문 주소와 행정동을 확인했나요?", "가까운 생활권과 지하철역을 확인했나요?", "공동현관·건물 출입 방식을 확인했나요?", "예약 가능 시간을 확인했나요?", "개인정보 처리 기준을 확인했나요?"])}
  ${linkCluster("예약 전 확인", [
    { href: "/gyeonggi-south/check/address/", text: "방문 주소 확인" },
    { href: "/gyeonggi-south/check/building-access/", text: "건물 출입 방식" },
    { href: "/gyeonggi-south/contact/", text: "문의하기" }
  ])}
  ${faqBlock(SHARED_FAQ.slice(0, 4))}
  ${whoHowWhy(`${c.name} ${d.name} 대표 행정동·생활권·역세권과 이용 장소별 확인사항`)}`;
  write(`gyeonggi-south/city/${c.slug}/${d.slug}`, layout({
    title: `${c.name} ${d.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
    description: clampDesc(`${c.name} ${d.name} 출장마사지·홈타이 예약 전 ${d.note} 생활권 확인 안내.`),
    canonical: `/gyeonggi-south/city/${c.slug}/${d.slug}/`, h1: `${c.name} ${d.name} 출장마사지`,
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "도시 안내", href: "/gyeonggi-south/city/" }, { name: c.name, href: `/gyeonggi-south/city/${c.slug}/` }, { name: d.name, href: `/gyeonggi-south/city/${c.slug}/${d.slug}/` }],
    body
  }));
}

function buildLifeIndex() {
  const body = `<div class="section"><span class="eyebrow">생활권</span><h1>경기남부 주요 생활권</h1>
    <p class="lead">신도시·역세권·업무지구·산업지구·주거·외곽 생활권을 도시와 함께 안내합니다.</p>
    <div class="grid grid-3">${lifeAreas.map(l => `<a class="card" href="/gyeonggi-south/life/${l.slug}/"><h3>${esc(l.name)}</h3><p>${esc(l.type)} · ${esc(l.cityName)}</p></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 신도시·역세권·산업지구·외곽 생활권 안내")}`;
  write("gyeonggi-south/life", layout({
    title: "경기남부 생활권 안내｜신도시·역세권·산업권 | 간다GO",
    description: "경기남부 출장마사지 신도시·역세권·산업지구·외곽 생활권별 확인 안내.",
    canonical: "/gyeonggi-south/life/", h1: "경기남부 주요 생활권",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "생활권", href: "/gyeonggi-south/life/" }],
    body
  }));
}

function buildLifeAreas() {
  for (const l of lifeAreas) {
    const c = cityBy(l.city);
    const stationLinks = (l.stations || []).map(stationBy).filter(Boolean).map(s => ({ href: `/gyeonggi-south/station/${s.slug}/`, text: s.name }));
    const neighbors = lifeAreas.filter(x => x.city === l.city && x.slug !== l.slug).slice(0, 4).map(x => ({ href: `/gyeonggi-south/life/${x.slug}/`, text: `${x.name} 생활권` }));
    const dongTags = (l.dongs || []).map(d => `<span class="tag">${esc(d)}</span>`).join("");
    const body = `
    <div class="prose section">
      <span class="eyebrow">${esc(l.cityName)} · ${esc(l.type)}</span>
      <h1>${esc(l.name)} 출장마사지 생활권 안내</h1>
      <p class="lead">${esc(l.note)}</p>
      <div class="meta" style="margin-bottom:16px">${dongTags}</div>
      <h2>생활권 개요</h2>
      <p>${esc(l.name)}은(는) ${esc(l.cityName)}${(l.districts && l.districts.length) ? ` ${l.districts.join("·")}` : ""}에 속하는 ${esc(l.type)} 생활권입니다. ${esc(l.note)} 포함 행정동으로는 ${esc((l.dongs || []).join(", "))} 등이 있습니다.</p>
      <h2>가까운 역·이용 장소</h2>
      <p>${stationLinks.length ? `대표 역세권은 ${esc((l.stations || []).map(s => stationBy(s)?.name).filter(Boolean).join(", "))}입니다. ` : "지하철 접근보다 차량 이동 기준이 중요한 생활권입니다. "}이용 장소가 자택·오피스텔·숙소·업무지구인지에 따라 공동현관과 출입 방식, 예약 가능 시간을 먼저 확인하는 것이 좋습니다.</p>
      <h2>이용 장소별 기준</h2>
      <p>신도시·오피스텔은 동·호수와 공동현관·관리 규정을, 역세권 상권은 숙소·건물 출입 방식을, 산업·외곽은 차량 이동 거리와 추가 이동비를 확인합니다.</p>
    </div>
    ${linkCluster("포함 도시·행정구", [{ href: `/gyeonggi-south/city/${l.city}/`, text: `${l.cityName} 안내` }].concat((l.districts || []).map(d => {
      const dobj = (c?.districts || []).find(x => x.name === d);
      return dobj ? { href: `/gyeonggi-south/city/${l.city}/${dobj.slug}/`, text: `${l.cityName} ${d}` } : null;
    })))}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${linkCluster("인접 생활권", neighbors)}
    ${checklistBlock(["방문 주소와 동·호수를 확인했나요?", "공동현관·건물 출입 방식을 확인했나요?", "가까운 지하철역·이동 기준을 확인했나요?", "신도시·산업·외곽 중 어디인가요?", "예약 가능 시간과 추가 이동비를 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/gyeonggi-south/use/officetel/", text: "오피스텔 이용" },
      { href: "/gyeonggi-south/use/newtown/", text: "신도시 생활권 이용" },
      { href: "/gyeonggi-south/check/address/", text: "방문 주소 확인" },
      { href: "/gyeonggi-south/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${l.name} 포함 도시·행정동·역세권과 이용 장소별 확인사항`)}`;
    write(`gyeonggi-south/life/${l.slug}`, layout({
      title: `${l.name} 출장마사지 생활권 안내 | 간다GO`,
      description: clampDesc(`${l.name} 출장마사지·홈타이 예약 전 ${l.cityName} ${l.type} 생활권 확인 안내.`),
      canonical: `/gyeonggi-south/life/${l.slug}/`, h1: `${l.name} 생활권`,
      ogAlt: `${l.name} 생활권 예약 전 확인 이미지`,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "생활권", href: "/gyeonggi-south/life/" }, { name: l.name, href: `/gyeonggi-south/life/${l.slug}/` }],
      body
    }));
  }
}

function buildStationIndex() {
  const byCity = {};
  for (const s of stations) (byCity[s.cityName] ||= []).push(s);
  const groups = Object.entries(byCity).map(([city, list]) => `<div class="card"><h3>${esc(city)}</h3><nav class="linkcluster">${list.map(s => `<a href="/gyeonggi-south/station/${s.slug}/">${esc(s.name)}</a>`).join("")}</nav></div>`).join("");
  const body = `<div class="section"><span class="eyebrow">지하철역</span><h1>경기남부 주요 지하철역</h1>
    <p class="lead">역명 기준으로 위치를 안내합니다. 환승역도 노선별로 나누지 않고 역명 기준 1개 페이지로 관리합니다.</p>
    <div class="grid grid-2">${groups}</div></div>
    ${whoHowWhy("경기남부 도시별 주요 지하철역과 인접 생활권 안내")}`;
  write("gyeonggi-south/station", layout({
    title: "경기남부 지하철역 안내｜역세권 생활권 | 간다GO",
    description: "경기남부 출장마사지 주요 지하철역별 역세권 생활권·이동 기준 안내.",
    canonical: "/gyeonggi-south/station/", h1: "경기남부 주요 지하철역",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "지하철역", href: "/gyeonggi-south/station/" }],
    body
  }));
}

function buildStations() {
  for (const s of stations) {
    const c = cityBy(s.city);
    const life = lifeAreas.find(l => l.name === s.life);
    const sameCity = stations.filter(x => x.city === s.city && x.slug !== s.slug).slice(0, 5).map(x => ({ href: `/gyeonggi-south/station/${x.slug}/`, text: x.name }));
    const transferNote = s.transfer ? `${s.name}은(는) 환승 성격이 있는 역이지만, 출구별·노선별로 페이지를 나누지 않고 역명 기준 한 곳으로 안내해 중복을 줄입니다.` : `${s.name}은(는) 역명 기준으로 위치를 안내합니다.`;
    const body = `
    <div class="prose section">
      <span class="eyebrow">${esc(s.cityName)}${s.district ? " · " + esc(s.district) : ""} 역세권</span>
      <h1>${esc(s.name)} 출장마사지 · 역세권 생활권 안내</h1>
      <p class="lead">${esc(s.note)}</p>
      <h2>역세권 개요</h2>
      <p>${esc(s.name)}은(는) ${esc(s.cityName)}${s.district ? " " + esc(s.district) : ""} ${esc((s.dongs || []).join("·"))} 인근의 역세권으로, ${esc(s.life)} 생활권과 이어집니다. 역명은 위치를 설명하는 데 도움이 되지만 실제 방문 가능 여부는 정확한 주소와 건물 출입 방식까지 함께 확인해야 합니다.</p>
      <h2>환승·출구 안내</h2><p>${esc(transferNote)} 출구 방향은 참고용이며 건물 주소로 확인합니다.</p>
      <h2>이용 장소별 기준</h2>
      <p>역 주변 오피스텔은 공동현관·관리 규정을, 숙소는 외부인 방문 정책과 객실 출입 방식을, 상권 건물은 보안·예약 가능 시간을 확인합니다.</p>
    </div>
    ${linkCluster("상위 도시·생활권", [{ href: `/gyeonggi-south/city/${s.city}/`, text: `${s.cityName} 안내` }, life ? { href: `/gyeonggi-south/life/${life.slug}/`, text: `${life.name} 생활권` } : null])}
    ${linkCluster("같은 도시 다른 역", sameCity)}
    ${checklistBlock(["역명이 아닌 정확한 방문 주소를 확인했나요?", "건물 공동현관·출입 방식을 확인했나요?", "가까운 생활권을 확인했나요?", "예약 가능 시간을 확인했나요?", "개인정보 처리 기준을 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/gyeonggi-south/use/station-area/", text: "역세권 이용" },
      { href: "/gyeonggi-south/use/hotel/", text: "호텔·숙소 이용" },
      { href: "/gyeonggi-south/check/building-access/", text: "건물 출입 방식" },
      { href: "/gyeonggi-south/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(3, 6))}
    ${whoHowWhy(`${s.name} 인접 생활권·행정동과 이용 장소별 확인사항`)}`;
    write(`gyeonggi-south/station/${s.slug}`, layout({
      title: `${s.name} 출장마사지 역세권 안내 | 간다GO`,
      description: clampDesc(`${s.name} 출장마사지·홈타이 예약 전 ${s.cityName} ${s.life} 역세권 확인 안내.`),
      canonical: `/gyeonggi-south/station/${s.slug}/`, h1: `${s.name} 출장마사지`,
      ogAlt: `${s.name} 역세권 생활권 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "지하철역", href: "/gyeonggi-south/station/" }, { name: s.name, href: `/gyeonggi-south/station/${s.slug}/` }],
      body
    }));
  }
}

function buildUseIndex() {
  const body = `<div class="section"><span class="eyebrow">이용 장소</span><h1>이용 장소별 안내</h1>
    <p class="lead">자택·호텔·오피스텔·업무지구·역세권·신도시·산업지구·야간·외곽 이용 전 확인사항을 안내합니다.</p>
    <div class="grid grid-3">${useCases.map(u => `<a class="card" href="/gyeonggi-south/use/${u.slug}/"><h3>${esc(u.name)}</h3><p>${esc(u.why)}</p></a>`).join("")}</div></div>
    ${whoHowWhy("이용 장소별 방문 전 확인사항 안내")}`;
  write("gyeonggi-south/use", layout({
    title: "경기남부 이용 장소별 안내｜자택·호텔·오피스텔 | 간다GO",
    description: "경기남부 출장마사지 자택·호텔·오피스텔·업무지구 등 이용 장소별 확인 안내.",
    canonical: "/gyeonggi-south/use/", h1: "이용 장소별 안내",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "이용 장소", href: "/gyeonggi-south/use/" }],
    body
  }));
}

function buildUseCases() {
  for (const u of useCases) {
    const cityLinks = cities.slice(0, 9).map(c => ({ href: `/gyeonggi-south/city/${c.slug}/`, text: `${c.name} 안내` }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">이용 장소</span>
      <h1>${esc(u.h1)}</h1>
      <p class="lead">${esc(u.why)}</p>
      <h2>확인해야 할 내용</h2>
      <ul class="checklist">${u.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      <h2>지역별 참고</h2>
      <p>경기남부는 도시와 생활권에 따라 이용 환경이 다릅니다. 판교·광교·동탄·미사·배곧 등 신도시 오피스텔권과 수원역·평택역 등 상권, 반월·시화·고덕 산업권은 확인 항목이 서로 다르므로 방문 지역의 생활권을 함께 확인하는 것이 좋습니다.</p>
    </div>
    ${linkCluster("도시별 안내", cityLinks)}
    ${linkCluster("예약 전 확인", checks.slice(0, 5).map(ch => ({ href: `/gyeonggi-south/check/${ch.slug}/`, text: ch.name })))}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${u.name} 방문 전 확인사항과 경기남부 지역별 이용 기준`)}`;
    write(`gyeonggi-south/use/${u.slug}`, layout({
      title: `${u.h1} | 간다GO`,
      description: u.metaDescription,
      canonical: `/gyeonggi-south/use/${u.slug}/`, h1: u.h1,
      ogAlt: `${u.name} 이용 기준 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "이용 장소", href: "/gyeonggi-south/use/" }, { name: u.name, href: `/gyeonggi-south/use/${u.slug}/` }],
      body
    }));
  }
}

function buildCheckIndex() {
  const body = `<div class="section"><span class="eyebrow">예약 전 확인</span><h1>예약 전 확인 안내</h1>
    <p class="lead">방문 주소·건물 출입·추가 이동비·예약 시간·개인정보·서비스 정책을 예약 전에 확인하세요.</p>
    <div class="grid grid-3">${checks.map(ch => `<a class="card" href="/gyeonggi-south/check/${ch.slug}/"><h3>${esc(ch.name)}</h3><p>${esc(ch.metaDescription)}</p></a>`).join("")}</div></div>
    ${whoHowWhy("예약 전 확인 항목과 경기남부 지역별 차이 안내")}`;
  write("gyeonggi-south/check", layout({
    title: "경기남부 출장마사지 예약 전 확인 안내 | 간다GO",
    description: "경기남부 출장마사지 예약 전 방문 주소·출입·이동비·개인정보 확인 안내.",
    canonical: "/gyeonggi-south/check/", h1: "예약 전 확인 안내",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "예약 전 확인", href: "/gyeonggi-south/check/" }],
    body
  }));
}

function buildChecks() {
  for (const ch of checks) {
    const others = checks.filter(x => x.slug !== ch.slug).map(x => ({ href: `/gyeonggi-south/check/${x.slug}/`, text: x.name }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">예약 전 확인</span>
      <h1>${esc(ch.h1)}</h1>
      <p class="lead">${esc(ch.body)}</p>
      <h2>확인 항목</h2>
      <ul class="checklist">${ch.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
    </div>
    ${linkCluster("다른 확인 항목", others)}
    ${linkCluster("이용 장소", useCases.slice(0, 5).map(u => ({ href: `/gyeonggi-south/use/${u.slug}/`, text: u.name })))}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${ch.name} 항목과 경기남부 도시·생활권별 차이`)}`;
    write(`gyeonggi-south/check/${ch.slug}`, layout({
      title: `${ch.h1} | 간다GO`,
      description: ch.metaDescription,
      canonical: `/gyeonggi-south/check/${ch.slug}/`, h1: ch.h1,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "예약 전 확인", href: "/gyeonggi-south/check/" }, { name: ch.name, href: `/gyeonggi-south/check/${ch.slug}/` }],
      body
    }));
  }
}

function buildPolicies() {
  for (const po of policies) {
    const others = policies.filter(x => x.slug !== po.slug).map(x => ({ href: `/gyeonggi-south/policy/${x.slug}/`, text: x.name }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">운영 기준</span>
      <h1>${esc(po.h1)}</h1>
      ${po.sections.map(s => `<h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>`).join("")}
    </div>
    ${linkCluster("운영 기준 · 안내", others.concat([{ href: "/gyeonggi-south/contact/", text: "문의하기" }]))}`;
    write(`gyeonggi-south/policy/${po.slug}`, layout({
      title: `${po.h1} | 간다GO`,
      description: po.metaDescription,
      canonical: `/gyeonggi-south/policy/${po.slug}/`, h1: po.h1,
      breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "운영 기준", href: "/gyeonggi-south/policy/authors/" }, { name: po.name, href: `/gyeonggi-south/policy/${po.slug}/` }],
      body
    }));
  }
}

function buildContact() {
  const body = `
  <div class="prose section">
    <span class="eyebrow">문의하기</span>
    <h1>간다GO 문의하기</h1>
    <p class="lead">예약 문의는 전화 또는 텔레그램으로, 웹사이트 제작·제휴 문의는 아래 버튼으로 접수합니다.</p>
    <div class="grid grid-2" style="margin:24px 0">
      <div class="card">
        <h3>예약 문의</h3>
        <p>상호 · ${esc(site.name)}</p>
        <p style="font-size:1.5rem;font-weight:900;color:var(--color-ink-900)">${esc(site.phoneLabel)} <a href="tel:${site.phone.replace(/-/g, "")}">${esc(site.phone)}</a></p>
        <a class="btn btn-primary btn-block" href="${site.telegram.reservation}" rel="noopener" target="_blank" style="margin-top:12px">${TG_ICON} 텔레그램 예약 문의</a>
      </div>
      <div class="card">
        <h3>제작·제휴 문의</h3>
        <p>간다GO 스타일 지역 안내 사이트 제작과 제휴 제안을 받습니다.</p>
        <a class="btn btn-orange btn-block" href="${site.telegram.webBuild}" rel="noopener" target="_blank" style="margin-top:12px">${TG_ICON} 웹사이트 제작문의</a>
        <a class="btn btn-orange btn-block" href="${site.telegram.partnership}" rel="noopener" target="_blank" style="margin-top:8px">${TG_ICON} 제휴문의</a>
      </div>
    </div>
    <p>불법·선정적 서비스는 제공하거나 안내하지 않습니다. 개인정보는 예약 확인에 필요한 최소 정보만 안내받습니다.</p>
  </div>
  ${linkCluster("이용 안내", [
    { href: "/gyeonggi-south/policy/privacy-policy/", text: "개인정보 처리방침" },
    { href: "/gyeonggi-south/policy/service-standard/", text: "불법·선정적 서비스 불가 안내" },
    { href: "/gyeonggi-south/check/customer-notice/", text: "고객 유의사항" }
  ])}`;
  write("gyeonggi-south/contact", layout({
    title: "간다GO 문의하기｜예약·제작·제휴 문의",
    description: `간다GO 예약 문의 ${site.phone}. 웹사이트 제작·제휴 문의는 텔레그램으로 접수합니다.`,
    canonical: "/gyeonggi-south/contact/", h1: "간다GO 문의하기",
    breadcrumb: [{ name: "홈", href: "/gyeonggi-south/" }, { name: "문의하기", href: "/gyeonggi-south/contact/" }],
    extraSchema: [{
      "@type": "ContactPage", "@id": site.baseUrl + "/gyeonggi-south/contact/#contact",
      url: site.baseUrl + "/gyeonggi-south/contact/"
    }],
    body
  }));
}

function buildSitemapRobots() {
  const today = process.env.BUILD_DATE || "2026-07-01";
  const items = urls.filter(u => !u.noindex);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">
${items.map(u => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>`;
  writeFileSync(join(OUT, "sitemap.xml"), xml);
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
}

function buildAssets() {
  mkdirSync(join(OUT, "assets"), { recursive: true });
  const css = readFileSync(join(__dirname, "src/styles/tokens.css"), "utf8") + "\n" + readFileSync(join(__dirname, "src/styles/overlay.css"), "utf8");
  writeFileSync(join(OUT, "assets/styles.css"), css);
  // 기본 OG 이미지 (SVG)
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#211C17"/><stop offset="1" stop-color="#14110E"/></linearGradient>
<radialGradient id="o" cx="0.85" cy="0.15" r="0.6"><stop offset="0" stop-color="#FF6A2C" stop-opacity="0.5"/><stop offset="1" stop-color="#FF6A2C" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#o)"/>
<text x="80" y="300" fill="#fff" font-family="Pretendard, sans-serif" font-size="84" font-weight="800">간다<tspan fill="#FF6A2C">GO</tspan></text>
<text x="80" y="380" fill="#E9E1D5" font-family="Pretendard, sans-serif" font-size="40" font-weight="600">경기남부 출장마사지 · 생활권 지역 안내</text>
<text x="80" y="470" fill="#FF9E63" font-family="Pretendard, sans-serif" font-size="34" font-weight="700">전화예약 0508-202-4719</text></svg>`;
  writeFileSync(join(OUT, "assets/og-default.svg"), og);
  const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#14110E"/><text x="32" y="42" text-anchor="middle" fill="#FF6A2C" font-family="sans-serif" font-size="30" font-weight="900">G</text></svg>`;
  writeFileSync(join(OUT, "assets/favicon.svg"), fav);
}

// ---- 실행 ------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
buildAssets();
buildHome();
buildAreaIndex(); buildAreas();
buildCityIndex(); buildCities();
buildLifeIndex(); buildLifeAreas();
buildStationIndex(); buildStations();
buildUseIndex(); buildUseCases();
buildCheckIndex(); buildChecks();
buildPolicies();
buildContact();
buildSitemapRobots();

const pageCount = countHtml(OUT);
console.log(`✓ 빌드 완료 · HTML ${pageCount}개 · sitemap ${urls.filter(u => !u.noindex).length} URL`);

function countHtml(dir) {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countHtml(join(dir, e.name));
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
}
