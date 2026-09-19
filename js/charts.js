// Thin wrappers around Chart.js using the app's warm/cafe color palette.
const COLORS = {
  green: "#1F5C4A",
  lightGreen: "#E7EFE9",
  amber: "#C8781E",
  text: "#1F2421",
  muted: "#4A524D",
  border: "#E4DDCF",
};

Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.color = COLORS.muted;

const chartRegistry = new Map();

function destroyChart(canvasId) {
  const existing = chartRegistry.get(canvasId);
  if (existing) {
    existing.destroy();
    chartRegistry.delete(canvasId);
  }
}

function formatMoney(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMoney2(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatHourLabel(h) {
  const period = h < 12 ? "AM" : "PM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}${period === "AM" ? "am" : "pm"}`;
}

function renderBarChart(canvasId, labels, data, opts) {
  opts = opts || {};
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const highlightIdx = new Set(opts.highlightIndexes || []);
  const colors = data.map((_, i) => (highlightIdx.has(i) ? COLORS.amber : COLORS.green));
  const chart = new Chart(canvas, {
    type: opts.horizontal ? "bar" : "bar",
    data: {
      labels,
      datasets: [{
        label: opts.datasetLabel || "",
        data,
        backgroundColor: colors,
        borderRadius: 4,
        maxBarThickness: opts.horizontal ? 28 : 34,
      }],
    },
    options: {
      indexAxis: opts.horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => (opts.tooltipFormatter ? opts.tooltipFormatter(ctx) : formatMoney(ctx.parsed[opts.horizontal ? "x" : "y"])),
          },
        },
      },
      onClick: opts.onClick,
      scales: {
        x: {
          grid: { display: !opts.horizontal, color: COLORS.border },
          ticks: opts.horizontal ? {} : { autoSkip: true, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.border },
          ticks: opts.horizontal ? {} : { callback: (v) => formatMoney(v) },
        },
      },
    },
  });
  chartRegistry.set(canvasId, chart);
  return chart;
}

function renderLineChart(canvasId, labels, data, opts) {
  opts = opts || {};
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  // opts.markerIndexes: array of data indexes that have a holiday/note to flag (drawn in amber).
  // opts.markerLabelFn: (index) => array of short strings to append to that point's tooltip.
  const markerSet = new Set(opts.markerIndexes || []);
  const pointColors = data.map((_, i) => (markerSet.has(i) ? COLORS.amber : COLORS.green));
  const pointRadii = data.map((_, i) => (markerSet.has(i) ? 6 : 4));
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: opts.datasetLabel || "",
        data,
        borderColor: COLORS.green,
        backgroundColor: COLORS.lightGreen,
        fill: true,
        tension: 0.25,
        pointBackgroundColor: pointColors,
        pointRadius: pointRadii,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatMoney(ctx.parsed.y),
            afterBody: opts.markerLabelFn ? (items) => (items[0] ? opts.markerLabelFn(items[0].dataIndex) : []) : undefined,
          },
        },
      },
      onClick: opts.onClick,
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: COLORS.border }, ticks: { callback: (v) => formatMoney(v) } },
      },
    },
  });
  chartRegistry.set(canvasId, chart);
  return chart;
}

function renderDoughnutChart(canvasId, labels, data, opts) {
  opts = opts || {};
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const palette = [COLORS.green, COLORS.amber, "#7BA88F", "#D9A25C", "#4A524D"];
  const chart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: labels.map((_, i) => palette[i % palette.length]) }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: COLORS.text } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed)}` } },
      },
      onClick: opts.onClick,
    },
  });
  chartRegistry.set(canvasId, chart);
  return chart;
}

// Renders a day-of-week x hour-of-day heatmap as a plain HTML/CSS grid (accessible,
// no extra chart library needed) into the given container element.
function renderHeatmap(container, grid, opts) {
  opts = opts || {};
  container.innerHTML = "";
  let max = 0;
  grid.forEach((row) => row.forEach((v) => { if (v > max) max = v; }));

  const table = document.createElement("table");
  table.className = "heatmap-table";
  table.setAttribute("role", "table");

  const openHours = opts.hours || Array.from({ length: 24 }, (_, i) => i);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  openHours.forEach((h) => {
    const th = document.createElement("th");
    th.textContent = formatHourLabel(h);
    th.scope = "col";
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let dow = 0; dow < 7; dow++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = opts.dayLabels[dow];
    tr.appendChild(th);
    openHours.forEach((h) => {
      const v = grid[dow][h];
      const td = document.createElement("td");
      const intensity = max > 0 ? v / max : 0;
      td.style.backgroundColor = `rgba(31, 92, 74, ${0.06 + intensity * 0.85})`;
      td.style.color = intensity > 0.55 ? "#FFFDF8" : COLORS.text;
      const label = opts.cellLabel ? opts.cellLabel(dow, h, v) : formatMoney(v);
      td.title = label;
      td.setAttribute("aria-label", label);
      td.tabIndex = 0;
      td.textContent = v > 0 ? formatMoney(v) : "";
      if (opts.onCellClick) {
        td.addEventListener("click", () => opts.onCellClick(dow, h, v));
        td.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); opts.onCellClick(dow, h, v); }
        });
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}
