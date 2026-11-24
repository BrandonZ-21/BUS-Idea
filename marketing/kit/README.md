# Tally marketing kit

Everything here is local. Nothing has been posted, sent or uploaded. All numbers on
the graphics are a **fictional sample shop**, the same one as the home page's sample
brief, and each graphic says so.

| File | Size | What it is |
|---|---|---|
| `social-square-en.svg` / `.png` | 1080×1080 | Feed post, English |
| `social-square-zh.svg` / `.png` | 1080×1080 | Feed post, Chinese (ZH-REVIEW) |
| `social-vertical-en.svg` / `.png` | 1080×1920 | Story / status, English |
| `social-vertical-zh.svg` / `.png` | 1080×1920 | Story / status, Chinese (ZH-REVIEW) |
| `og-image.svg` / `.png` | 1200×630 | Link preview. Copied to `public/og-image.png` and referenced by the Open Graph tags in `public/index.html` |
| `../../public/handout.html` | Letter | Printable bilingual QR handout (open `http://localhost:8080/handout.html`, then Print) |
| `handout-print-preview.pdf` | Letter | What the handout prints like |
| `outreach-drafts.md` | | Email and text/WeChat drafts, EN + ZH. Drafts only |
| `screenshots/` | | Before/after screenshots of the home page |

## Editing the graphics

The SVGs are generated so all four stay consistent. Change the words in
`build-graphics.mjs` (the `TEXT` block), then from the repo root run:

```powershell
node marketing\kit\build-graphics.mjs
```

```powershell
powershell -ExecutionPolicy Bypass -File marketing\kit\export-png.ps1
```

The second command uses Microsoft Edge to make the PNGs and copies `og-image.png`
into `public/`. It needs internet for the web fonts. The SVGs also open and edit in
Figma, Illustrator or Inkscape. Fonts there: Fraunces, DM Sans, JetBrains Mono, Noto
Sans SC.

## Captions and alt text

One action everywhere: **try the sample brief.**

**Square / vertical, English**
- Caption: "One sales recap. One thing to try next week. Tally reads your register's
  sales export and gives your team a short weekly brief in English or Chinese. Try
  the sample brief, no sign-up: bus-idea.pages.dev"
- Alt text: "Headline: One sales recap. One thing to try next week. Below it, a
  receipt-style sample brief for a fictional shop: Spot, lunch orders with a side fell
  from 16 to 8 per 100. Try, offer one side at lunch for one week. Check, sides per
  100 lunch orders. Button: Try the sample brief, bus-idea.pages.dev."

**Square / vertical, Chinese (ZH-REVIEW)**
- 文案：「一份销售小结，下周试一件事。Tally 读取收银机导出的销售数据，给你的团队一份中英双语的每周简报。不用注册，先看看示例简报：bus-idea.pages.dev」
- 替代文字：「标题：一份销售小结。下周试一件事。下方是一张收据样式的示例简报，店铺和数字都是虚构的：发现，午餐带配菜的单数从每 100 单 16 单降到 8 单；尝试，午餐时推荐一样配菜，坚持一周；检查，每 100 张午餐订单的配菜数。按钮：看看示例简报，bus-idea.pages.dev。」

**Link preview (og-image)**
- Alt text (also in the `og:image:alt` tag): "A receipt-style sample weekly brief with
  Spot, Try and Check steps beside the headline: One sales recap. One thing to try
  next week."

## Checks done

- All five PNGs were rendered with Edge and inspected by eye: no clipped text, and
  the Chinese characters render (no empty boxes).
- The handout prints to one letter page (see the PDF). Its QR code is generated from
  `appUrl` in `public/js/config.js`, which is `https://bus-idea.pages.dev/`, and the
  same address is written under the code as a fallback.
- **Not done:** decoding the printed QR with a scanner. Scan it with a phone camera
  before printing a stack.
- The `og:image` URL only works after the site is deployed with `public/og-image.png`.
  Until then, link previews show no image.
