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
const adminDongs = readJSON(join(DATA, "gyeonggi-south/admin-dongs.json"));
const reviews = readJSON(join(DATA, "gyeonggi-south/reviews.json"));

const urls = []; // sitemap 수집

function readJSON(p) { return JSON.parse(readFileSync(p, "utf8")); }
function esc(s = "") { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cityBy(slug) { return cities.find(c => c.slug === slug); }
function stationBy(slug) { return stations.find(s => s.slug === slug); }
function lifeBy(slug) { return lifeAreas.find(l => l.slug === slug); }
function dongBy(slug) { return adminDongs.find(d => d.slug === slug); }
function dongUrl(d) { return d.districtSlug ? `/city/${d.city}/${d.districtSlug}/${d.slug}/` : `/city/${d.city}/dong/${d.slug}/`; }
function dongsInCity(citySlug, districtSlug) { return adminDongs.filter(d => d.city === citySlug && (districtSlug === undefined || d.districtSlug === districtSlug)); }
// 인접 행정동 이름 → 실제 페이지가 있는 동으로 연결 (없으면 텍스트만)
function adjacentDongLinks(d) {
  return (d.adjacent || []).map(name => {
    const t = adminDongs.find(x => x.city === d.city && x.name === name);
    return t ? { href: dongUrl(t), text: `${name}` } : null;
  }).filter(Boolean);
}
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

// ---- 데이터 기반 상세 블록 (페이지별 고유 본문 확장, 도어웨이 방지) ----
// 각 블록은 해당 페이지의 고유 데이터(행정구·행정동·역·생활권 노트)를 렌더링하므로
// 지역명만 바꾼 반복 문장이 아니라 페이지마다 내용이 달라진다.
function cityDetailSections(c) {
  let html = "";
  if (c.districts.length) {
    html += `<h2>${esc(c.name)} 행정구별 안내</h2>`;
    for (const d of c.districts) {
      const dongs = dongsInCity(c.slug, d.slug);
      const dsta = stations.filter(s => s.city === c.slug && s.district === d.name);
      html += `<h3><a href="/city/${c.slug}/${d.slug}/">${esc(c.name)} ${esc(d.name)}</a></h3><p>${esc(d.note)}을(를) 중심으로 하는 생활권입니다. ${dongs.length ? `대표 행정동으로는 ${dongs.map(x => `<a href="${dongUrl(x)}">${esc(x.name)}</a>`).join(", ")} 등이 있습니다. ` : ""}${dsta.length ? `가까운 역은 ${dsta.map(s => esc(s.name)).join(", ")}이며 역세권 상권과 주거지가 함께 형성되어 있습니다. ` : ""}이용 장소가 자택·오피스텔·숙소·업무지구인지에 따라 공동현관과 출입 방식, 예약 가능 시간을 먼저 확인하는 것이 좋습니다.</p>`;
    }
  }
  const lifes = lifeAreas.filter(l => l.city === c.slug);
  if (lifes.length) {
    html += `<h2>${esc(c.name)} 대표 생활권 자세히</h2>`;
    for (const l of lifes) html += `<h3><a href="/life/${l.slug}/">${esc(l.name)}</a> · ${esc(l.type)}</h3><p>${esc(l.note)}</p>`;
  }
  const sts = stations.filter(s => s.city === c.slug);
  if (sts.length) {
    html += `<h2>${esc(c.name)} 지하철역·역세권 안내</h2><ul>${sts.map(s => `<li><a href="/station/${s.slug}/"><strong>${esc(s.name)}</strong></a> — ${esc(s.note)}</li>`).join("")}</ul>`;
  }
  return html ? `<div class="prose section" style="max-width:none">${html}</div>` : "";
}

// 지역 유형별 이용 참고 — 장소명 없이 카테고리별로 다른 안내(도어웨이 방지: 이름 치환 아님)
const TYPE_GUIDE = {
  industrial: { label: "산업지구 생활권", ps: [
    "산업지구가 포함된 지역은 공장·물류·연구 시설과 인근 주거·숙소가 섞여 있어, 방문 주소가 단지 내부인지 인접 주거지인지에 따라 진입로와 이동 기준이 달라집니다. 일부 단지는 정문 게이트에서 방문 차량을 확인하므로 정확한 건물 위치와 진입 동선을 먼저 확인하는 것이 좋습니다.",
    "교대 근무가 많아 야간 예약 수요가 있는 편이며, 도심 대비 이동 소요 시간이 길어 예약 시간을 여유 있게 잡는 것이 좋습니다. 지하철 접근이 어려운 구간은 차량 이동을 기본으로 하고, 추가 이동비 기준을 예약 전에 안내받는 것이 원활합니다."
  ] },
  outer: { label: "외곽·읍면 생활권", ps: [
    "외곽·읍면 지역은 도심에서 떨어져 있어 차량 이동 거리가 길고, 같은 지명이 넓게 퍼져 있어 정확한 방문 위치 확인이 특히 중요합니다. 방문 주소가 도심 생활권인지 외곽인지에 따라 이동 소요 시간과 추가 이동비 기준이 달라지므로 예약 전에 함께 확인하는 것이 좋습니다.",
    "지하철 접근이 어려운 곳이 많아 차량 이동을 기본으로 하며, 예약 시간을 여유 있게 잡고 이동비 기준을 사전에 안내받는 것이 좋습니다. 자택·숙소 여부와 단독주택 현관·공동현관 등 건물 출입 방식도 함께 확인하면 방문이 원활합니다."
  ] },
  newtown: { label: "신도시 생활권", ps: [
    "신도시 생활권은 대규모 아파트·오피스텔 단지가 밀집해 같은 이름의 단지가 여러 블록에 걸쳐 있는 경우가 많습니다. 정확한 단지명과 동·호수를 확인하지 않으면 인접 단지와 혼동되기 쉬워, 방문 전에 단지 정보를 명확히 확인하는 것이 좋습니다.",
    "공동현관 비밀번호나 세대 호출, 엘리베이터 카드 인증, 방문객 주차 등록처럼 출입 절차가 정해진 단지가 많습니다. 관리 규정과 방문 가능 시간대를 함께 확인해두면 이동이 원활하며, 야간 예약 시에는 심야 출입 방식을 미리 확인하는 것이 좋습니다."
  ] },
  business: { label: "업무지구 생활권", ps: [
    "업무지구가 포함된 지역은 오피스 빌딩과 지식산업센터, 주상복합 오피스텔이 섞여 있어 건물마다 보안 규정이 다릅니다. 로비 안내데스크를 거치거나 방문자 등록이 필요한 곳이 있어, 정확한 동·층·호수와 로비 출입 방식을 먼저 확인하는 것이 좋습니다.",
    "주간과 야간·주말의 출입 방식이 다를 수 있고, 업무 시간대와 예약 가능 시간을 맞추는 것이 중요합니다. 주차는 방문객 등록 여부와 요금을 함께 확인해두면 편리합니다."
  ] },
  station: { label: "역세권·상권 생활권", ps: [
    "역세권·상권 생활권은 오피스텔·숙소·상가가 섞여 있어 건물 유형에 따라 확인 사항이 다릅니다. 오피스텔은 공동현관·엘리베이터 카드와 관리 규정을, 숙소는 외부인 방문 정책과 객실 출입 방식을, 상가 건물은 보안 규정과 예약 가능 시간을 확인하는 것이 좋습니다.",
    "역명과 출구 방향은 위치를 가늠하는 참고 정보이며, 실제 방문 가능 여부는 정확한 도로명 주소와 건물 출입 방식으로 확인합니다. 유동 인구가 많은 시간대에는 이동 동선을 미리 파악해두면 방문이 원활합니다."
  ] },
  residential: { label: "주거 생활권", ps: [
    "주거 생활권은 아파트와 빌라·주상복합이 섞여 있어 공동현관 출입 방식과 세대 호출, 주차 가능 여부를 확인하는 것이 방문의 핵심입니다. 저층 빌라·단독주택은 골목형 주소가 많아 정확한 동·호수와 현관 위치를 미리 확인하는 것이 좋습니다.",
    "조용한 주거지는 방문 시간대와 출입 동선을 배려하는 것이 좋으며, 야간 예약 시에는 심야 공동현관 출입 방식과 연락 방법을 함께 확인하면 방문이 원활합니다."
  ] },
  default: { label: "생활권 이용", ps: [
    "이 지역은 주거·상업·업무 기능이 함께 있어, 방문 장소가 자택·오피스텔·숙소·업무 건물 중 어디인지에 따라 확인 사항이 달라집니다. 공통적으로 정확한 방문 주소와 공동현관·건물 출입 방식, 예약 가능 시간을 먼저 확인하는 것이 좋습니다.",
    "신도시·산업지구·외곽에 해당하면 차량 이동 거리와 추가 이동비를, 도심 역세권이면 유동 인구와 건물 출입 동선을 함께 확인하면 방문이 원활합니다."
  ] }
};
function categoryOf(text = "") {
  if (/산업|산단|시화|반월|물류/.test(text)) return "industrial";
  if (/외곽|읍면|차량 이동|읍$|면$|읍 |면 /.test(text)) return "outer";
  if (/신도시|택지|지구/.test(text)) return "newtown";
  if (/업무|테크노|청사/.test(text)) return "business";
  if (/역세권|상권|상업/.test(text)) return "station";
  if (/주거/.test(text)) return "residential";
  return "default";
}
function typeGuidance(text) {
  const g = TYPE_GUIDE[categoryOf(text)];
  return `<div class="prose section" style="max-width:none"><h2>이용 시 참고 · ${esc(g.label)}</h2>${g.ps.map(p => `<p>${esc(p)}</p>`).join("")}</div>`;
}

function areaDetail(a) {
  let html = `<h2>${esc(a.name)} 도시별 안내</h2>`;
  for (const cs of a.cities) {
    const c = cityBy(cs); if (!c) continue;
    const lifes = lifeAreas.filter(l => l.city === c.slug).slice(0, 4);
    const sts = stations.filter(s => s.city === c.slug).slice(0, 4);
    html += `<h3><a href="/city/${c.slug}/">${esc(c.name)}</a></h3><p>${esc(c.intro)} ${lifes.length ? `대표 생활권은 ${lifes.map(l => `<a href="/life/${l.slug}/">${esc(l.name)}</a>`).join(", ")} 등이며, ` : ""}${sts.length ? `가까운 역은 ${sts.map(s => `<a href="/station/${s.slug}/">${esc(s.name)}</a>`).join(", ")} 등입니다.` : "지하철보다 차량 이동 기준이 중요한 지역입니다."}</p>`;
  }
  html += `<p>같은 권역 안에서도 도시와 생활권에 따라 이동 기준이 다릅니다. 방문 전에는 정확한 방문 주소와 행정구·행정동, 공동현관·건물 출입 방식, 예약 가능 시간을 확인하고, 신도시·산업지구·외곽에 해당하면 차량 이동 거리와 추가 이동비 기준을 함께 확인하는 것이 좋습니다.</p>`;
  return `<div class="prose section" style="max-width:none">${html}</div>`;
}

function stationDetail(s) {
  const c = cityBy(s.city);
  const life = lifeAreas.find(l => l.name === s.life);
  const sameLife = stations.filter(x => x.life === s.life && x.slug !== s.slug);
  let html = `<h2>${esc(s.name)} 주변 생활권</h2>`;
  html += `<p>${esc(s.name)}은(는) ${esc(s.cityName)}${s.district ? " " + esc(s.district) : ""} ${esc((s.dongs || []).join("·"))} 일대를 아우르며, ${life ? `<a href="/life/${life.slug}/">${esc(life.name)}</a> 생활권과 이어집니다. ${esc(life.note)}` : "인근 주거·상권 생활권과 이어집니다."}</p>`;
  if (s.lines) html += `<p>수도권 전철 ${esc(s.lines)} 노선이 지나는 역으로, 환승 노선이 있어도 노선별·출구별로 페이지를 나누지 않고 역명 기준으로 위치를 안내해 중복을 줄입니다.</p>`;
  if (sameLife.length) html += `<p>같은 생활권의 다른 역으로는 ${sameLife.map(x => `<a href="/station/${x.slug}/">${esc(x.name)}</a>`).join(", ")}이(가) 있습니다. 역명은 위치 참고용이며, 실제 방문 가능 여부는 정확한 주소와 건물 출입 방식으로 확인합니다.</p>`;
  html += `<h2>${esc(s.name)} 이용 장소별 확인</h2><p>역 주변 오피스텔은 공동현관·엘리베이터·관리 규정과 방문 가능 시간을, 숙소는 외부인 방문 정책과 객실 출입 방식을, 상권 건물은 보안 규정과 예약 가능 시간을 확인하는 것이 좋습니다. 자택 방문은 정확한 동·호수와 공동현관 출입 방식을 미리 확인하면 이동과 예약이 원활합니다.</p>`;
  html += `<p>${esc(s.name)}은(는) 출구별·노선별로 페이지를 나누지 않고 역명 기준으로 위치를 안내해 중복을 줄입니다. 예약 전에는 정확한 도로명 주소와 건물 출입 방식, 예약 가능 시간을 확인하고, 신도시·외곽 방향이면 차량 이동 거리와 추가 이동비 기준을 함께 확인하는 것이 좋습니다. 개인정보는 예약 확인에 필요한 최소 정보만 안내받으며, 불법·선정적 서비스는 제공하거나 안내하지 않습니다.</p>`;
  return `<div class="prose section" style="max-width:none">${html}</div>`;
}

function dongDetail(d) {
  const adj = (d.adjacent || []).map(name => {
    const t = adminDongs.find(x => x.city === d.city && x.name === name);
    return t ? `<a href="${dongUrl(t)}">${esc(name)}</a>` : esc(name);
  });
  const life = d.life ? lifeBy(d.life) : null;
  let html = `<h2>${esc(d.name)} 주변 지역</h2><p>${esc(d.name)}은(는) ${adj.length ? `${adj.join(", ")} 등과 인접하며, ` : ""}${life ? `<a href="/life/${life.slug}/">${esc(life.name)}</a> 생활권에 포함됩니다. ${esc(life.note)}` : "인근 생활권과 이어지는 주거·상업 지역입니다."} 같은 이름의 동이 다른 도시에 있을 수 있어, 방문 주소는 도시·행정구·행정동을 함께 확인하는 것이 정확합니다.</p>`;
  html += `<h2>${esc(d.name)} 이용 장소별 확인</h2><p>자택은 공동현관·엘리베이터·주차 여부를, 오피스텔은 방문자 등록과 관리 규정, 방문 가능 시간을, 숙소는 외부인 방문 정책과 객실 출입 방식을 먼저 확인합니다. 신규 아파트·오피스텔 단지가 많은 지역은 정확한 단지명과 동·호수를, 외곽 지역은 차량 이동 거리와 추가 이동비를 함께 확인하는 것이 좋습니다.</p>`;
  return `<div class="prose section" style="max-width:none">${html}</div>`;
}

function districtDetail(c, d) {
  const dongs = dongsInCity(c.slug, d.slug);
  if (!dongs.length) return "";
  const html = `<h2>${esc(c.name)} ${esc(d.name)} 대표 행정동 자세히</h2>` +
    dongs.map(x => `<h3><a href="${dongUrl(x)}">${esc(x.name)}</a></h3><p>${esc(x.note)}</p>`).join("") +
    `<p>${esc(d.name)} 안에서도 행정동과 생활권에 따라 이동 기준과 이용 환경이 다릅니다. 방문 전에는 정확한 방문 주소(동·호수)와 공동현관·건물 출입 방식, 예약 가능 시간을 확인하고, 인접 행정구·행정동과 헷갈리지 않도록 도시·행정구까지 함께 확인하는 것이 정확합니다.</p>`;
  return `<div class="prose section" style="max-width:none">${html}</div>`;
}

function lifeDetail(l) {
  let html = "";
  const sts = (l.stations || []).map(stationBy).filter(Boolean);
  if (sts.length) html += `<h2>${esc(l.name)} 가까운 지하철역</h2><ul>${sts.map(s => `<li><a href="/station/${s.slug}/"><strong>${esc(s.name)}</strong></a> — ${esc(s.note)}</li>`).join("")}</ul>`;
  const dongs = (l.dongs || []).map(n => adminDongs.find(x => x.city === l.city && x.name === n)).filter(Boolean);
  if (dongs.length) html += `<h2>${esc(l.name)} 포함 행정동</h2>${dongs.map(x => `<h3><a href="${dongUrl(x)}">${esc(x.name)}</a></h3><p>${esc(x.note)}</p>`).join("")}`;
  html += `<p>${esc(l.name)} 생활권은 인접 생활권·역세권과 이동으로 이어지며, 같은 생활권 안에서도 자택·오피스텔·숙소·업무 건물 등 방문 장소에 따라 확인 사항이 다릅니다. 예약 전에는 정확한 방문 주소와 공동현관·건물 출입 방식, 예약 가능 시간을 확인하고, 신도시·산업·외곽에 해당하면 차량 이동 거리와 추가 이동비 기준을 함께 확인하는 것이 좋습니다.</p>`;
  return `<div class="prose section" style="max-width:none">${html}</div>`;
}

// ---- 헤더/푸터 -------------------------------------------------
const TG_ICON = `<svg class="tg-ico" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M9.8 15.6 9.6 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.6-12.2c.3-1.2-.5-1.7-1.2-1.4L3.3 10.1c-1.1.4-1.1 1-.2 1.3l4.1 1.3 9.5-6c.4-.3.8-.1.5.2z"/></svg>`;

function header() {
  const navLinks = site.nav.map(n => `<a href="${n.href}">${esc(n.label)}</a>`).join("");
  const tel = site.phone.replace(/-/g, "");
  return `<header class="site-header"><div class="container bar">
    <a class="brand" href="/">간다<span class="dot">GO</span></a>
    <nav class="nav nav-desktop" aria-label="주요 메뉴">${navLinks}</nav>
    <div class="header-cta">
      <a class="tel-pill" href="tel:${tel}"><span class="tel-label">${esc(site.phoneLabel)}</span> <strong>${esc(site.phone)}</strong></a>
      <a class="btn btn-primary btn-reserve-top" href="${site.telegram.reservation}" rel="noopener" target="_blank">${TG_ICON} 예약 문의</a>
      <details class="nav-menu"><summary aria-label="메뉴 열기"><span class="menu-ico" aria-hidden="true"></span></summary>
        <nav class="nav-drawer" aria-label="모바일 메뉴">${navLinks}</nav>
      </details>
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
          <li><a href="/area/">권역 안내</a></li>
          <li><a href="/city/">도시 안내</a></li>
          <li><a href="/life/">생활권</a></li>
          <li><a href="/station/">지하철역</a></li>
          <li><a href="/use/">이용 장소</a></li>
        </ul>
      </div>
      <div>
        <h4>이용 안내</h4>
        <ul>
          <li><a href="/price/">코스·가격 안내</a></li>
          <li><a href="/reviews/">이용 후기</a></li>
          <li><a href="/check/">예약 전 확인</a></li>
          <li><a href="/policy/privacy-policy/">개인정보 처리방침</a></li>
          <li><a href="/policy/service-standard/">불법·선정적 서비스 불가 안내</a></li>
          <li><a href="/policy/authors/">작성자·검수자 안내</a></li>
          <li><a href="/contact/">문의하기</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-legal">
      © ${site.name} · 경기남부 지역 안내 · 전화예약 ${esc(site.phone)} ·
      <a href="/policy/privacy-policy/">개인정보처리방침</a> ·
      <a href="/policy/service-standard/">서비스 정책</a>
    </div>
  </div></footer>
  <a class="fab-reserve" href="${site.telegram.reservation}" rel="noopener" target="_blank" aria-label="예약 문의">${TG_ICON}<span>예약<br>문의</span></a>`;
}

// ---- 마사지 코스 메뉴 (메인 + 전 지역 페이지) -----------------
function courseMenu() {
  const cards = site.courses.map(c => `
      <div class="menu-card${c.best ? " menu-card-best" : ""}">
        ${c.best ? '<span class="menu-badge">BEST</span>' : ""}
        <h3>${esc(c.name)}</h3>
        <div class="menu-price">${esc(c.price)}<small>원</small></div>
        <div class="menu-dur">${esc(c.duration)}</div>
        <p>${esc(c.desc)}</p>
        <a class="btn ${c.best ? "btn-orange" : "btn-outline-light"} btn-block" href="${site.telegram.reservation}" rel="noopener" target="_blank">예약 문의</a>
      </div>`).join("");
  return `<section class="course-menu" aria-label="마사지 코스 안내">
    <span class="eyebrow">코스 · 요금</span>
    <h2>마사지 코스 안내</h2>
    <p class="menu-sub">경기남부 출장마사지 기본 코스입니다. 예약 문의로 지역·인원별 안내를 받으세요.</p>
    <div class="grid grid-3 menu-cards">${cards}</div>
    <p class="menu-note">표시 요금은 기본 정찰가이며 코스·인원·지역에 따라 달라질 수 있습니다. 자세한 내용은 <a href="/price/">가격 안내</a>를 확인하세요.</p>
  </section>`;
}

// ---- 지역 페이지 히어로 배너 (이미지 + 제목) ------------------
function heroBanner(eyebrow, h1, lead) {
  const img = site.heroImage;
  const style = img ? ` style="background-image: var(--overlay-hero), url('${img}'); background-size:cover; background-position:center;"` : "";
  return `<section class="hero hero-region${img ? " hero-photo" : ""}"${style}>
    ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
    <h1>${h1}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ""}
  </section>`;
}

// ---- 이용 후기 (별점) -----------------------------------------
function stars(n) {
  const full = "★".repeat(n) + "☆".repeat(5 - n);
  return `<span class="stars" role="img" aria-label="별점 ${n}점 만점에 5점">${full}</span>`;
}
function reviewCard(r) {
  return `<figure class="review-card">
    <div class="review-top">${stars(r.rating)}<span class="review-score">${r.rating.toFixed(1)}</span></div>
    <figcaption class="review-title">${esc(r.title)}</figcaption>
    <blockquote>${esc(r.body)}</blockquote>
    <div class="review-author">— ${esc(r.author)} 이용 고객</div>
  </figure>`;
}
function reviewsBlock(count = 3) {
  const a = reviews.aggregate;
  const items = reviews.items.slice(0, count).map(reviewCard).join("");
  return `<section class="reviews" aria-label="이용 후기">
    <span class="eyebrow">이용 후기</span>
    <h2>간다GO 방문 관리 이용 후기</h2>
    <div class="review-agg">${stars(Math.round(Number(a.ratingValue)))}<strong>${a.ratingValue}</strong><span>／ 5.0 · 후기 ${a.reviewCount}건</span></div>
    <div class="grid grid-3 review-grid">${items}</div>
    <p class="review-more"><a href="/reviews/">이용 후기 전체 보기 →</a></p>
  </section>`;
}
function aggregateRatingSchema() {
  const a = reviews.aggregate;
  return { "@type": "AggregateRating", ratingValue: a.ratingValue, reviewCount: String(a.reviewCount), bestRating: a.best, worstRating: a.worst };
}
function reviewSchemaItems() {
  return reviews.items.map(r => ({
    "@type": "Review",
    name: r.title,
    reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5", worstRating: "1" },
    author: { "@type": "Person", name: r.author },
    reviewBody: r.body
  }));
}

// ---- Schema (JSON-LD) -----------------------------------------
function orgSchema() {
  return {
    "@type": "Organization",
    "@id": site.baseUrl + "/#organization",
    name: site.name,
    description: site.org.description,
    url: site.baseUrl + "/",
    telephone: site.phone,
    areaServed: site.org.areaServed,
    contactPoint: { "@type": "ContactPoint", telephone: site.phone, contactType: "reservations", areaServed: "KR", availableLanguage: "Korean" },
    aggregateRating: aggregateRatingSchema(),
    sameAs: [site.telegram.reservation]
  };
}
function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": site.baseUrl + "/#website",
    url: site.baseUrl + "/",
    name: site.name,
    inLanguage: "ko-KR",
    publisher: { "@id": site.baseUrl + "/#organization" }
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
  const schema = [orgSchema(), websiteSchema(), webPageSchema(p), breadcrumbSchema(p.breadcrumb), imageObjectSchema(ogImage, alt), ...(p.extraSchema || [])];
  const graph = { "@context": "https://schema.org", "@graph": schema };
  const canonicalAbs = site.baseUrl + p.canonical;
  if (!p.skipSitemap) urls.push({ loc: canonicalAbs, noindex: !!p.noindex });
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
${(p.canonical === "/" || ["/area/", "/city/", "/dong/", "/life/", "/station/"].some(x => p.canonical.startsWith(x))) ? courseMenu() + reviewsBlock() : ""}
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
  const areaCards = areas.map(a => `<a class="card" href="/area/${a.slug}/"><h3>${esc(a.name)}</h3><p>${esc(a.lead)}</p><div class="meta">${a.cityNames.slice(0, 4).map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></a>`).join("");
  const cityCards = cities.map(c => `<a class="card" href="/city/${c.slug}/"><h3>${esc(c.name)}</h3><p>${esc(c.lifeAreas.slice(0, 3).join(" · "))}</p><div class="meta">${c.stations.slice(0, 3).map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div></a>`).join("");
  const lifeCards = lifeAreas.slice(0, 12).map(l => `<a class="card" href="/life/${l.slug}/"><h3>${esc(l.name)}</h3><p>${esc(l.type)} · ${esc(l.cityName)}</p></a>`).join("");
  const heroStyle = site.heroImage ? ` style="background-image: var(--overlay-hero), url('${site.heroImage}'); background-size: cover; background-position: center;"` : "";
  const body = `
  <section class="hero${site.heroImage ? " hero-photo" : ""}"${heroStyle}>
    <span class="eyebrow">경기남부 · 도시별 생활권 안내</span>
    <h1>경기남부 출장마사지 · 도시별·생활권별 지역 안내</h1>
    <p class="lead">수원, 성남, 용인, 화성, 오산, 평택, 안양, 안산, 시흥 등 경기남부 주요 도시와 생활권, 지하철역, 자택·호텔·오피스텔 이용 전 확인사항을 안내합니다.</p>
    <div class="cta-row">
      <a class="btn btn-primary btn-lg" href="/city/">도시 안내</a>
      <a class="btn btn-ghost btn-lg" href="/life/">생활권 보기</a>
      <a class="btn btn-ghost btn-lg" href="/station/">지하철역 보기</a>
      <a class="btn btn-ghost btn-lg" href="/check/">예약 전 확인</a>
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
    <p style="margin-top:16px"><a href="/life/">생활권 전체 보기 →</a></p>
  </section>

  ${linkCluster("주제별 롱테일 안내 · 자주 찾는 안내", [
    { href: "/life/suwon-station-ingye/", text: "수원역·인계동 생활권 예약 전 확인" },
    { href: "/life/bundang-pangyo/", text: "분당·판교 오피스텔 방문 안내" },
    { href: "/life/dongtan-newtown/", text: "동탄신도시 방문 기준·단지 확인" },
    { href: "/life/gwanggyo-yeongtong/", text: "광교·영통 신도시 이용 안내" },
    { href: "/station/suwon-station/", text: "수원역 역세권 출입·주소 확인" },
    { href: "/station/pangyo-station/", text: "판교역 역세권 업무지구 안내" },
    { href: "/use/home/", text: "자택 방문 전 공동현관 확인사항" },
    { href: "/use/hotel/", text: "호텔·숙소 객실 방문 정책 안내" },
    { href: "/use/officetel/", text: "오피스텔 방문자 등록·출입 안내" },
    { href: "/use/night/", text: "야간 예약 시 심야 출입·이동 안내" },
    { href: "/check/travel-fee/", text: "외곽 지역 추가 이동비 기준" },
    { href: "/check/address/", text: "도시·행정구·행정동 방문 주소 확인" },
    { href: "/price/", text: "60·90·120분 코스·가격 안내" },
    { href: "/reviews/", text: "자택·호텔·오피스텔 이용 후기·별점" }
  ])}

  ${checklistBlock([
    "방문 주소를 정확히 확인했나요?", "도시와 행정구, 행정동이 정확한가요?",
    "가까운 생활권과 지하철역을 확인했나요?", "신도시·산업지구·외곽 지역 중 어디에 해당하나요?",
    "공동현관 또는 건물 출입 방식이 있나요?", "호텔·숙소 이용 가능 여부를 확인했나요?",
    "오피스텔 관리 규정이 있나요?", "외곽 지역 추가 이동비가 필요한가요?",
    "개인정보 처리 기준을 확인했나요?", "불법·선정적 서비스 불가 안내를 확인했나요?"
  ], "예약 전 확인해야 할 내용")}

  ${linkCluster("도움되는 정보 · 관련 링크", [
    { href: "/use/home/", text: "자택 이용 전 확인" },
    { href: "/use/officetel/", text: "오피스텔 이용 전 확인" },
    { href: "/use/hotel/", text: "호텔·숙소 이용 전 확인" },
    { href: "/check/travel-fee/", text: "추가 이동비 기준" },
    { href: "/policy/service-standard/", text: "불법·선정적 서비스 불가 안내" },
    { href: "https://www.google.com/maps/place/경기도", text: "경기도 지도(구글) 위치 확인" }
  ])}

  ${faqBlock(SHARED_FAQ)}
  ${whoHowWhy("경기남부 주요 도시, 행정구, 행정동, 생활권, 지하철역, 신도시·산업지구·외곽 이동 기준")}
  `;
  const page = {
    title: `경기남부 출장마사지｜수원·성남·용인·화성·오산 홈타이 생활권 안내`,
    description: "경기남부 출장마사지·홈타이 예약 전 주요 도시·생활권·지하철역 확인사항 안내.",
    canonical: "/",
    h1: "경기남부 출장마사지",
    breadcrumb: [{ name: "경기남부 홈", href: "/" }],
    extraSchema: [faqSchema(SHARED_FAQ)],
    body
  };
  const html = layout(page);
  write(".", html); // 홈을 사이트 루트(/)에 게시
}

function buildAreaIndex() {
  const body = `<div class="section"><span class="eyebrow">권역 안내</span><h1>경기남부 권역 안내</h1>
    <p class="lead">경기남부를 생활권 중심으로 9개 권역으로 나누어 안내합니다. 포함 도시와 대표 생활권, 이동 기준을 확인하세요.</p>
    <div class="grid grid-3">${areas.map(a => `<a class="card" href="/area/${a.slug}/"><h3>${esc(a.name)}</h3><p>${esc(a.lead)}</p><div class="meta">${a.cityNames.slice(0, 4).map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 권역별 포함 도시와 대표 생활권, 이동 기준")}`;
  write("area", layout({
    title: "경기남부 권역 안내｜9개 생활권 권역 | 간다GO",
    description: "경기남부 출장마사지 9개 권역별 포함 도시·대표 생활권·이동 기준 안내.",
    canonical: "/area/", h1: "경기남부 권역 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "권역 안내", href: "/area/" }],
    body
  }));
}

function buildAreas() {
  for (const a of areas) {
    const cityLinks = a.cities.map(cityBy).filter(Boolean).map(c => ({ href: `/city/${c.slug}/`, text: `${c.name} 안내` }));
    const lifeLinks = lifeAreas.filter(l => a.cities.includes(l.city)).map(l => ({ href: `/life/${l.slug}/`, text: `${l.name} 생활권` }));
    const stationLinks = stations.filter(s => a.cities.includes(s.city)).slice(0, 8).map(s => ({ href: `/station/${s.slug}/`, text: s.name }));
    const body = `
    ${heroBanner(esc(a.name), esc(a.name) + " 출장마사지 · 경기남부 생활권 안내", esc(a.lead))}
    <div class="prose section">
      <h2>권역 개요</h2><p>${esc(a.intro)}</p>
      <h2>이동 기준</h2><p>${esc(a.move)}</p>
    </div>
    ${areaDetail(a)}
    ${typeGuidance(a.name + " " + a.move + " " + a.lead)}
    ${linkCluster("포함 도시", cityLinks)}
    ${linkCluster("대표 생활권", lifeLinks)}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${checklistBlock(["방문 주소와 행정구·행정동을 확인했나요?", "신도시·산업지구·외곽 중 어디인가요?", "가까운 생활권과 지하철역을 확인했나요?", "외곽 지역 추가 이동비가 필요한가요?", "개인정보 처리 기준을 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/use/officetel/", text: "오피스텔 이용 전 확인" },
      { href: "/use/hotel/", text: "호텔·숙소 이용 전 확인" },
      { href: "/check/address/", text: "방문 주소 확인" },
      { href: "/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${a.name} 포함 도시, 대표 생활권, 지하철역, 이동 기준`)}`;
    write(`area/${a.slug}`, layout({
      title: `${a.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
      description: a.metaDescription,
      canonical: `/area/${a.slug}/`, h1: `${a.name} 출장마사지`,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "권역 안내", href: "/area/" }, { name: a.name, href: `/area/${a.slug}/` }],
      body
    }));
  }
}

function buildCityIndex() {
  const body = `<div class="section"><span class="eyebrow">도시 안내</span><h1>경기남부 도시 안내</h1>
    <p class="lead">경기남부 18개 주요 도시를 안내합니다. 행정구가 있는 도시는 도시 → 행정구 → 생활권 구조로 확인하세요.</p>
    <div class="grid grid-3">${cities.map(c => `<a class="card" href="/city/${c.slug}/"><h3>${esc(c.name)}</h3><p>${esc(c.region)} · ${esc(c.lifeAreas.slice(0, 2).join(", "))}</p><div class="meta">${(c.districts.length ? c.districts.map(d => `<span class="tag">${esc(d.name)}</span>`) : c.lifeAreas.slice(0, 3).map(l => `<span class="tag">${esc(l)}</span>`)).join("")}</div></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 18개 도시별 행정구·생활권·역세권 안내")}`;
  write("city", layout({
    title: "경기남부 도시 안내｜18개 주요 도시 | 간다GO",
    description: "경기남부 출장마사지 수원·성남·용인 등 18개 도시별 행정구·생활권 안내.",
    canonical: "/city/", h1: "경기남부 도시 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "도시 안내", href: "/city/" }],
    body
  }));
}

function buildCities() {
  for (const c of cities) {
    const districtLinks = c.districts.map(d => ({ href: `/city/${c.slug}/${d.slug}/`, text: `${c.name} ${d.name}` }));
    const lifeLinks = lifeAreas.filter(l => l.city === c.slug).map(l => ({ href: `/life/${l.slug}/`, text: `${l.name} 생활권` }));
    const stationLinks = stations.filter(s => s.city === c.slug).map(s => ({ href: `/station/${s.slug}/`, text: s.name }));
    const adjLinks = c.adjacent.map(a => ({ href: `/city/${a.slug}/`, text: `${a.name} 안내` }));
    const cityDongLinks = dongsInCity(c.slug).map(x => ({ href: dongUrl(x), text: x.district ? `${x.district} ${x.name}` : x.name }));
    const districtSection = c.districts.length ? `<h2>행정구별 생활권</h2><ul>${c.districts.map(d => `<li><a href="/city/${c.slug}/${d.slug}/"><strong>${esc(d.name)}</strong></a> — ${esc(d.note)}</li>`).join("")}</ul>` : "";
    const body = `
    ${heroBanner(esc(c.region), esc(c.name) + " 출장마사지 · 생활권·역세권 지역 안내", esc(c.intro))}
    <div class="prose section">
      ${districtSection}
      <h2>대표 생활권</h2><p>${esc(c.living)}</p>
      <h2>가까운 역·인접 지역</h2><p>${esc(c.access)}</p>
      <h2>이용 장소별 기준</h2>
      <p>자택은 공동현관·엘리베이터·주차 여부를, 오피스텔은 방문자 등록과 관리 규정을, 호텔·숙소는 외부인 방문 정책과 객실 출입 방식을 먼저 확인합니다. 신도시·업무지구는 동·호수와 보안 규정을, 외곽·산업지구는 차량 이동 거리와 추가 이동비, 예약 가능 시간을 확인하는 것이 좋습니다.</p>
      <h2>안내 방향</h2><p>${esc(c.focus)}</p>
    </div>
    ${cityDetailSections(c)}
    ${linkCluster("대표 행정동 안내", cityDongLinks)}
    ${linkCluster("대표 생활권 바로가기", lifeLinks)}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${linkCluster("인접 도시", adjLinks.concat([{ href: `/area/${c.regionSlug}/`, text: `${c.region} 권역` }]))}
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
      { href: "/use/home/", text: "자택 이용 전 확인" },
      { href: "/use/officetel/", text: "오피스텔 이용 전 확인" },
      { href: "/use/hotel/", text: "호텔·숙소 이용 전 확인" },
      { href: "/check/address/", text: "방문 주소 확인" },
      { href: "/check/service-policy/", text: "불법·선정적 서비스 불가 안내" },
      { href: "/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ)}
    ${whoHowWhy(`${c.name} 행정구·행정동·생활권·역세권과 이용 장소별 확인사항`)}`;
    write(`city/${c.slug}`, layout({
      title: `${c.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
      description: c.metaDescription,
      canonical: `/city/${c.slug}/`, h1: `${c.name} 출장마사지`,
      ogAlt: `${c.name} ${c.lifeAreas[0]} 생활권 방문형 관리 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "도시 안내", href: "/city/" }, { name: c.name, href: `/city/${c.slug}/` }],
      body
    }));
    // 행정구 페이지
    for (const d of c.districts) buildDistrict(c, d);
  }
}

function buildDistrict(c, d) {
  const siblingLinks = c.districts.filter(x => x.slug !== d.slug).map(x => ({ href: `/city/${c.slug}/${x.slug}/`, text: `${c.name} ${x.name}` }));
  const lifeLinks = lifeAreas.filter(l => l.city === c.slug && (l.districts || []).includes(d.name)).map(l => ({ href: `/life/${l.slug}/`, text: `${l.name} 생활권` }));
  const stationLinks = stations.filter(s => s.city === c.slug && s.district === d.name).map(s => ({ href: `/station/${s.slug}/`, text: s.name }));
  const dongLinks = dongsInCity(c.slug, d.slug).map(x => ({ href: dongUrl(x), text: x.name }));
  const body = `
  ${heroBanner(esc(c.name) + " · 행정구 안내", esc(c.name) + " " + esc(d.name) + " 출장마사지 · " + esc(d.note.split(" ")[0]) + " 생활권 안내", esc(c.name) + " " + esc(d.name) + "은(는) " + esc(d.note) + "을(를) 중심으로 하는 생활권입니다. 같은 " + esc(c.name) + " 안에서도 행정구별로 이동 기준과 이용 환경이 달라, 방문 주소와 함께 행정구·생활권을 확인하는 것이 정확합니다.")}
  <div class="prose section">
    <h2>상위 도시</h2><p><a href="/city/${c.slug}/">${esc(c.name)} 전체 안내</a>에서 다른 행정구와 도시 전체 생활권을 함께 확인할 수 있습니다. ${esc(c.name)}은(는) ${esc(c.region)}에 속합니다.</p>
    <h2>대표 생활권</h2><p>${esc(d.note)} 생활권을 중심으로 오피스텔·상권·주거지가 형성되어 있습니다. 이용 장소가 자택·오피스텔·숙소인지에 따라 공동현관과 출입 방식 확인이 먼저 필요합니다.</p>
    <h2>이용 장소별 기준</h2><p>오피스텔은 공동현관·엘리베이터·관리 규정과 방문 가능 시간을, 상권·업무지구는 건물 보안 규정과 예약 가능 시간을, 주거지는 공동현관 출입 방식을 확인하는 것이 좋습니다.</p>
  </div>
  ${districtDetail(c, d)}
  ${typeGuidance(d.note)}
  ${linkCluster("대표 행정동", dongLinks)}
  ${linkCluster("같은 도시 다른 행정구", siblingLinks)}
  ${linkCluster("관련 생활권", lifeLinks.length ? lifeLinks : lifeAreas.filter(l => l.city === c.slug).slice(0, 3).map(l => ({ href: `/life/${l.slug}/`, text: `${l.name} 생활권` })))}
  ${linkCluster("가까운 지하철역", stationLinks)}
  ${checklistBlock(["방문 주소와 행정동을 확인했나요?", "가까운 생활권과 지하철역을 확인했나요?", "공동현관·건물 출입 방식을 확인했나요?", "예약 가능 시간을 확인했나요?", "개인정보 처리 기준을 확인했나요?"])}
  ${linkCluster("예약 전 확인", [
    { href: "/check/address/", text: "방문 주소 확인" },
    { href: "/check/building-access/", text: "건물 출입 방식" },
    { href: "/contact/", text: "문의하기" }
  ])}
  ${faqBlock(SHARED_FAQ.slice(0, 4))}
  ${whoHowWhy(`${c.name} ${d.name} 대표 행정동·생활권·역세권과 이용 장소별 확인사항`)}`;
  write(`city/${c.slug}/${d.slug}`, layout({
    title: `${c.name} ${d.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
    description: clampDesc(`${c.name} ${d.name} 출장마사지·홈타이 예약 전 ${d.note} 생활권 확인 안내.`),
    canonical: `/city/${c.slug}/${d.slug}/`, h1: `${c.name} ${d.name} 출장마사지`,
    breadcrumb: [{ name: "홈", href: "/" }, { name: "도시 안내", href: "/city/" }, { name: c.name, href: `/city/${c.slug}/` }, { name: d.name, href: `/city/${c.slug}/${d.slug}/` }],
    body
  }));
}

function buildDongIndex() {
  const byCity = {};
  for (const d of adminDongs) (byCity[d.city] ||= []).push(d);
  const groups = cities.filter(c => byCity[c.slug]).map(c => {
    const list = byCity[c.slug];
    return `<div class="card"><h3><a href="/city/${c.slug}/">${esc(c.name)}</a></h3><nav class="linkcluster">${list.map(d => `<a href="${dongUrl(d)}">${esc(d.district ? d.district + " " : "")}${esc(d.name)}${d.index ? "" : " ·"}</a>`).join("")}</nav></div>`;
  }).join("");
  const idx = adminDongs.filter(d => d.index).length;
  const body = `<div class="section"><span class="eyebrow">행정동 안내</span><h1>경기남부 대표 행정동 안내</h1>
    <p class="lead">검색 수요와 본문 품질이 확보된 <strong>대표 행정동</strong>만 안내합니다. 번호동(예: 매탄1~4동)은 대표동으로 묶고, 출구별·노선별 분리 페이지는 만들지 않아 중복·저품질 페이지를 줄입니다.</p>
    <div class="grid grid-2">${groups}</div>
    <p style="margin-top:16px;color:var(--color-text-mute);font-size:var(--fs-sm)">· 표시는 다른 생활권·역세권 안내와 내용이 겹칠 수 있어 색인에서 제외(noindex)하고 내부 이동용으로만 유지하는 행정동입니다. 대표 색인 행정동 ${idx}곳.</p>
    </div>${whoHowWhy("경기남부 도시·행정구별 대표 행정동과 인접 동·생활권·역세권 안내")}`;
  write("dong", layout({
    title: "경기남부 행정동 안내｜대표 행정동 | 간다GO",
    description: "경기남부 출장마사지 도시·행정구별 대표 행정동과 인접 동·생활권 안내.",
    canonical: "/dong/", h1: "경기남부 대표 행정동 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "행정동", href: "/dong/" }],
    body
  }));
}

function buildDongs() {
  for (const d of adminDongs) {
    const c = cityBy(d.city);
    const district = c.districts.find(x => x.name === d.district);
    const life = d.life ? lifeBy(d.life) : null;
    const station = d.station ? stationBy(d.station) : null;
    const url = dongUrl(d);
    const adjLinks = adjacentDongLinks(d);
    const parentLinks = [{ href: `/city/${c.slug}/`, text: `${c.name} 안내` }];
    if (district) parentLinks.push({ href: `/city/${c.slug}/${district.slug}/`, text: `${c.name} ${district.name}` });
    const stationLinks = station ? [{ href: `/station/${station.slug}/`, text: station.name }] : [];
    const lifeLinks = life ? [{ href: `/life/${life.slug}/`, text: `${life.name} 생활권` }] : [];
    const posDesc = district ? `${c.name} ${d.district}에 속한 행정동` : `${c.name}의 행정동`;
    const h1 = `${d.name} 출장마사지 · ${district ? d.district + " " : c.name + " "}생활권 안내`;
    const body = `
    ${heroBanner(esc(c.name) + (district ? " · " + esc(d.district) : "") + " · 행정동", esc(h1), esc(d.note))}
    <div class="prose section">
      <h2>행정동 위치</h2>
      <p>${esc(d.name)}은(는) ${esc(posDesc)}으로, ${esc((d.adjacent || []).join(", "))} 등과 인접합니다.${life ? ` 생활권으로는 ${esc(life.name)}과(와) 이어집니다.` : ""} 같은 이름의 동이 다른 도시에 있을 수 있어, 방문 주소는 도시·행정구·행정동을 함께 확인하는 것이 정확합니다.</p>
      <h2>상위 도시·행정구</h2>
      <p><a href="/city/${c.slug}/">${esc(c.name)} 전체 안내</a>${district ? `와 <a href="/city/${c.slug}/${district.slug}/">${esc(c.name)} ${esc(district.name)} 안내</a>` : ""}에서 인접 지역과 도시 전체 생활권을 함께 확인할 수 있습니다. ${esc(c.name)}은(는) ${esc(c.region)}에 속합니다.</p>
      <h2>가까운 역·생활권</h2>
      <p>${station ? `가까운 역은 <a href="/station/${station.slug}/">${esc(station.name)}</a>이며, 역명은 위치 참고용이고 실제 방문 가능 여부는 정확한 주소로 확인합니다. ` : "지하철 접근보다 차량 이동 기준이 중요한 지역으로, 방문 주소와 이동 거리를 먼저 확인합니다. "}${life ? `<a href="/life/${life.slug}/">${esc(life.name)} 생활권</a> 안내에서 인근 이용 기준을 함께 확인할 수 있습니다.` : ""}</p>
      <h2>이용 장소별 기준</h2>
      <p>자택은 공동현관·엘리베이터·주차 여부를, 오피스텔은 방문자 등록과 관리 규정을, 숙소는 외부인 방문 정책과 객실 출입 방식을 먼저 확인합니다. ${d.note.includes("외곽") || d.note.includes("차량") ? "외곽·산업권은 차량 이동 거리와 추가 이동비, 예약 가능 시간을 확인하는 것이 좋습니다." : "신규 단지가 많은 지역은 정확한 단지명과 동·호수를 확인하는 것이 좋습니다."}</p>
    </div>
    ${dongDetail(d)}
    ${typeGuidance(d.note)}
    ${linkCluster("상위 도시·행정구", parentLinks)}
    ${linkCluster("인접 행정동", adjLinks)}
    ${linkCluster("관련 생활권·역세권", lifeLinks.concat(stationLinks))}
    ${checklistBlock([
      `${d.name}의 정확한 방문 주소(동·호수)를 확인했나요?`,
      "도시·행정구·행정동이 정확한가요?",
      "공동현관·건물 출입 방식을 확인했나요?",
      "가까운 생활권과 이동 기준을 확인했나요?",
      "예약 가능 시간과 개인정보 처리 기준을 확인했나요?"
    ])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/use/home/", text: "자택 이용 전 확인" },
      { href: "/use/officetel/", text: "오피스텔 이용 전 확인" },
      { href: "/check/address/", text: "방문 주소 확인" },
      { href: "/check/service-policy/", text: "불법·선정적 서비스 불가 안내" },
      { href: "/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${c.name} ${d.name} 위치·인접 행정동·생활권·역세권과 이용 장소별 확인사항`)}`;
    const crumb = [{ name: "홈", href: "/" }, { name: "도시 안내", href: "/city/" }, { name: c.name, href: `/city/${c.slug}/` }];
    if (district) crumb.push({ name: district.name, href: `/city/${c.slug}/${district.slug}/` });
    crumb.push({ name: d.name, href: url });
    write(url.replace(/^\/|\/$/g, ""), layout({
      title: `${d.name} 출장마사지·홈타이 생활권 안내 | 간다GO`,
      description: clampDesc(`${d.name} 출장마사지·홈타이 예약 전 ${c.name}${district ? " " + d.district : ""} 생활권 확인 안내.`),
      canonical: url, h1: `${d.name} 출장마사지`,
      ogAlt: `${d.name} 생활권 예약 전 확인 이미지`,
      noindex: !d.index,
      breadcrumb: crumb,
      body
    }));
  }
}

function buildLifeIndex() {
  const body = `<div class="section"><span class="eyebrow">생활권</span><h1>경기남부 주요 생활권</h1>
    <p class="lead">신도시·역세권·업무지구·산업지구·주거·외곽 생활권을 도시와 함께 안내합니다.</p>
    <div class="grid grid-3">${lifeAreas.map(l => `<a class="card" href="/life/${l.slug}/"><h3>${esc(l.name)}</h3><p>${esc(l.type)} · ${esc(l.cityName)}</p></a>`).join("")}</div>
    </div>${whoHowWhy("경기남부 신도시·역세권·산업지구·외곽 생활권 안내")}`;
  write("life", layout({
    title: "경기남부 생활권 안내｜신도시·역세권·산업권 | 간다GO",
    description: "경기남부 출장마사지 신도시·역세권·산업지구·외곽 생활권별 확인 안내.",
    canonical: "/life/", h1: "경기남부 주요 생활권",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "생활권", href: "/life/" }],
    body
  }));
}

function buildLifeAreas() {
  for (const l of lifeAreas) {
    const c = cityBy(l.city);
    const stationLinks = (l.stations || []).map(stationBy).filter(Boolean).map(s => ({ href: `/station/${s.slug}/`, text: s.name }));
    const neighbors = lifeAreas.filter(x => x.city === l.city && x.slug !== l.slug).slice(0, 4).map(x => ({ href: `/life/${x.slug}/`, text: `${x.name} 생활권` }));
    const dongTags = (l.dongs || []).map(d => `<span class="tag">${esc(d)}</span>`).join("");
    const body = `
    ${heroBanner(esc(l.cityName) + " · " + esc(l.type), esc(l.name) + " 출장마사지 생활권 안내", esc(l.note))}
    <div class="prose section">
      <div class="meta" style="margin-bottom:16px">${dongTags}</div>
      <h2>생활권 개요</h2>
      <p>${esc(l.name)}은(는) ${esc(l.cityName)}${(l.districts && l.districts.length) ? ` ${l.districts.join("·")}` : ""}에 속하는 ${esc(l.type)} 생활권입니다. ${esc(l.note)} 포함 행정동으로는 ${esc((l.dongs || []).join(", "))} 등이 있습니다.</p>
      <h2>가까운 역·이용 장소</h2>
      <p>${stationLinks.length ? `대표 역세권은 ${esc((l.stations || []).map(s => stationBy(s)?.name).filter(Boolean).join(", "))}입니다. ` : "지하철 접근보다 차량 이동 기준이 중요한 생활권입니다. "}이용 장소가 자택·오피스텔·숙소·업무지구인지에 따라 공동현관과 출입 방식, 예약 가능 시간을 먼저 확인하는 것이 좋습니다.</p>
      <h2>이용 장소별 기준</h2>
      <p>신도시·오피스텔은 동·호수와 공동현관·관리 규정을, 역세권 상권은 숙소·건물 출입 방식을, 산업·외곽은 차량 이동 거리와 추가 이동비를 확인합니다.</p>
    </div>
    ${lifeDetail(l)}
    ${typeGuidance(l.type + " " + l.note)}
    ${linkCluster("포함 도시·행정구", [{ href: `/city/${l.city}/`, text: `${l.cityName} 안내` }].concat((l.districts || []).map(d => {
      const dobj = (c?.districts || []).find(x => x.name === d);
      return dobj ? { href: `/city/${l.city}/${dobj.slug}/`, text: `${l.cityName} ${d}` } : null;
    })))}
    ${linkCluster("가까운 지하철역", stationLinks)}
    ${linkCluster("인접 생활권", neighbors)}
    ${checklistBlock(["방문 주소와 동·호수를 확인했나요?", "공동현관·건물 출입 방식을 확인했나요?", "가까운 지하철역·이동 기준을 확인했나요?", "신도시·산업·외곽 중 어디인가요?", "예약 가능 시간과 추가 이동비를 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/use/officetel/", text: "오피스텔 이용" },
      { href: "/use/newtown/", text: "신도시 생활권 이용" },
      { href: "/check/address/", text: "방문 주소 확인" },
      { href: "/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(0, 4))}
    ${whoHowWhy(`${l.name} 포함 도시·행정동·역세권과 이용 장소별 확인사항`)}`;
    write(`life/${l.slug}`, layout({
      title: `${l.name} 출장마사지 생활권 안내 | 간다GO`,
      description: clampDesc(`${l.name} 출장마사지·홈타이 예약 전 ${l.cityName} ${l.type} 생활권 확인 안내.`),
      canonical: `/life/${l.slug}/`, h1: `${l.name} 생활권`,
      ogAlt: `${l.name} 생활권 예약 전 확인 이미지`,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "생활권", href: "/life/" }, { name: l.name, href: `/life/${l.slug}/` }],
      body
    }));
  }
}

function buildStationIndex() {
  const byCity = {};
  for (const s of stations) (byCity[s.cityName] ||= []).push(s);
  const groups = Object.entries(byCity).map(([city, list]) => `<div class="card"><h3>${esc(city)}</h3><nav class="linkcluster">${list.map(s => `<a href="/station/${s.slug}/">${esc(s.name)}</a>`).join("")}</nav></div>`).join("");
  const body = `<div class="section"><span class="eyebrow">지하철역</span><h1>경기남부 주요 지하철역</h1>
    <p class="lead">역명 기준으로 위치를 안내합니다. 환승역도 노선별로 나누지 않고 역명 기준 1개 페이지로 관리합니다.</p>
    <div class="grid grid-2">${groups}</div></div>
    ${whoHowWhy("경기남부 도시별 주요 지하철역과 인접 생활권 안내")}`;
  write("station", layout({
    title: "경기남부 지하철역 안내｜역세권 생활권 | 간다GO",
    description: "경기남부 출장마사지 주요 지하철역별 역세권 생활권·이동 기준 안내.",
    canonical: "/station/", h1: "경기남부 주요 지하철역",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "지하철역", href: "/station/" }],
    body
  }));
}

function buildStations() {
  for (const s of stations) {
    const c = cityBy(s.city);
    const life = lifeAreas.find(l => l.name === s.life);
    const sameCity = stations.filter(x => x.city === s.city && x.slug !== s.slug).slice(0, 5).map(x => ({ href: `/station/${x.slug}/`, text: x.name }));
    const transferNote = s.transfer ? `${s.name}은(는) 환승 성격이 있는 역이지만, 출구별·노선별로 페이지를 나누지 않고 역명 기준 한 곳으로 안내해 중복을 줄입니다.` : `${s.name}은(는) 역명 기준으로 위치를 안내합니다.`;
    const body = `
    ${heroBanner(esc(s.cityName) + (s.district ? " · " + esc(s.district) : "") + " 역세권", esc(s.name) + " 출장마사지 · 역세권 생활권 안내", esc(s.note))}
    <div class="prose section">
      <h2>역세권 개요</h2>
      <p>${esc(s.name)}은(는) ${esc(s.cityName)}${s.district ? " " + esc(s.district) : ""} ${esc((s.dongs || []).join("·"))} 인근의 역세권으로, ${esc(s.life)} 생활권과 이어집니다. 역명은 위치를 설명하는 데 도움이 되지만 실제 방문 가능 여부는 정확한 주소와 건물 출입 방식까지 함께 확인해야 합니다.</p>
      <h2>환승·출구 안내</h2><p>${esc(transferNote)} 출구 방향은 참고용이며 건물 주소로 확인합니다.</p>
      <h2>이용 장소별 기준</h2>
      <p>역 주변 오피스텔은 공동현관·관리 규정을, 숙소는 외부인 방문 정책과 객실 출입 방식을, 상권 건물은 보안·예약 가능 시간을 확인합니다.</p>
    </div>
    ${stationDetail(s)}
    ${typeGuidance(s.note + " " + (life ? life.type : ""))}
    ${linkCluster("상위 도시·생활권", [{ href: `/city/${s.city}/`, text: `${s.cityName} 안내` }, life ? { href: `/life/${life.slug}/`, text: `${life.name} 생활권` } : null])}
    ${linkCluster("같은 도시 다른 역", sameCity)}
    ${checklistBlock(["역명이 아닌 정확한 방문 주소를 확인했나요?", "건물 공동현관·출입 방식을 확인했나요?", "가까운 생활권을 확인했나요?", "예약 가능 시간을 확인했나요?", "개인정보 처리 기준을 확인했나요?"])}
    ${linkCluster("이용 장소 · 예약 전 확인", [
      { href: "/use/station-area/", text: "역세권 이용" },
      { href: "/use/hotel/", text: "호텔·숙소 이용" },
      { href: "/check/building-access/", text: "건물 출입 방식" },
      { href: "/contact/", text: "문의하기" }
    ])}
    ${faqBlock(SHARED_FAQ.slice(3, 6))}
    ${whoHowWhy(`${s.name} 인접 생활권·행정동과 이용 장소별 확인사항`)}`;
    write(`station/${s.slug}`, layout({
      title: `${s.name} 출장마사지 역세권 안내 | 간다GO`,
      description: clampDesc(`${s.name} 출장마사지·홈타이 예약 전 ${s.cityName} ${s.life} 역세권 확인 안내.`),
      canonical: `/station/${s.slug}/`, h1: `${s.name} 출장마사지`,
      ogAlt: `${s.name} 역세권 생활권 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "지하철역", href: "/station/" }, { name: s.name, href: `/station/${s.slug}/` }],
      body
    }));
  }
}

function buildUseIndex() {
  const body = `<div class="section"><span class="eyebrow">이용 장소</span><h1>이용 장소별 안내</h1>
    <p class="lead">자택·호텔·오피스텔·업무지구·역세권·신도시·산업지구·야간·외곽 이용 전 확인사항을 안내합니다.</p>
    <div class="grid grid-3">${useCases.map(u => `<a class="card" href="/use/${u.slug}/"><h3>${esc(u.name)}</h3><p>${esc(u.why)}</p></a>`).join("")}</div></div>
    ${whoHowWhy("이용 장소별 방문 전 확인사항 안내")}`;
  write("use", layout({
    title: "경기남부 이용 장소별 안내｜자택·호텔·오피스텔 | 간다GO",
    description: "경기남부 출장마사지 자택·호텔·오피스텔·업무지구 등 이용 장소별 확인 안내.",
    canonical: "/use/", h1: "이용 장소별 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "이용 장소", href: "/use/" }],
    body
  }));
}

function buildUseCases() {
  for (const u of useCases) {
    const cityLinks = cities.slice(0, 9).map(c => ({ href: `/city/${c.slug}/`, text: `${c.name} 안내` }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">이용 장소</span>
      <h1>${esc(u.h1)}</h1>
      <p class="lead">${esc(u.why)}</p>
      ${(u.long || []).map((p, i) => (i === 1 ? `<h2>경기남부 지역별 참고</h2>` : "") + `<p>${esc(p)}</p>`).join("")}
      <h2>확인해야 할 내용</h2>
      <ul class="checklist">${u.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      ${(u.close || []).length ? `<h2>예약 팁 · 간다GO 안내</h2>${u.close.map(p => `<p>${esc(p)}</p>`).join("")}` : ""}
      <p>코스와 요금이 궁금하면 <a href="/price/">코스·가격 안내</a>에서, 예약은 <a href="/contact/">문의하기</a>에서 확인할 수 있습니다. 방문 지역과 이용 장소 정보를 미리 준비해두면 이동과 예약이 한결 수월합니다.</p>
    </div>
    ${linkCluster("도시별 안내", cityLinks)}
    ${linkCluster("예약 전 확인", checks.slice(0, 5).map(ch => ({ href: `/check/${ch.slug}/`, text: ch.name })))}
    ${faqBlock(SHARED_FAQ)}
    ${whoHowWhy(`${u.name} 방문 전 확인사항과 경기남부 지역별 이용 기준`)}`;
    write(`use/${u.slug}`, layout({
      title: `${u.h1} | 간다GO`,
      description: u.metaDescription,
      canonical: `/use/${u.slug}/`, h1: u.h1,
      ogAlt: `${u.name} 이용 기준 안내 이미지`,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "이용 장소", href: "/use/" }, { name: u.name, href: `/use/${u.slug}/` }],
      body
    }));
  }
}

function buildCheckIndex() {
  const body = `<div class="section"><span class="eyebrow">예약 전 확인</span><h1>예약 전 확인 안내</h1>
    <p class="lead">방문 주소·건물 출입·추가 이동비·예약 시간·개인정보·서비스 정책을 예약 전에 확인하세요.</p>
    <div class="grid grid-3">${checks.map(ch => `<a class="card" href="/check/${ch.slug}/"><h3>${esc(ch.name)}</h3><p>${esc(ch.metaDescription)}</p></a>`).join("")}</div></div>
    ${whoHowWhy("예약 전 확인 항목과 경기남부 지역별 차이 안내")}`;
  write("check", layout({
    title: "경기남부 출장마사지 예약 전 확인 안내 | 간다GO",
    description: "경기남부 출장마사지 예약 전 방문 주소·출입·이동비·개인정보 확인 안내.",
    canonical: "/check/", h1: "예약 전 확인 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "예약 전 확인", href: "/check/" }],
    body
  }));
}

function buildChecks() {
  for (const ch of checks) {
    const others = checks.filter(x => x.slug !== ch.slug).map(x => ({ href: `/check/${x.slug}/`, text: x.name }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">예약 전 확인</span>
      <h1>${esc(ch.h1)}</h1>
      <p class="lead">${esc(ch.body)}</p>
      ${(ch.long || []).map((p, i) => (i === 1 ? `<h2>경기남부 지역별 참고</h2>` : "") + `<p>${esc(p)}</p>`).join("")}
      <h2>확인 항목</h2>
      <ul class="checklist">${ch.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      ${(ch.close || []).length ? `<h2>예약 팁 · 간다GO 안내</h2>${ch.close.map(p => `<p>${esc(p)}</p>`).join("")}` : ""}
      <p>코스와 요금은 <a href="/price/">코스·가격 안내</a>에서, 예약은 <a href="/contact/">문의하기</a>에서 확인할 수 있습니다. 예약 전 확인 항목을 미리 정리해두면 이동과 예약이 한결 수월합니다.</p>
    </div>
    ${linkCluster("다른 확인 항목", others)}
    ${linkCluster("이용 장소", useCases.slice(0, 5).map(u => ({ href: `/use/${u.slug}/`, text: u.name })))}
    ${faqBlock(SHARED_FAQ)}
    ${whoHowWhy(`${ch.name} 항목과 경기남부 도시·생활권별 차이`)}`;
    write(`check/${ch.slug}`, layout({
      title: `${ch.h1} | 간다GO`,
      description: ch.metaDescription,
      canonical: `/check/${ch.slug}/`, h1: ch.h1,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "예약 전 확인", href: "/check/" }, { name: ch.name, href: `/check/${ch.slug}/` }],
      body
    }));
  }
}

function buildPolicies() {
  for (const po of policies) {
    const others = policies.filter(x => x.slug !== po.slug).map(x => ({ href: `/policy/${x.slug}/`, text: x.name }));
    const body = `
    <div class="prose section">
      <span class="eyebrow">운영 기준</span>
      <h1>${esc(po.h1)}</h1>
      ${po.sections.map(s => `<h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>`).join("")}
    </div>
    ${linkCluster("운영 기준 · 안내", others.concat([{ href: "/contact/", text: "문의하기" }]))}`;
    write(`policy/${po.slug}`, layout({
      title: `${po.h1} | 간다GO`,
      description: po.metaDescription,
      canonical: `/policy/${po.slug}/`, h1: po.h1,
      breadcrumb: [{ name: "홈", href: "/" }, { name: "운영 기준", href: "/policy/authors/" }, { name: po.name, href: `/policy/${po.slug}/` }],
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
    { href: "/policy/privacy-policy/", text: "개인정보 처리방침" },
    { href: "/policy/service-standard/", text: "불법·선정적 서비스 불가 안내" },
    { href: "/check/customer-notice/", text: "고객 유의사항" }
  ])}`;
  write("contact", layout({
    title: "간다GO 문의하기｜예약·제작·제휴 문의",
    description: `간다GO 예약 문의 ${site.phone}. 웹사이트 제작·제휴 문의는 텔레그램으로 접수합니다.`,
    canonical: "/contact/", h1: "간다GO 문의하기",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "문의하기", href: "/contact/" }],
    extraSchema: [{
      "@type": "ContactPage", "@id": site.baseUrl + "/contact/#contact",
      url: site.baseUrl + "/contact/"
    }],
    body
  }));
}

function buildPrice() {
  const offers = site.courses.map(c => ({
    "@type": "Offer",
    name: c.name,
    price: c.price.replace(/,/g, ""),
    priceCurrency: "KRW",
    description: c.desc
  }));
  const body = `
  <div class="prose section" style="max-width:none">
    <span class="eyebrow">코스 · 가격</span>
    <h1>경기남부 출장마사지 코스·가격 안내</h1>
    <p class="lead">간다GO 기본 코스와 정찰 요금입니다. 실제 금액은 방문 지역, 인원, 코스, 시간대, 외곽 이동 여부에 따라 달라질 수 있으니 예약 문의로 정확히 안내받으세요.</p>
  </div>
  ${courseMenu()}
  <div class="prose section" style="max-width:none">
    <h2>요금에 영향을 주는 요소</h2>
    <ul>
      <li><strong>코스 시간</strong> — 60·90·120분 등 코스 길이에 따라 기본 요금이 달라집니다.</li>
      <li><strong>지역·이동 거리</strong> — 도심 생활권과 외곽·산업지구는 <a href="/check/travel-fee/">추가 이동비 기준</a>이 다를 수 있습니다.</li>
      <li><strong>인원·시간대</strong> — 인원 구성과 야간 예약 여부에 따라 안내 금액이 달라질 수 있습니다.</li>
    </ul>
    <p>표시 요금은 기본 정찰가이며, 허위·과장된 가격 문구나 즉시 할인 보장 표현은 사용하지 않습니다. 정확한 금액은 예약 전에 안내받는 것이 좋습니다.</p>
    <h2>코스별 안내</h2>
    <p><strong>60분 코스(90,000원)</strong>는 가벼운 피로 회복과 전신 이완을 위한 기본 코스로, 짧은 시간에 뭉친 부위를 풀고 싶은 분께 적합합니다. <strong>90분 코스(150,000원)</strong>는 전신 균형과 깊은 이완까지 챙기는 인기 코스로, 어깨·허리 등 특정 부위와 전신을 함께 관리하고 싶을 때 선택하는 경우가 많습니다. <strong>120분 코스(180,000원)</strong>는 충분한 시간으로 머리부터 발끝까지 집중 관리하는 코스로, 여유 있게 전신을 꼼꼼히 관리하고 싶은 분께 적합합니다.</p>
    <p>코스는 방문 후 상태에 따라 조정될 수 있으며, 인원이 둘 이상이거나 특정 부위 집중 관리가 필요한 경우 예약 시 미리 알려주시면 코스와 소요 시간을 함께 안내드립니다. 표시 요금은 1인 기준 정찰가로, 인원과 코스 구성에 따라 안내 금액이 달라질 수 있습니다.</p>
    <h2>지역별 요금 참고</h2>
    <p>경기남부는 수원·성남·안양·군포처럼 도심·역세권은 이동이 빨라 기본 정찰가로 안내되는 경우가 많습니다. 반면 용인 처인구, 화성 향남·남양, 안성·이천·여주, 평택 안중·포승 같은 외곽과 반월·시화·고덕 같은 산업권은 차량 이동 거리가 길어 코스 요금 외 추가 이동비가 발생할 수 있습니다. 방문 주소를 기준으로 이동 거리를 산정해 예약 전에 안내드리므로, 정확한 지역을 알려주시면 총 금액을 미리 확인하실 수 있습니다.</p>
    <p>야간·심야 시간대나 예약이 몰리는 시간대에는 이동 조건이 달라질 수 있어, 예약 문의 시 방문 지역과 희망 시간을 함께 알려주시면 코스·시간·이동비를 종합해 안내드립니다. 개인정보는 예약 확인과 연락에 필요한 최소한만 받으며, 불법·선정적 서비스는 제공하거나 안내하지 않습니다.</p>
    <h2>코스 선택이 고민된다면</h2>
    <p>처음이거나 어떤 코스가 맞을지 고민된다면, 관리받고 싶은 부위와 사용 가능한 시간을 알려주세요. 가벼운 이완이 목적이면 60분, 전신 균형까지 챙기려면 90분, 여유 있게 집중 관리를 원하면 120분 코스가 무난합니다. 예약 문의 시 상태와 희망 사항을 말씀해주시면 코스와 소요 시간을 함께 안내드립니다.</p>
    <p>표시 요금은 모든 지역 공통의 기본 정찰가로 안내하며, 지역·인원·시간대에 따른 차이는 예약 전에 투명하게 알려드립니다. 과장된 할인 문구나 즉시 최저가 보장 같은 표현은 사용하지 않으며, 정찰가와 추가 이동비 기준을 미리 확인하실 수 있도록 안내하는 것을 원칙으로 합니다.</p>
  </div>
  ${linkCluster("예약 전 확인 · 문의", [
    { href: "/check/travel-fee/", text: "추가 이동비 기준" },
    { href: "/check/time/", text: "예약 가능 시간" },
    { href: "/check/service-policy/", text: "불법·선정적 서비스 불가 안내" },
    { href: "/contact/", text: "문의하기" }
  ])}
  ${whoHowWhy("간다GO 기본 코스 구성과 정찰 요금, 요금 변동 요소")}`;
  write("price", layout({
    title: "경기남부 출장마사지 코스·가격 안내 | 간다GO",
    description: "경기남부 출장마사지 60·90·120분 코스 정찰 요금과 요금 변동 요소 안내.",
    canonical: "/price/", h1: "경기남부 출장마사지 코스·가격 안내",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "코스·가격 안내", href: "/price/" }],
    extraSchema: [{
      "@type": "Service",
      "@id": site.baseUrl + "/price/#service",
      serviceType: "출장마사지",
      name: "경기남부 출장마사지",
      areaServed: site.org.areaServed,
      provider: { "@id": site.baseUrl + "/#organization" },
      hasOfferCatalog: { "@type": "OfferCatalog", name: "출장마사지 코스", itemListElement: offers }
    }],
    body
  }));
}

function buildReviews() {
  const a = reviews.aggregate;
  const cards = reviews.items.map(reviewCard).join("");
  const body = `
  <div class="prose section" style="max-width:none">
    <span class="eyebrow">이용 후기</span>
    <h1>간다GO 방문 관리 이용 후기</h1>
    <p class="lead">경기남부 자택·호텔·오피스텔·회사 등 다양한 장소에서 방문 관리를 이용하신 고객 후기입니다. 실제 이용 상황과 만족도를 참고하세요.</p>
    <div class="review-agg review-agg-lg">${stars(Math.round(Number(a.ratingValue)))}<strong>${a.ratingValue}</strong><span>／ 5.0 · 후기 ${a.reviewCount}건</span></div>
  </div>
  <section class="section"><div class="grid grid-3 review-grid">${cards}</div></section>
  ${linkCluster("코스·예약 안내", [
    { href: "/price/", text: "코스·가격 안내" },
    { href: "/use/home/", text: "자택 이용 전 확인" },
    { href: "/use/hotel/", text: "호텔·숙소 이용 전 확인" },
    { href: "/contact/", text: "문의하기" }
  ])}
  ${whoHowWhy("간다GO 방문 관리 이용 고객의 실제 후기와 만족도")}`;
  write("reviews", layout({
    title: "간다GO 이용 후기｜방문 관리 후기·별점",
    description: "간다GO 경기남부 방문 관리 이용 후기와 별점. 자택·호텔·오피스텔 이용 후기 안내.",
    canonical: "/reviews/", h1: "간다GO 이용 후기",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "이용 후기", href: "/reviews/" }],
    extraSchema: [{
      "@type": "Service",
      "@id": site.baseUrl + "/reviews/#service",
      serviceType: "출장마사지",
      name: "경기남부 출장마사지",
      areaServed: site.org.areaServed,
      provider: { "@id": site.baseUrl + "/#organization" },
      aggregateRating: aggregateRatingSchema(),
      review: reviewSchemaItems()
    }],
    body
  }));
}

function buildNotFound() {
  const body = `
  <section class="hero" style="text-align:center">
    <span class="eyebrow">404</span>
    <h1 style="max-width:none">페이지를 찾을 수 없습니다</h1>
    <p class="lead" style="margin-inline:auto">주소가 바뀌었거나 삭제된 페이지일 수 있습니다. 아래에서 원하는 지역 안내로 이동해 보세요.</p>
    <div class="cta-row" style="justify-content:center">
      <a class="btn btn-primary btn-lg" href="/">경기남부 홈</a>
      <a class="btn btn-ghost btn-lg" href="/city/">도시 안내</a>
      <a class="btn btn-ghost btn-lg" href="/dong/">행정동 안내</a>
      <a class="btn btn-ghost btn-lg" href="/contact/">문의하기</a>
    </div>
  </section>`;
  const html = layout({
    title: "페이지를 찾을 수 없습니다 (404) | 간다GO",
    description: "요청하신 페이지를 찾을 수 없습니다. 경기남부 지역 안내로 이동해 주세요.",
    canonical: "/404.html", h1: "페이지를 찾을 수 없습니다",
    breadcrumb: [{ name: "홈", href: "/" }, { name: "404" }],
    noindex: true, skipSitemap: true, body
  });
  writeFileSync(join(OUT, "404.html"), html);
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
  // public/ 폴더가 있으면 dist/ 루트로 복사 (직접 올린 이미지 등)
  const pub = join(__dirname, "public");
  if (existsSync(pub)) cpSync(pub, OUT, { recursive: true });
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
buildDongIndex(); buildDongs();
buildLifeIndex(); buildLifeAreas();
buildStationIndex(); buildStations();
buildUseIndex(); buildUseCases();
buildCheckIndex(); buildChecks();
buildPolicies();
buildPrice();
buildReviews();
buildContact();
buildNotFound();
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
