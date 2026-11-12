import { fetchIncidents, ack } from './api.js';
import { formatLocal, formatTitle } from './time.js';

const REFRESH_MS = 2000; // SCHED-4513 (R4)

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const status = document.querySelector('[data-role="status"]');

/** Rows on screen, by incident id. Rows are kept, never rebuilt, so an ack survives every refresh. */
const rows = new Map();

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildRow(i) {
  const li = el('li', { 'data-testid': 'incident-row', 'data-id': i.id, class: `row ${i.severity}` });
  li.append(
    el('span', { class: 'id' }, i.id),
    el('span', { class: 'sev' }, i.severity),
    el('span', { class: 'what' }, `${i.service} · ${i.region} · ${i.summary}`),
    el('time', { datetime: i.openedAt, title: formatTitle(i.openedAt) }, formatLocal(i.openedAt)),
  );
  const slot = el('span', { class: 'slot' });
  const button = el('button', { type: 'button', 'data-testid': 'ack', 'aria-label': `Ack ${i.id}` }, 'Ack');
  button.addEventListener('click', () => onAck(i.id, slot, button));
  slot.append(button);
  li.append(slot);
  return li;
}

// SCHED-4511 (R2): Ack sends the ack for this row's incident and marks the row acked.
async function onAck(id, slot, button) {
  button.disabled = true;
  button.textContent = 'Acking…';
  try {
    const reply = await ack(id);
    const mark = el('span', { 'data-testid': 'acked', class: 'acked', title: `receipt ${reply.receipt}` }, '✓ acked');
    slot.replaceChildren(mark);
    rows.get(id)?.classList.add('is-acked');
  } catch (err) {
    console.error(err);
    button.disabled = false;
    button.textContent = 'Retry ack';
  }
}

// SCHED-4511 (R1): new incidents go in at the top, newest first; rows already shown stay as they are.
function render(incidents) {
  const ids = new Set(incidents.map((i) => i.id));
  for (const [id, li] of rows) {
    if (!ids.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }
  // Walk the list in the API's order: new rows go in, existing rows move only if out of place.
  let cur = list.firstChild;
  for (const i of incidents) {
    let li = rows.get(i.id);
    if (!li) {
      li = buildRow(i);
      rows.set(i.id, li);
    }
    if (li === cur) cur = cur.nextSibling;
    else list.insertBefore(li, cur);
  }
  empty.hidden = incidents.length > 0;
  list.hidden = incidents.length === 0;
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    loader.remove(); // SCHED-4512 (R3): the loader shows until the first incidents are on screen
    status.textContent = `updated ${new Date(page.updatedAt).toLocaleTimeString()}`;
  } catch (err) {
    console.error(err);
    status.textContent = 'offline, retrying';
  } finally {
    setTimeout(refresh, REFRESH_MS); // one refresh in flight at a time
  }
}

refresh();
