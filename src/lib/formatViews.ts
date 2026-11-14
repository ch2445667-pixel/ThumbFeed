/**
 * Formats view counts into compact abbreviated form using K, M, or B suffixes
 * (e.g. 2488161 -> "2.5M", 16400 -> "16.4K", 950 -> "950") and never full words
 * like "million" or expanded comma-separated integers.
 */
export function formatShortViews(raw?: string | number | null): string {
  if (raw === null || raw === undefined) return '';

  const str = typeof raw === 'number' ? String(raw) : String(raw);
  const stripped = str
    .replace(/\bviews?\b/gi, '')
    .replace(/,/g, '')
    .trim();

  if (!stripped) return '';

  const match = stripped.match(
    /^(\d+(?:\.\d+)?)\s*(b|billion|m|million|k|thousand)?$/i
  );
  if (!match) {
    return '';
  }

  const base = parseFloat(match[1]);
  if (!Number.isFinite(base) || base < 0) return '';

  const unit = (match[2] || '').toLowerCase();
  let multiplier = 1;
  if (unit === 'b' || unit === 'billion') multiplier = 1e9;
  else if (unit === 'm' || unit === 'million') multiplier = 1e6;
  else if (unit === 'k' || unit === 'thousand') multiplier = 1e3;

  const total = base * multiplier;

  const formatScaled = (val: number, suffix: 'K' | 'M' | 'B'): string => {
    const rounded = Math.round(val * 10) / 10;
    return `${rounded.toString().replace(/\.0$/, '')}${suffix}`;
  };

  if (total >= 1e9) return formatScaled(total / 1e9, 'B');
  if (total >= 1e6) return formatScaled(total / 1e6, 'M');
  if (total >= 1e3) return formatScaled(total / 1e3, 'K');
  return String(Math.round(total));
}
