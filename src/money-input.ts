/** Format a numeric input string for display without changing its precision. */
export function formatMoneyInput(raw: string): string {
  const [whole, fraction] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/** Accept pasted AUD formatting but keep the calculation value a plain numeric string. */
export function parseMoneyInput(display: string): string | null {
  const cleaned = display.replace(/[$,\s]/g, '');
  return /^\d*(?:\.\d*)?$/.test(cleaned) ? cleaned : null;
}
