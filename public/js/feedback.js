// "Give feedback" link + QR code helpers, shared by the app and the
// printable card (card.html). The link comes from js/config.js and is used
// exactly as written: nothing is added to it, and no request is made from
// here -- the form only opens when someone clicks or scans.

// The configured form link, or null when it's empty or not a plain https
// link (so a typo in config.js hides the feedback links instead of sending
// people somewhere odd).
function feedbackUrl(config) {
  const raw = String(((config === undefined ? TALLY_CONFIG : config) || {}).feedbackFormUrl || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// A QR code for `text` as an <svg> string, drawn in this browser by
// js/vendor/qrcode-generator.js (no QR service is called). Scales to its
// container; `quiet` is the blank border, in modules, scanners need.
function qrSvg(text, { quiet = 4, label = "QR code" } = {}) {
  const qr = qrcode(0, "M"); // 0 = smallest size that fits; M = survives a smudged print
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(row, col)) path += `M${col + quiet},${row + quiet}h1v1h-1z`;
    }
  }
  const size = n + quiet * 2;
  const safeLabel = String(label).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${safeLabel}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

// Points an <a> at the feedback form, opened in a new tab without telling
// Google which page it came from. Returns false (and hides it) with no link set.
function wireFeedbackLink(a) {
  const url = feedbackUrl();
  a.hidden = !url;
  if (!url) return false;
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.referrerPolicy = "no-referrer";
  return true;
}
