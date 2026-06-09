/* Shared sports data utilities. Both the index quadrant and the per-sport
   detail block read live data from sports.json so score edits propagate
   without republishing dependent pages. */

const SPORTS_URL = '/sports.json';

let cache;

/** Verdict from the two scores. Mirrors the homepage chart. */
export function classify(competition, exertion) {
  const min = Math.min(competition, exertion);
  if (min >= 60) return 'yes';
  if (min >= 40) return 'debatable';
  return 'no';
}

/** Which chart quadrant a sport falls into. Keys match the q-bg-* classes. */
export function quadrantKey(competition, exertion) {
  const vertical = exertion >= 50 ? 'top' : 'bottom';
  const horizontal = competition >= 50 ? 'right' : 'left';
  return `${vertical}-${horizontal}`;
}

function normalize(row) {
  const competition = Number(row.Competition);
  const exertion = Number(row.Exertion);
  return {
    name: row.Name,
    competition,
    exertion,
    quip: row.Quip || '',
    slug: row.Slug || '',
    description: row.Description || '',
    featured: row.Featured === true || String(row.Featured).trim().toLowerCase() === 'true',
    sportness: classify(competition, exertion),
    quadrant: quadrantKey(competition, exertion),
  };
}

/** Fetch and normalize all sports. Cached per page load. */
export async function loadSports() {
  if (cache) return cache;
  const res = await fetch(SPORTS_URL);
  if (!res.ok) throw new Error(`sports.json ${res.status}`);
  const json = await res.json();
  cache = (json.data || [])
    .map(normalize)
    .filter((s) => s.name && Number.isFinite(s.competition) && Number.isFinite(s.exertion));
  return cache;
}
