/**
 * Data rate vs transmitter pointing error. Exact Airy-pattern roll-off as the
 * primary series, the textbook 12·(θ/θ₃dB)² approximation as a dashed
 * comparison, reference lines at the −3 dB offset, the first null, and the
 * proper-motion aim-ahead angle. Crosshair tooltip on hover, arrow keys when
 * focused, and a table twin below for the values that matter.
 */

import { airyRelativeGain, gaussianPointingLossDb } from '../physics/antenna';
import type { LinkBudget } from '../physics/linkBudget';
import { transferTimeS } from '../physics/linkBudget';
import type { AppState } from '../state';
import {
  angleFormat,
  arcsecToRad,
  dbFormat,
  durationFormat,
  radToArcsec,
  rateFormat,
  toDb,
  trimNumber,
} from '../physics/units';
import { clear, el, svg } from './dom';

const W = 720;
const H = 380;
const ML = 72;
const MR = 16;
const MT = 18;
const MB = 42;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const N_SAMPLES = 260;
const DECADES = 7;

interface Sample {
  errArcsec: number;
  lossDb: number;
  rateBps: number;
}

export function initChart(
  wrap: HTMLElement,
  svgHost: SVGSVGElement,
  tableHost: HTMLElement,
): { update(b: LinkBudget, s: AppState): void } {
  svgHost.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgHost.setAttribute('tabindex', '0');
  svgHost.setAttribute('role', 'img');

  const tooltip = el('div', { class: 'chart-tooltip', 'aria-hidden': 'true' });
  wrap.append(tooltip);

  let samples: Sample[] = [];
  let xMax = 1;
  let yTop = 1;
  let crosshair: SVGElement | null = null;
  let focusIdx = -1;

  const xPx = (err: number): number => ML + (err / xMax) * PLOT_W;
  const yPx = (rate: number): number => {
    const top = Math.log10(yTop);
    const v = Math.max(rate, yTop / 10 ** DECADES);
    return MT + ((top - Math.log10(v)) / DECADES) * PLOT_H;
  };

  const showSample = (idx: number, clientX?: number): void => {
    const sm = samples[idx];
    if (!sm) return;
    const px = xPx(sm.errArcsec);
    const py = yPx(sm.rateBps);
    if (!crosshair) return;
    crosshair.setAttribute('d', `M ${px} ${MT} V ${MT + PLOT_H}`);
    crosshair.setAttribute('opacity', '1');
    const dot = svgHost.querySelector<SVGElement>('.hover-dot');
    dot?.setAttribute('cx', String(px));
    dot?.setAttribute('cy', String(py));
    dot?.setAttribute('opacity', '1');
    tooltip.replaceChildren(
      el('div', { class: 'tt-title', text: `pointing error ${angleFormat(arcsecToRad(sm.errArcsec))}` }),
      el('table', {}, [
        ttRow('tx pointing loss', dbFormat(-sm.lossDb)),
        ttRow('data rate', rateFormat(sm.rateBps)),
        ttRow('1 TB takes', durationFormat(transferTimeS(1e12, sm.rateBps))),
      ]),
    );
    const rect = wrap.getBoundingClientRect();
    const svgRect = svgHost.getBoundingClientRect();
    const scale = svgRect.width / W;
    let left = (clientX !== undefined ? clientX - rect.left : px * scale + (svgRect.left - rect.left)) + 14;
    if (left > rect.width - 180) left -= 200;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${(svgRect.top - rect.top) + py * scale - 20}px`;
    tooltip.style.opacity = '1';
  };

  const hide = (): void => {
    tooltip.style.opacity = '0';
    crosshair?.setAttribute('opacity', '0');
    svgHost.querySelector('.hover-dot')?.setAttribute('opacity', '0');
    focusIdx = -1;
  };

  svgHost.addEventListener('pointermove', (ev) => {
    const svgRect = svgHost.getBoundingClientRect();
    const xUser = ((ev.clientX - svgRect.left) / svgRect.width) * W;
    const err = ((xUser - ML) / PLOT_W) * xMax;
    const idx = Math.round((err / xMax) * (N_SAMPLES - 1));
    if (idx < 0 || idx >= samples.length) {
      hide();
      return;
    }
    focusIdx = idx;
    showSample(idx, ev.clientX);
  });
  svgHost.addEventListener('pointerleave', hide);
  svgHost.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Escape') return;
    ev.preventDefault();
    if (ev.key === 'Escape') {
      hide();
      return;
    }
    const step = ev.key === 'ArrowRight' ? 4 : -4;
    focusIdx = Math.max(0, Math.min(N_SAMPLES - 1, (focusIdx < 0 ? 0 : focusIdx) + step));
    showSample(focusIdx);
  });
  svgHost.addEventListener('blur', hide);

  const update = (b: LinkBudget, s: AppState): void => {
    // C/N0 with the tx pointing contribution removed; the sweep re-applies it.
    const cn0NoTx = b.cn0DbHz + b.txPointingLossDb;
    const rateAt = (lossDb: number): number => 10 ** ((cn0NoTx - lossDb) / 10) / Math.LN2;

    const nullArcsec = radToArcsec(b.txFirstNullRad);
    xMax = 1.45 * nullArcsec;
    const cap0 = rateAt(0);
    yTop = 10 ** Math.ceil(Math.log10(cap0 * 1.4));

    samples = [];
    const gauss: Sample[] = [];
    for (let k = 0; k < N_SAMPLES; k++) {
      const err = (k / (N_SAMPLES - 1)) * xMax;
      const theta = arcsecToRad(err);
      const loss = -toDb(airyRelativeGain(theta, s.txDiameterM, b.lambdaM));
      samples.push({ errArcsec: err, lossDb: loss, rateBps: rateAt(loss) });
      const gl = gaussianPointingLossDb(theta, s.txDiameterM, b.lambdaM);
      gauss.push({ errArcsec: err, lossDb: gl, rateBps: rateAt(gl) });
    }

    clear(svgHost);
    svgHost.setAttribute(
      'aria-label',
      `Data rate versus transmitter pointing error. At zero error ${rateFormat(cap0)}; ` +
        `3 dB lost at ${angleFormat(b.txHpbwRad / 2)}; link dead at the first null, ${angleFormat(b.txFirstNullRad)}. ` +
        `Values are listed in the table below the chart.`,
    );

    const defsClip = svg('defs', {}, [
      svg('clipPath', { id: 'plot-clip' }, [
        svg('rect', { x: ML, y: MT, width: PLOT_W, height: PLOT_H }),
      ]),
    ]);
    svgHost.append(defsClip);

    // Gridlines + y ticks (one per decade)
    const grid = svg('g');
    for (let d = 0; d <= DECADES; d++) {
      const v = yTop / 10 ** d;
      const y = yPx(v);
      grid.append(
        svg('line', {
          x1: ML, y1: y, x2: ML + PLOT_W, y2: y,
          stroke: d === DECADES ? 'var(--baseline)' : 'var(--grid-hairline)',
          'stroke-width': 1,
        }),
        svg('text', {
          x: ML - 8, y: y + 3.5, class: 'svg-tick', 'text-anchor': 'end',
          text: rateFormat(v, 1),
        }),
      );
    }
    // X ticks
    const step = niceStep(xMax / 6);
    for (let x = 0; x <= xMax + 1e-9; x += step) {
      const px = xPx(x);
      grid.append(
        svg('line', {
          x1: px, y1: MT + PLOT_H, x2: px, y2: MT + PLOT_H + 5,
          stroke: 'var(--baseline)', 'stroke-width': 1,
        }),
        svg('text', {
          x: px, y: MT + PLOT_H + 18, class: 'svg-tick', 'text-anchor': 'middle',
          text: trimNumber(x, 3),
        }),
      );
    }
    grid.append(
      svg('text', {
        x: ML + PLOT_W / 2, y: H - 6, class: 'svg-label', 'text-anchor': 'middle',
        text: 'transmitter pointing error (arcsec)',
      }),
    );
    svgHost.append(grid);

    // Reference verticals: −3 dB, first null, aim-ahead
    const refs = svg('g');
    const addRef = (arcsec: number, label: string, dy: number): void => {
      if (arcsec <= 0 || arcsec > xMax) return;
      const px = xPx(arcsec);
      refs.append(
        svg('line', {
          x1: px, y1: MT, x2: px, y2: MT + PLOT_H,
          stroke: 'var(--baseline)', 'stroke-width': 1,
        }),
        svg('text', {
          x: px + 4, y: MT + dy, class: 'svg-label-muted', 'text-anchor': 'start', text: label,
        }),
      );
    };
    addRef(radToArcsec(b.txHpbwRad / 2), '−3 dB', 12);
    addRef(nullArcsec, 'first null', 12);
    addRef(b.aimAheadArcsec, `aim-ahead μ·R/c`, 28);
    svgHost.append(refs);

    // Series
    const plot = svg('g', { 'clip-path': 'url(#plot-clip)' });
    plot.append(
      svg('path', {
        d: pathFor(gauss, xPx, yPx),
        fill: 'none',
        stroke: 'var(--series-2)',
        'stroke-width': 2,
        'stroke-dasharray': '5 4',
        'stroke-linecap': 'round',
      }),
      svg('path', {
        d: pathFor(samples, xPx, yPx),
        fill: 'none',
        stroke: 'var(--series-1)',
        'stroke-width': 2,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      }),
    );
    svgHost.append(plot);

    // Current operating point
    const curErr = s.txPointingErrArcsec;
    if (curErr <= xMax) {
      const cx = xPx(curErr);
      const cy = yPx(rateAt(b.txPointingLossDb));
      svgHost.append(
        svg('circle', {
          cx, cy, r: 5.5,
          fill: 'var(--series-1)', stroke: 'var(--surface-1)', 'stroke-width': 2,
        }),
        svg('text', {
          x: cx + 9, y: cy - 9, class: 'svg-datalabel', 'text-anchor': 'start',
          text: `now: ${rateFormat(rateAt(b.txPointingLossDb))}`,
        }),
      );
    }

    // Hover chrome (crosshair + dot), re-created each render
    crosshair = svg('path', { d: '', stroke: 'var(--baseline)', 'stroke-width': 1, opacity: 0 });
    svgHost.append(
      crosshair,
      svg('circle', {
        class: 'hover-dot', r: 4.5, opacity: 0,
        fill: 'var(--series-1)', stroke: 'var(--surface-1)', 'stroke-width': 2,
      }),
    );

    renderTable(tableHost, b, s, rateAt, nullArcsec);
  };

  return { update };
}

function ttRow(label: string, value: string): HTMLElement {
  return el('tr', {}, [el('td', { text: label }), el('td', { text: value })]);
}

function pathFor(pts: Sample[], xPx: (v: number) => number, yPx: (v: number) => number): string {
  return pts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xPx(p.errArcsec).toFixed(2)} ${yPx(p.rateBps).toFixed(2)}`)
    .join(' ');
}

function renderTable(
  host: HTMLElement,
  b: LinkBudget,
  s: AppState,
  rateAt: (lossDb: number) => number,
  nullArcsec: number,
): void {
  const mk = (
    label: string,
    errArcsec: number,
    lossDb: number,
    current = false,
  ): HTMLElement =>
    el('tr', { class: current ? 'current' : '' }, [
      el('td', { text: label }),
      el('td', { class: 'num', text: errArcsec === 0 ? '0' : angleFormat(arcsecToRad(errArcsec)) }),
      el('td', { class: 'num', text: dbFormat(-lossDb) }),
      el('td', { class: 'num', text: rateFormat(rateAt(lossDb)) }),
      el('td', { class: 'num', text: durationFormat(transferTimeS(1e12, rateAt(lossDb))) }),
    ]);

  const rows: HTMLElement[] = [
    mk('perfect pointing', 0, 0),
    mk('current setting', s.txPointingErrArcsec, b.txPointingLossDb, true),
    mk('half-power offset (θ₃dB/2)', radToArcsec(b.txHpbwRad / 2), 3.01),
    mk('first null — link dead', nullArcsec, 60),
  ];
  if (b.aimAheadArcsec > 0) {
    const loss = -toDb(airyRelativeGain(arcsecToRad(b.aimAheadArcsec), s.txDiameterM, b.lambdaM));
    rows.splice(2, 0, mk('aim-ahead angle ignored (μ·R/c)', b.aimAheadArcsec, loss));
  }

  clear(host);
  host.append(
    el('table', { class: 'point-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Scenario' }),
          el('th', { text: 'Error' }),
          el('th', { text: 'Loss' }),
          el('th', { text: 'Data rate' }),
          el('th', { text: '1 TB takes' }),
        ]),
      ]),
      el('tbody', {}, rows),
    ]),
  );
}

function niceStep(target: number): number {
  const exp = Math.floor(Math.log10(target));
  const base = target / 10 ** exp;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return nice * 10 ** exp;
}
