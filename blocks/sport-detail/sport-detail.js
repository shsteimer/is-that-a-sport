import { loadSports } from '../../scripts/sports.js';

/* User-facing strings, grouped for easy future localization. */
const STRINGS = {
  verdict: {
    yes: "Yes, it's a sport",
    debatable: 'Debatable',
    no: 'Not a sport',
  },
  competition: 'Competition',
  exertion: 'Exertion',
  axisX: 'competition →',
  axisY: 'exertion →',
  related: 'Sized up against the field',
  notFound: 'No data for this sport yet.',
  loadError: 'Unable to load sports data.',
};

const RELATED_COUNT = 6;

/** The path that identifies this sport: authored cell wins, else the URL. */
function resolvePath(block) {
  const cell = block.querySelector('div > div');
  const authored = cell ? cell.textContent.trim() : '';
  return (authored || window.location.pathname).replace(/\/$/, '');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function buildVerdict(sport) {
  const badge = el('div', `sd-verdict sd-sportness-${sport.sportness}`);
  badge.append(el('strong', null, STRINGS.verdict[sport.sportness]));
  return badge;
}

function buildScoreBar(label, value, sportness) {
  const row = el('div', 'sd-bar-row');
  row.append(el('span', 'sd-bar-label', label));
  const track = el('div', 'sd-bar-track');
  const fill = el('div', `sd-bar-fill sd-sportness-${sportness}`);
  fill.style.setProperty('--value', `${value}%`);
  track.append(fill);
  row.append(track);
  row.append(el('span', 'sd-bar-value', String(value)));
  return row;
}

function buildScores(sport) {
  const scores = el('div', 'sd-scores');
  scores.append(buildScoreBar(STRINGS.competition, sport.competition, sport.sportness));
  scores.append(buildScoreBar(STRINGS.exertion, sport.exertion, sport.sportness));
  return scores;
}

function buildMiniQuadrant(sport) {
  const wrap = el('div', 'sd-quadrant-wrap');

  const yAxis = el('div', 'sd-axis sd-axis-y', STRINGS.axisY);
  wrap.append(yAxis);

  const grid = el('div', 'sd-quadrant');
  ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((key) => {
    grid.append(el('div', `sd-zone sd-zone-${key}`));
  });

  const dot = el('div', `sd-dot sd-sportness-${sport.sportness}`);
  dot.style.left = `${sport.competition}%`;
  dot.style.bottom = `${sport.exertion}%`;
  dot.setAttribute('aria-label', sport.name);
  grid.append(dot);
  wrap.append(grid);

  wrap.append(el('div', 'sd-axis sd-axis-x', STRINGS.axisX));
  return wrap;
}

function distance(a, b) {
  const dc = a.competition - b.competition;
  const de = a.exertion - b.exertion;
  return dc * dc + de * de;
}

function buildRelated(sport, all) {
  const peers = all
    .filter((s) => s.quadrant === sport.quadrant && s.slug !== sport.slug)
    .sort((a, b) => distance(sport, a) - distance(sport, b))
    .slice(0, RELATED_COUNT);
  if (!peers.length) return null;

  const section = el('nav', 'sd-related');
  section.setAttribute('aria-label', STRINGS.related);
  section.append(el('h2', 'sd-related-heading', STRINGS.related));
  const list = el('ul', 'sd-related-list');
  peers.forEach((peer) => {
    const li = el('li', 'sd-related-item');
    const link = el('a', `sd-related-link sd-sportness-${peer.sportness}`, peer.name);
    link.href = peer.slug;
    li.append(link);
    list.append(li);
  });
  section.append(list);
  return section;
}

/** @param {Element} block */
export default async function decorate(block) {
  const path = resolvePath(block);

  let sports;
  try {
    sports = await loadSports();
  } catch (err) {
    block.textContent = STRINGS.loadError;
    return;
  }

  const sport = sports.find((s) => s.slug.replace(/\/$/, '') === path);
  if (!sport) {
    block.textContent = STRINGS.notFound;
    return;
  }

  block.textContent = '';
  const left = el('div', 'sd-panel sd-panel-summary');
  left.append(buildVerdict(sport));
  if (sport.quip) left.append(el('p', 'sd-quip', sport.quip));
  left.append(buildScores(sport));

  const right = el('div', 'sd-panel sd-panel-chart');
  right.append(buildMiniQuadrant(sport));

  block.append(left, right);

  const related = buildRelated(sport, sports);
  if (related) block.append(related);
}
