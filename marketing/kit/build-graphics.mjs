// Builds the editable SVG marketing graphics in this folder from one shared
// design (same palette and type as the home page, css/style.css "Home page").
// Run from the repo root:   node marketing/kit/build-graphics.mjs
// Then export PNGs (see README.md in this folder). All figures are SAMPLE /
// fictional, matching the home page's sample brief.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const C = { paper: "#F6F0E4", ink: "#1E1B18", muted: "#6B6156", rule: "#D9CCB4", receipt: "#FFFDF7", accent: "#C2410C", mark: "#FFE9A8" };
const FONTS = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&amp;family=Fraunces:opsz,wght@9..144,700&amp;family=JetBrains+Mono:wght@500;700&amp;family=Noto+Sans+SC:wght@500;700&amp;display=swap";
const F = {
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  sans: "'DM Sans', 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif",
  zh: "'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif",
  mono: "'JetBrains Mono', Consolas, 'Courier New', monospace",
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TEXT = {
  en: {
    kicker: "FOR TAKEOUT SHOPS & CAFÉS",
    head: ["One sales recap.", "One thing to try", "next week."],
    headFont: F.serif,
    sub: ["A weekly sales brief from your register", "export, in English and 中文."],
    brand: "TALLY · WEEKLY BRIEF",
    sample: "Sample shop · fictional numbers",
    rows: [
      ["SPOT", "Lunch orders with a side", "16 → 8 /100"],
      ["TRY", "Offer one side at lunch, 1 week", ""],
      ["CHECK", "Sides per 100 lunch orders", "___"],
    ],
    cta: "Try the sample brief",
    url: "bus-idea.pages.dev",
    note: "Sample data. Fictional shop and numbers.",
  },
  zh: {
    kicker: "面向外卖店和咖啡店",
    head: ["一份销售小结。", "下周试一件事。"],
    headFont: F.zh,
    sub: ["用收银机导出的数据，", "生成中英双语的每周销售简报。"],
    brand: "TALLY · 每周简报",
    sample: "示例店铺 · 虚构数字",
    rows: [
      ["发现", "午餐带配菜的单数", "16 → 8 /100"],
      ["尝试", "午餐时推荐一样配菜，坚持一周", ""],
      ["检查", "每 100 张午餐订单的配菜数", "___"],
    ],
    cta: "看看示例简报",
    url: "bus-idea.pages.dev",
    note: "示例数据。店铺和数字都是虚构的。",
  },
};

// A receipt card: top-left at (x, y), width w, row height rh, font scale s.
function receipt(x, y, w, T, s, lang, rotate = -1.5) {
  const pad = 36 * s, rh = 92 * s;
  const head = 128 * s;
  const h = head + rh * T.rows.length + 70 * s;
  const tooth = 18 * s;
  let edge = `M${x} ${y} H${x + w} V${y + h}`;
  for (let px = x + w; px > x; px -= tooth) edge += ` L${px - tooth / 2} ${y + h + tooth * 0.6} L${Math.max(x, px - tooth)} ${y + h}`;
  edge += " Z";
  const rowFont = lang === "zh" ? F.zh : F.sans;
  const rows = T.rows.map(([label, text, value], i) => {
    const ry = y + head + rh * i;
    const hi = i === 0;
    return `
      <text x="${x + pad}" y="${ry + 40 * s}" font-family="${F.mono}" font-weight="700" font-size="${22 * s}" fill="${C.accent}" letter-spacing="${2 * s}">${i + 1} ${esc(label)}</text>
      <text x="${x + pad}" y="${ry + 76 * s}" font-family="${rowFont}" font-weight="500" font-size="${28 * s}" fill="${C.ink}">${esc(text)}</text>
      ${value ? `${hi ? `<rect x="${x + w - pad - 196 * s}" y="${ry + 52 * s}" width="${196 * s}" height="${30 * s}" fill="${C.mark}"/>` : ""}<text x="${x + w - pad}" y="${ry + 76 * s}" text-anchor="end" font-family="${F.mono}" font-weight="700" font-size="${28 * s}" fill="${hi ? C.accent : C.ink}">${esc(value)}</text>` : ""}
      ${i < T.rows.length - 1 ? `<line x1="${x + pad}" x2="${x + w - pad}" y1="${ry + rh - 4 * s}" y2="${ry + rh - 4 * s}" stroke="${C.rule}" stroke-width="${2 * s}" stroke-dasharray="${4 * s} ${6 * s}"/>` : ""}`;
  }).join("");
  return `
    <g transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})">
      <path d="${edge}" fill="#000" opacity="0.08" transform="translate(${8 * s} ${14 * s})"/>
      <path d="${edge}" fill="${C.receipt}"/>
      <text x="${x + w / 2}" y="${y + 54 * s}" text-anchor="middle" font-family="${lang === "zh" ? F.zh : F.mono}" font-weight="700" font-size="${24 * s}" letter-spacing="${4 * s}" fill="${C.ink}">${esc(T.brand)}</text>
      <text x="${x + w / 2}" y="${y + 90 * s}" text-anchor="middle" font-family="${rowFont}" font-size="${20 * s}" fill="${C.muted}">${esc(T.sample)}</text>
      <line x1="${x + pad}" x2="${x + w - pad}" y1="${y + 112 * s}" y2="${y + 112 * s}" stroke="${C.rule}" stroke-width="${3 * s}" stroke-dasharray="${8 * s} ${8 * s}"/>
      ${rows}
    </g>`;
}

// Button with the URL written underneath (so it is never clipped at the edge).
function cta(x, y, T, s, lang) {
  const font = lang === "zh" ? F.zh : F.sans;
  const label = `${T.cta} →`;
  const w = (lang === "zh" ? 34 : 19) * s * label.length + 90 * s;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${84 * s}" rx="${42 * s}" fill="${C.accent}"/>
    <text x="${x + w / 2}" y="${y + 54 * s}" text-anchor="middle" font-family="${font}" font-weight="700" font-size="${34 * s}" fill="#fff">${esc(label)}</text>
    <text x="${x}" y="${y + 136 * s}" font-family="${F.mono}" font-weight="700" font-size="${30 * s}" fill="${C.ink}">${esc(T.url)}</text>`;
}
const receiptH = (s) => (128 + 92 * 3 + 70 + 18) * s;

function svg(w, h, title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
  <title>${esc(title)}</title>
  <style>@import url('${FONTS}');</style>
  <rect width="${w}" height="${h}" fill="${C.paper}"/>
${body}
</svg>
`;
}

function lines(x, y, list, size, font, weight, fill, gap) {
  return list.map((l, i) => `<text x="${x}" y="${y + i * gap}" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(l)}</text>`).join("\n");
}

// Stacks kicker, headline, subline, receipt and button top to bottom.
function poster(lang, W, H, o) {
  const T = TEXT[lang];
  const font = lang === "zh" ? F.zh : F.sans;
  const headSize = lang === "zh" ? o.zhHead : o.enHead;
  const gap = Math.round(headSize * (lang === "zh" ? 1.22 : 1.08));
  const headTop = o.top + Math.round(headSize * 1.05) + 10;
  const subGap = Math.round(o.sub * 1.35);
  const subTop = headTop + gap * (T.head.length - 1) + Math.round(o.sub * 2.1);
  const recY = subTop + subGap * (T.sub.length - 1) + Math.round(o.sub * 1.6);
  const ctaY = recY + receiptH(o.rs) + o.space;
  return svg(W, H, `Tally: ${T.head.join(" ")}`, `
  ${lines(90, o.top, [T.kicker], o.kicker, font, 700, C.accent, 0)}
  ${lines(90, headTop, T.head, headSize, T.headFont, 700, C.ink, gap)}
  ${lines(90, subTop, T.sub, o.sub, font, 500, "#3A332C", subGap)}
  ${receipt(90, recY, 900, T, o.rs, lang, o.rot)}
  ${cta(90, ctaY, T, o.cs, lang)}
  <text x="${W - 90}" y="${H - 40}" text-anchor="end" font-family="${font}" font-size="${o.note}" fill="${C.muted}">${esc(T.note)}</text>`);
}
const square = (lang) => poster(lang, 1080, 1080, { top: 96, kicker: 24, enHead: 76, zhHead: 80, sub: 30, rs: 0.78, rot: -1.5, cs: 0.85, space: 34, note: 18 });
const vertical = (lang) => poster(lang, 1080, 1920, { top: 300, kicker: 34, enHead: 112, zhHead: 118, sub: 42, rs: 1.2, rot: -2, cs: 1.1, space: 90, note: 26 });

function og() {
  const T = TEXT.en;
  return svg(1200, 630, "Tally: one sales recap, one thing to try next week", `
  ${lines(70, 100, [T.kicker], 22, F.sans, 700, C.accent, 0)}
  ${lines(70, 182, T.head, 62, F.serif, 700, C.ink, 70)}
  ${lines(70, 400, ["A weekly sales brief from your", "register export, in English and 中文."], 26, F.sans, 500, "#3A332C", 36)}
  <text x="70" y="532" font-family="${F.mono}" font-weight="700" font-size="28" fill="${C.ink}">${esc(T.url)}</text>
  <text x="70" y="574" font-family="${F.sans}" font-size="18" fill="${C.muted}">${esc(T.note)}</text>
  ${receipt(630, 150, 520, T, 0.62, "en", 2)}`);
}

const out = {
  "social-square-en.svg": square("en"),
  "social-square-zh.svg": square("zh"),
  "social-vertical-en.svg": vertical("en"),
  "social-vertical-zh.svg": vertical("zh"),
  "og-image.svg": og(),
};
for (const [name, body] of Object.entries(out)) {
  fs.writeFileSync(path.join(here, name), body);
  console.log("wrote", name);
}
