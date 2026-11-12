// SCHED-4514 (R5): incident times in the viewer's own zone and date order.

/** True when the locale writes the day before the month (en-GB, de-DE, fr-FR, en-NZ, …). */
export function dayFirst(locale) {
  const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).formatToParts(
    new Date(Date.UTC(2026, 10, 30)),
  );
  const order = parts.filter((p) => p.type === 'day' || p.type === 'month').map((p) => p.type);
  return order[0] === 'day';
}

/** "12/11 16:23" in Berlin, "11/12 10:23 AM" in New York: local zone, the locale's day/month order. */
export function formatLocal(iso, { locale, timeZone } = {}) {
  const date = new Date(iso);
  const opts = timeZone ? { timeZone } : {};
  const dm = Object.fromEntries(
    new Intl.DateTimeFormat(locale, { ...opts, day: '2-digit', month: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const day = dayFirst(locale) ? `${dm.day}/${dm.month}` : `${dm.month}/${dm.day}`;
  const time = new Intl.DateTimeFormat(locale, { ...opts, hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day} ${time}`;
}

/** Full local value with the zone name, for the tooltip. */
export function formatTitle(iso, { locale, timeZone } = {}) {
  return new Intl.DateTimeFormat(locale, {
    ...(timeZone ? { timeZone } : {}),
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(new Date(iso));
}
