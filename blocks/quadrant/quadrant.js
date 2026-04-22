const SVG_NS = 'http://www.w3.org/2000/svg';

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

function classify(competition, exertion) {
  const min = Math.min(competition, exertion);
  if (min >= 60) return 'yes';
  if (min >= 40) return 'debatable';
  return 'no';
}

async function fetchSports() {
  const res = await fetch('/sports.json');
  if (!res.ok) throw new Error(`sports.json ${res.status}`);
  const json = await res.json();
  return (json.data || [])
    .map((s) => {
      const competition = Number(s.Competition);
      const exertion = Number(s.Exertion);
      return {
        name: s.Name,
        competition,
        exertion,
        sportness: classify(competition, exertion),
        quip: s.Quip || '',
      };
    })
    .filter((s) => s.name && Number.isFinite(s.competition) && Number.isFinite(s.exertion));
}

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

function buildPlot(sports) {
  const VB_W = 1500;
  const VB_H = 1000;
  const PAD = 40;
  const plotW = VB_W - PAD * 2;
  const plotH = VB_H - PAD * 2;
  const xScale = (c) => PAD + (c / 100) * plotW;
  const yScale = (e) => PAD + (1 - e / 100) * plotH;

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
      class: `q-bg q-bg-${q.key}`,
      x: q.x,
      y: q.y,
      width: plotW / 2,
      height: plotH / 2,
    }));
  });

  svg.appendChild(svgEl('line', {
    class: 'q-midline',
    x1: PAD + plotW / 2,
    y1: PAD,
    x2: PAD + plotW / 2,
    y2: PAD + plotH,
  }));
  svg.appendChild(svgEl('line', {
    class: 'q-midline',
    x1: PAD,
    y1: PAD + plotH / 2,
    x2: PAD + plotW,
    y2: PAD + plotH / 2,
  }));

  const dotsGroup = svgEl('g', { class: 'q-dots' });
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
      x: cx,
      y: cy - 22,
      'text-anchor': 'middle',
      class: 'q-dot-name',
    });
    name.textContent = s.name;
    g.appendChild(name);
    dotsGroup.appendChild(g);
  });
  svg.appendChild(dotsGroup);

  requestAnimationFrame(() => {
    dotsGroup.querySelectorAll('.q-dot').forEach((d) => d.classList.add('q-dot-visible'));
  });

  dotsGroup.addEventListener('mouseover', (e) => {
    const dot = e.target.closest('.q-dot');
    if (dot && dot.parentNode === dotsGroup && dot !== dotsGroup.lastElementChild) {
      dotsGroup.appendChild(dot);
    }
  });

  return svg;
}

/** @param {Element} block */
export default async function decorate(block) {
  const labels = parseLabels(block);

  let sports;
  try {
    sports = await fetchSports();
  } catch (err) {
    block.textContent = 'Unable to load sports data.';
    return;
  }

  block.textContent = '';

  const topRow = document.createElement('div');
  topRow.className = 'q-label-row q-label-row-top';
  topRow.appendChild(labelCell('q-label-top-left', labels['top-left']));
  topRow.appendChild(labelCell('q-label-top-right', labels['top-right']));

  const plotWrap = document.createElement('div');
  plotWrap.className = 'q-plot-wrap';
  const yAxis = document.createElement('div');
  yAxis.className = 'q-axis q-axis-y';
  yAxis.textContent = 'exertion →';
  plotWrap.appendChild(yAxis);
  plotWrap.appendChild(buildPlot(sports));

  const bottomRow = document.createElement('div');
  bottomRow.className = 'q-label-row q-label-row-bottom';
  bottomRow.appendChild(labelCell('q-label-bottom-left', labels['bottom-left']));
  bottomRow.appendChild(labelCell('q-label-bottom-right', labels['bottom-right']));

  const xAxis = document.createElement('div');
  xAxis.className = 'q-axis q-axis-x';
  xAxis.textContent = 'competition →';

  block.append(topRow, plotWrap, bottomRow, xAxis, buildLegend());
}
