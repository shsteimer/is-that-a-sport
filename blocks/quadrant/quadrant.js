import { loadSports } from '../../scripts/sports.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* How many dots the chart shows: all featured sports + a quadrant-balanced
   random sample to fill the rest. Tune here. */
const TARGET = 40;

const STRINGS = {
  reshuffle: 'Shuffle',
  searchLabel: 'Search every sport',
  searchPlaceholder: 'Search any sport…',
  loadError: 'Unable to load sports data.',
};

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function parseLabels(block) {
  const labels = {};
  const rowKeys = ['top', 'bottom'];
  const colKeys = ['left', 'right'];
  [...block.children].forEach((row, rIdx) => {
    const rowKey = rowKeys[rIdx];
    if (!rowKey) return;
    [...row.children].forEach((cell, cIdx) => {
      const colKey = colKeys[cIdx];
      if (!colKey) return;
      const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
      const para = cell.querySelector('p');
      labels[`${rowKey}-${colKey}`] = {
        label: heading ? heading.textContent.trim() : '',
        subtitle: para ? para.textContent.trim() : '',
      };
    });
  });
  return labels;
}

/* --- seeded sampling --- */

/** Stable weekly seed so the default chart is consistent for ~7 days. */
function isoWeekSeed(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  );
  return date.getUTCFullYear() * 100 + week;
}

/* mulberry32 — a tiny seeded PRNG; bitwise math is intrinsic to it. */
/* eslint-disable no-bitwise, operator-assignment */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise, operator-assignment */

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Always include featured; fill to TARGET sampling each quadrant proportionally. */
function sampleSports(all, seed) {
  const featured = all.filter((s) => s.featured);
  const pool = all.filter((s) => !s.featured);
  const need = Math.max(0, TARGET - featured.length);
  if (need >= pool.length) return [...featured, ...pool];

  const rand = makeRng(seed);
  const groups = {};
  pool.forEach((s) => {
    (groups[s.quadrant] = groups[s.quadrant] || []).push(s);
  });
  const keys = Object.keys(groups);
  keys.forEach((k) => { groups[k] = shuffle(groups[k], rand); });

  const sizes = keys.map((k) => groups[k].length);
  const allocs = keys.map((k, i) => Math.floor((need * sizes[i]) / pool.length));
  let remaining = need - allocs.reduce((a, b) => a + b, 0);
  const order = shuffle(keys.map((_, i) => i), rand);
  let oi = 0;
  while (remaining > 0 && oi < keys.length * 50) {
    const i = order[oi % order.length];
    if (allocs[i] < sizes[i]) { allocs[i] += 1; remaining -= 1; }
    oi += 1;
  }

  let sampled = [];
  keys.forEach((k, i) => { sampled = sampled.concat(groups[k].slice(0, allocs[i])); });
  return [...featured, ...sampled];
}

/* --- rendering --- */

function labelCell(className, info) {
  const cell = document.createElement('div');
  cell.className = `q-label-cell ${className}`;
  if (!info) return cell;
  const strong = document.createElement('strong');
  strong.textContent = info.label;
  cell.appendChild(strong);
  if (info.subtitle) {
    const em = document.createElement('em');
    em.textContent = info.subtitle;
    cell.appendChild(em);
  }
  return cell;
}

function buildLegend() {
  const legend = document.createElement('div');
  legend.className = 'q-legend';
  const items = [
    ['yes', 'sport'],
    ['debatable', 'debatable'],
    ['no', 'not a sport'],
  ];
  items.forEach(([key, text]) => {
    const item = document.createElement('span');
    item.className = `q-legend-item q-sportness-${key}`;
    const swatch = document.createElement('span');
    swatch.className = 'q-dot-swatch';
    const label = document.createElement('span');
    label.textContent = text;
    item.append(swatch, label);
    legend.appendChild(item);
  });
  return legend;
}

const VB_W = 1500;
const VB_H = 1000;
const PAD = 40;
const plotW = VB_W - PAD * 2;
const plotH = VB_H - PAD * 2;
const xScale = (c) => PAD + (c / 100) * plotW;
const yScale = (e) => PAD + (1 - e / 100) * plotH;

function buildPlotShell() {
  const svg = svgEl('svg', {
    class: 'quadrant-plot',
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    role: 'img',
    'aria-label': 'Sports plotted by competition and exertion',
  });

  const quads = [
    { key: 'top-left', x: PAD, y: PAD },
    { key: 'top-right', x: PAD + plotW / 2, y: PAD },
    { key: 'bottom-left', x: PAD, y: PAD + plotH / 2 },
    { key: 'bottom-right', x: PAD + plotW / 2, y: PAD + plotH / 2 },
  ];
  quads.forEach((q) => {
    svg.appendChild(svgEl('rect', {
      class: `q-bg q-bg-${q.key}`, x: q.x, y: q.y, width: plotW / 2, height: plotH / 2,
    }));
  });

  svg.appendChild(svgEl('line', {
    class: 'q-midline', x1: PAD + plotW / 2, y1: PAD, x2: PAD + plotW / 2, y2: PAD + plotH,
  }));
  svg.appendChild(svgEl('line', {
    class: 'q-midline', x1: PAD, y1: PAD + plotH / 2, x2: PAD + plotW, y2: PAD + plotH / 2,
  }));

  const dotsGroup = svgEl('g', { class: 'q-dots' });
  svg.appendChild(dotsGroup);

  dotsGroup.addEventListener('mouseover', (e) => {
    const dot = e.target.closest('.q-dot');
    if (dot && dot.parentNode === dotsGroup && dot !== dotsGroup.lastElementChild) {
      dotsGroup.appendChild(dot);
    }
  });

  return { svg, dotsGroup };
}

function renderDots(dotsGroup, sports) {
  dotsGroup.textContent = '';
  sports.forEach((s, i) => {
    const cx = xScale(s.competition);
    const cy = yScale(s.exertion);
    const g = svgEl('g', {
      class: `q-dot q-sportness-${s.sportness || 'unknown'}`,
      'aria-label': s.name,
      style: `--delay:${i * 40}ms`,
    });
    g.appendChild(svgEl('circle', {
      cx, cy, r: 28, class: 'q-dot-hitbox',
    }));
    g.appendChild(svgEl('circle', {
      cx, cy, r: 14, class: 'q-dot-circle',
    }));
    const name = svgEl('text', {
      x: cx, y: cy - 22, 'text-anchor': 'middle', class: 'q-dot-name',
    });
    name.textContent = s.name;
    g.appendChild(name);
    dotsGroup.appendChild(g);
  });

  requestAnimationFrame(() => {
    dotsGroup.querySelectorAll('.q-dot').forEach((d) => d.classList.add('q-dot-visible'));
  });
}

function buildControls(allSports, onReshuffle) {
  const controls = document.createElement('div');
  controls.className = 'q-controls';

  const search = document.createElement('div');
  search.className = 'q-search';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'q-search-input';
  input.placeholder = STRINGS.searchPlaceholder;
  input.setAttribute('aria-label', STRINGS.searchLabel);
  const results = document.createElement('ul');
  results.className = 'q-search-results';
  search.append(input, results);

  const renderResults = () => {
    const term = input.value.trim().toLowerCase();
    results.textContent = '';
    if (!term) return;
    allSports
      .filter((s) => s.name.toLowerCase().includes(term) && s.slug)
      .slice(0, 8)
      .forEach((s) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.className = `q-search-link q-sportness-${s.sportness}`;
        link.href = s.slug;
        link.textContent = s.name;
        li.appendChild(link);
        results.appendChild(li);
      });
  };
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.q-search-link');
      if (first) window.location.assign(first.href);
    }
  });

  const reshuffle = document.createElement('button');
  reshuffle.type = 'button';
  reshuffle.className = 'q-reshuffle';
  reshuffle.textContent = STRINGS.reshuffle;
  reshuffle.addEventListener('click', onReshuffle);

  controls.append(search, reshuffle);
  return controls;
}

/** @param {Element} block */
export default async function decorate(block) {
  const labels = parseLabels(block);

  let sports;
  try {
    sports = await loadSports();
  } catch (err) {
    block.textContent = STRINGS.loadError;
    return;
  }

  block.textContent = '';

  const topRow = document.createElement('div');
  topRow.className = 'q-label-row q-label-row-top';
  topRow.appendChild(labelCell('q-label-top-left', labels['top-left']));
  topRow.appendChild(labelCell('q-label-top-right', labels['top-right']));

  const { svg, dotsGroup } = buildPlotShell();
  const plotWrap = document.createElement('div');
  plotWrap.className = 'q-plot-wrap';
  const yAxis = document.createElement('div');
  yAxis.className = 'q-axis q-axis-y';
  yAxis.textContent = 'exertion →';
  plotWrap.appendChild(yAxis);
  plotWrap.appendChild(svg);

  const bottomRow = document.createElement('div');
  bottomRow.className = 'q-label-row q-label-row-bottom';
  bottomRow.appendChild(labelCell('q-label-bottom-left', labels['bottom-left']));
  bottomRow.appendChild(labelCell('q-label-bottom-right', labels['bottom-right']));

  const xAxis = document.createElement('div');
  xAxis.className = 'q-axis q-axis-x';
  xAxis.textContent = 'competition →';

  let reshuffleSeed = isoWeekSeed();
  const draw = () => renderDots(dotsGroup, sampleSports(sports, reshuffleSeed));
  const controls = buildControls(sports, () => {
    reshuffleSeed = Math.floor(Math.random() * 2 ** 32);
    draw();
  });

  block.append(topRow, plotWrap, bottomRow, xAxis, buildLegend(), controls);
  draw();
}
