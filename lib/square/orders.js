// Turns Square Orders API orders into the same sales rows an uploaded file
// produces (see public/js/parser.js buildRows):
//   { date, time, item, variation, quantity, price, orderType, orderId, customerId, kind }
// One row per line item. `price` is the per-unit GROSS amount (before
// discounts), matching how Square's own Transactions export ("Gross Sales")
// is read. Must stay deterministic: the browser de-duplicates re-synced
// orders by fingerprinting these fields.

const FULFILLMENT_LABELS = { PICKUP: "Pickup", DELIVERY: "Delivery", SHIPMENT: "Shipping" };

const formatters = new Map();
function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    let f;
    try {
      f = new Intl.DateTimeFormat("en-US", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      });
    } catch {
      f = formatterFor("UTC"); // unknown time zone name
    }
    formatters.set(timeZone, f);
  }
  return formatters.get(timeZone);
}

// "2026-09-30T23:15:00Z" in "America/New_York" -> { date: "2026-09-30", time: "19:15" }
export function localDateTime(iso, timeZone) {
  const parts = {};
  formatterFor(timeZone || "UTC").formatToParts(new Date(iso)).forEach((p) => { parts[p.type] = p.value; });
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function cents(money) {
  return money && Number.isFinite(Number(money.amount)) ? Number(money.amount) : null;
}

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

// Square's customer id is an opaque code (no name, email or phone). It is
// passed through to the browser only so the Customers page can tell new from
// returning customers; the browser scrambles it with this device's secret
// salt before saving and keeps only that. The server never stores it.
function customerRef(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

// timeZones: { [location_id]: "America/New_York", ... }
export function ordersToRows(orders, timeZones) {
  const rows = [];
  for (const order of orders || []) {
    if (!order || order.state !== "COMPLETED" || !order.closed_at || !order.id) continue;
    const { date, time } = localDateTime(order.closed_at, timeZones[order.location_id]);
    const fulfillment = Array.isArray(order.fulfillments) && order.fulfillments[0] ? order.fulfillments[0].type : null;
    const base = { date, time, orderType: FULFILLMENT_LABELS[fulfillment] || null, orderId: order.id, customerId: customerRef(order.customer_id) };

    const lines = Array.isArray(order.line_items) ? order.line_items : [];
    if (!lines.length) {
      // An amount rung up with no itemization at all.
      const total = cents(order.total_money);
      if (total) rows.push({ ...base, item: "Payment", variation: null, quantity: 1, price: total / 100, kind: "custom" });
      continue;
    }

    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      let gross = cents(line.gross_sales_money);
      if (gross === null) {
        const unit = cents(line.base_price_money);
        if (unit === null) continue;
        gross = Math.round(unit * qty);
      }
      // A custom amount's "name" is whatever note was typed in, which can be
      // personal -- never keep it.
      const custom = line.item_type === "CUSTOM_AMOUNT";
      // Weighed/fractional quantities (e.g. 0.5 lb) become one unit at the line total.
      const whole = Number.isInteger(qty);
      rows.push({
        ...base,
        item: custom ? "Custom Amount" : clean(line.name) || "Item",
        variation: custom ? null : clean(line.variation_name) || null,
        quantity: whole ? qty : 1,
        price: whole ? Math.round(gross / qty) / 100 : gross / 100,
        kind: custom ? "custom" : "product",
      });
    }
  }
  return rows;
}
