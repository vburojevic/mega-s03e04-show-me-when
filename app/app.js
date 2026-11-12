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

// R1 (product, after step 1): the list holds still while it is on screen. New incidents wait behind the
// "N new" bar and go in at the top only when on-call clicks it. Rows on screen never move or go away
// on their own, so a click always lands on the row it was aimed at.
const bar = document.querySelector('[data-testid="new-bar"]');
let latest = []; // the API's current list, newest first
const pending = () => latest.filter((i) => !rows.has(i.id));

/** Puts the given incidents on screen in the API's order: new rows go in, existing rows move only if out of place. */
function place(incidents) {
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
}

function showState() {
  const waiting = pending().length;
  bar.textContent = waiting ? `${waiting} new incident${waiting === 1 ? '' : 's'} · show` : '';
  bar.classList.toggle('is-idle', waiting === 0);
  bar.tabIndex = waiting ? 0 : -1;
  empty.hidden = rows.size > 0;
  list.hidden = rows.size === 0;
}

function render(incidents) {
  latest = incidents;
  if (rows.size === 0) place(incidents); // nothing on screen to hold still yet
  showState();
}

bar.addEventListener('click', () => {
  if (!pending().length) return;
  place([...pending(), ...[...list.children].map((li) => ({ id: li.dataset.id }))]);
  showState();
  window.scrollTo({ top: 0 });
});

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
