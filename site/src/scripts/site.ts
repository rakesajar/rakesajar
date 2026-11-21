/**
 * Site-wide behaviour: theme toggle, and view-time checks of freshness (§9) and effective dates (CA-3).
 * Static pages are built once; these checks use the reader's clock, so an old build can never present an
 * expired verification as fresh or a replaced rule as current without saying so.
 */

function initTheme(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!btn) return;
  const root = document.documentElement;
  const isDark = () => {
    const explicit = root.getAttribute('data-theme');
    return explicit ? explicit === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  };
  const sync = () => {
    btn.setAttribute('aria-pressed', String(isDark()));
    btn.setAttribute('aria-label', isDark() ? 'Dark theme on. Switch to light' : 'Light theme on. Switch to dark');
  };
  sync();
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    sync();
    try {
      localStorage.setItem('pf-theme', next);
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
  });
}

const DAY_MS = 86_400_000;
const isoToday = (now: number) => new Date(now).toISOString().slice(0, 10);

function ownFlags(el: HTMLElement, selector: string): HTMLElement[] {
  // Only flags that belong to this element, not to a nested element with its own attributes.
  return [...el.querySelectorAll<HTMLElement>(selector)].filter((f) => f.parentElement?.closest('[data-verified]') === el);
}

export function markViewState(root: ParentNode = document, now = Date.now()): number {
  let stale = 0;
  const today = isoToday(now);
  root.querySelectorAll<HTMLElement>('[data-verified][data-max-age]').forEach((el) => {
    const verified = Date.parse(el.dataset.verified + 'T00:00:00Z');
    const maxAge = Number(el.dataset.maxAge);
    if (Number.isFinite(verified) && Number.isFinite(maxAge)) {
      const isStale = (now - verified) / DAY_MS > maxAge;
      el.classList.toggle('is-stale', isStale);
      ownFlags(el, '.stale-flag').forEach((f) => (f.hidden = !isStale));
      if (isStale) stale++;
    }
    const started = !!el.dataset.effectiveFrom && today >= el.dataset.effectiveFrom;
    const ended = !!el.dataset.effectiveTo && today > el.dataset.effectiveTo;
    ownFlags(el, '.date-flag[data-when="started"]').forEach((f) => (f.hidden = !started));
    ownFlags(el, '.date-flag[data-when="ended"]').forEach((f) => (f.hidden = !ended));
    el.classList.toggle('is-ended', ended);
  });
  document.querySelectorAll<HTMLElement>('[data-stale-count]').forEach((el) => {
    el.textContent = String(stale);
    el.closest<HTMLElement>('[data-stale-summary]')?.toggleAttribute('hidden', stale === 0);
  });
  return stale;
}

initTheme();
markViewState();
