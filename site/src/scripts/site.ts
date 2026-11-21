/**
 * Site-wide behaviour: theme toggle and view-time freshness check (§9).
 * Static pages are built once; this re-evaluates "re-check due" against the reader's clock,
 * so an old build can never present an expired verification as fresh.
 */

function initTheme(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const root = document.documentElement;
    const explicit = root.getAttribute('data-theme');
    const dark = explicit ? explicit === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('pf-theme', next);
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
  });
}

const DAY_MS = 86_400_000;

export function markStale(root: ParentNode = document, now = Date.now()): number {
  let count = 0;
  root.querySelectorAll<HTMLElement>('[data-verified][data-max-age]').forEach((el) => {
    const verified = Date.parse(el.dataset.verified + 'T00:00:00Z');
    const maxAge = Number(el.dataset.maxAge);
    if (!Number.isFinite(verified) || !Number.isFinite(maxAge)) return;
    const stale = (now - verified) / DAY_MS > maxAge;
    el.classList.toggle('is-stale', stale);
    el.querySelectorAll<HTMLElement>('.stale-flag').forEach((flag) => (flag.hidden = !stale));
    if (stale) count++;
  });
  document.querySelectorAll<HTMLElement>('[data-stale-count]').forEach((el) => {
    el.textContent = String(count);
    el.closest<HTMLElement>('[data-stale-summary]')?.toggleAttribute('hidden', count === 0);
  });
  return count;
}

initTheme();
markStale();
