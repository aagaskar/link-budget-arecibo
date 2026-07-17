/**
 * Relative geometry view: an overview strip (transmitter star → Solar System
 * with the transmit beam cone), plus two magnified insets — the remote
 * transmitter and the beam's arrival footprint at Earth.
 *
 * Bodies and angles in the schematic are exaggerated for visibility; every
 * printed number is computed from the actual link state. The right inset IS
 * to scale in AU, which is the point: the beam footprint utterly dwarfs
 * Earth's orbit.
 */

import type { LinkBudget } from '../physics/linkBudget';
import type { AppState } from '../state';
import { R_SUN_M } from '../physics/constants';
import { presetById } from '../state';
import { angleFormat, arcsecToRad, dbFormat, siFormat, trimNumber } from '../physics/units';
import { clear, svg } from './dom';

const W = 1200;
const H = 434;
const OVERVIEW_Y = 64;
const TX_X = 90;
const RX_X = 1110;
const INSET_R = 132;
const TX_INSET = { x: 218, y: 290 };
const RX_INSET = { x: 982, y: 290 };

export function initGeometry(svgHost: SVGSVGElement): {
  update(b: LinkBudget, s: AppState): void;
} {
  svgHost.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgHost.setAttribute('role', 'img');

  const update = (b: LinkBudget, s: AppState): void => {
    clear(svgHost);
    svgHost.setAttribute(
      'aria-label',
      `Link geometry: transmitter at ${starName(s)}, ${trimNumber(s.rangeLy, 3)} light years from Earth. ` +
        `Beam half-power footprint radius at Earth ${trimNumber(b.footprintRadiusAu, 3)} AU; ` +
        `beam centre misses the Sun by ${trimNumber(b.missDistanceAu, 3)} AU.`,
    );
    svgHost.append(defs(), starfield());
    drawOverview(svgHost, b, s);
    drawZoomWedge(svgHost, TX_X, OVERVIEW_Y, TX_INSET.x, TX_INSET.y);
    drawZoomWedge(svgHost, RX_X, OVERVIEW_Y, RX_INSET.x, RX_INSET.y);
    drawTransmitterInset(svgHost, b, s);
    drawSolarInset(svgHost, b);
    drawCenterFacts(svgHost, b, s);
  };

  return { update };
}

function starName(s: AppState): string {
  return presetById(s.presetId)?.name ?? `star at ${trimNumber(s.rangeLy, 3)} ly`;
}

function starColor(s: AppState): string {
  return s.starTempK < 4200 ? 'var(--star-m)' : 'var(--star-g)';
}

function defs(): SVGElement {
  const grad = svg('radialGradient', { id: 'beam-grad' }, [
    svg('stop', { offset: '0%', 'stop-color': 'var(--series-1)', 'stop-opacity': 0.3 }),
    svg('stop', { offset: '60%', 'stop-color': 'var(--series-1)', 'stop-opacity': 0.13 }),
    svg('stop', { offset: '100%', 'stop-color': 'var(--series-1)', 'stop-opacity': 0.04 }),
  ]);
  const clipTx = svg('clipPath', { id: 'clip-tx' }, [
    svg('circle', { cx: TX_INSET.x, cy: TX_INSET.y, r: INSET_R - 1 }),
  ]);
  const clipRx = svg('clipPath', { id: 'clip-rx' }, [
    svg('circle', { cx: RX_INSET.x, cy: RX_INSET.y, r: INSET_R - 1 }),
  ]);
  return svg('defs', {}, [grad, clipTx, clipRx]);
}

/** A deterministic sprinkle of background stars in the overview band. */
function starfield(): SVGElement {
  const g = svg('g', { 'aria-hidden': 'true' });
  let seed = 42;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 46; i++) {
    const x = 30 + rnd() * (W - 60);
    const y = 14 + rnd() * 96;
    if (Math.abs(x - TX_X) < 34 || Math.abs(x - RX_X) < 34) continue;
    g.append(
      svg('circle', {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: (0.7 + rnd() * 0.9).toFixed(2),
        fill: 'var(--text-muted)',
        opacity: (0.18 + rnd() * 0.25).toFixed(2),
      }),
    );
  }
  return g;
}

function drawOverview(root: SVGElement, b: LinkBudget, s: AppState): void {
  const g = svg('g');
  // Beam cone: outer edge = first null, inner wash = half-power. The vertical
  // exaggeration is fixed; the miss offset is drawn relative to the null cone.
  const nullHalf = 26;
  const hpbwHalf = nullHalf * (b.txHpbwRad / 2 / b.txFirstNullRad);
  const missPx = clamp((b.missDistanceAu / b.firstNullRadiusAu) * nullHalf, 0, 46);
  const endY = OVERVIEW_Y + missPx;
  g.append(
    svg('polygon', {
      points: `${TX_X},${OVERVIEW_Y} ${RX_X},${endY - nullHalf} ${RX_X},${endY + nullHalf}`,
      fill: 'var(--series-1)',
      opacity: 0.07,
    }),
    svg('polygon', {
      points: `${TX_X},${OVERVIEW_Y} ${RX_X},${endY - hpbwHalf} ${RX_X},${endY + hpbwHalf}`,
      fill: 'var(--series-1)',
      opacity: 0.13,
    }),
    svg('line', {
      x1: TX_X,
      y1: OVERVIEW_Y,
      x2: RX_X,
      y2: endY,
      stroke: 'var(--series-1)',
      'stroke-width': 1.2,
      opacity: 0.65,
    }),
  );
  // Bodies
  g.append(
    svg('circle', { cx: TX_X, cy: OVERVIEW_Y, r: 5, fill: starColor(s) }),
    svg('circle', { cx: RX_X, cy: OVERVIEW_Y, r: 3.2, fill: 'var(--star-g)' }),
    txt(TX_X, 34, 'svg-label-strong', starName(s), 'middle'),
    txt(RX_X, 34, 'svg-label-strong', 'Solar System', 'middle'),
    txt(600, 27, 'svg-label-strong', `${trimNumber(s.rangeLy, 3)} light years`, 'middle'),
    txt(600, 44, 'svg-label-muted', `one-way light time ${trimNumber(s.rangeLy, 3)} years — no ACKs, no second chances`, 'middle'),
  );
  if (missPx >= 45.9) {
    g.append(txt(600, OVERVIEW_Y + 46, 'svg-label-muted', '⚠ beam axis off the chart — Earth is outside the first null', 'middle'));
  }
  root.append(g);
}

function drawZoomWedge(root: SVGElement, mx: number, my: number, ix: number, iy: number): void {
  const g = svg('g', { 'aria-hidden': 'true' });
  g.append(
    svg('circle', {
      cx: mx,
      cy: my,
      r: 14,
      fill: 'none',
      stroke: 'var(--baseline)',
      'stroke-width': 1,
    }),
  );
  const d = Math.atan2(iy - my, ix - mx);
  const back = Math.atan2(my - iy, mx - ix);
  for (const sign of [-1, 1]) {
    const p1 = [mx + 14 * Math.cos(d + sign * 0.5), my + 14 * Math.sin(d + sign * 0.5)];
    const p2 = [ix + INSET_R * Math.cos(back - sign * 0.62), iy + INSET_R * Math.sin(back - sign * 0.62)];
    g.append(
      svg('line', {
        x1: p1[0]!.toFixed(1),
        y1: p1[1]!.toFixed(1),
        x2: p2[0]!.toFixed(1),
        y2: p2[1]!.toFixed(1),
        stroke: 'var(--baseline)',
        'stroke-width': 1,
        opacity: 0.55,
      }),
    );
  }
  root.append(g);
}

function insetShell(c: { x: number; y: number }, title: string): SVGElement {
  return svg('g', {}, [
    svg('circle', {
      cx: c.x,
      cy: c.y,
      r: INSET_R,
      fill: 'var(--surface-1)',
      stroke: 'var(--baseline)',
      'stroke-width': 1.2,
    }),
    txt(c.x, c.y - INSET_R - 10, 'svg-label', title, 'middle'),
  ]);
}

function drawTransmitterInset(root: SVGElement, b: LinkBudget, s: AppState): void {
  const c = TX_INSET;
  const shell = insetShell(c, `Transmitter at ${starName(s)}`);
  const g = svg('g', { 'clip-path': 'url(#clip-tx)' });

  // Host star, size cue from its true radius
  const rStar = clamp(30 * (s.starRadiusM / R_SUN_M) ** 0.6, 12, 42);
  const sx = c.x - 72;
  g.append(
    svg('circle', { cx: sx, cy: c.y, r: rStar + 9, fill: starColor(s), opacity: 0.16 }),
    svg('circle', { cx: sx, cy: c.y, r: rStar, fill: starColor(s), opacity: 0.85 }),
  );

  // Dish cross-section, aperture height cued (logarithmically) by diameter
  const hAp = clamp(16 + 20 * Math.log10(s.txDiameterM), 9, 78);
  const dx = c.x + 44;
  const errRad = arcsecToRad(s.txPointingErrArcsec);
  const tilt = Math.min(errRad / b.txHpbwRad, 2.0) * 16; // degrees, exaggerated
  const beam = svg('g', {
    transform: `rotate(${tilt.toFixed(2)} ${dx} ${c.y})`,
  });
  // Boresight + half-power cone (fixed visual half-angle; labels carry truth)
  const coneLen = 210;
  const coneHalfDeg = 11;
  const spread = Math.tan((coneHalfDeg * Math.PI) / 180) * coneLen;
  beam.append(
    svg('polygon', {
      points: `${dx},${c.y} ${dx + coneLen},${c.y - spread} ${dx + coneLen},${c.y + spread}`,
      fill: 'var(--series-1)',
      opacity: 0.1,
    }),
    svg('line', {
      x1: dx,
      y1: c.y,
      x2: dx + coneLen,
      y2: c.y,
      stroke: 'var(--series-1)',
      'stroke-width': 1.6,
    }),
    svg('line', {
      x1: dx, y1: c.y, x2: dx + coneLen, y2: c.y - spread,
      stroke: 'var(--series-1)', 'stroke-width': 0.8, opacity: 0.5,
    }),
    svg('line', {
      x1: dx, y1: c.y, x2: dx + coneLen, y2: c.y + spread,
      stroke: 'var(--series-1)', 'stroke-width': 0.8, opacity: 0.5,
    }),
    // Dish rotates with the beam: reflector arc + feed
    svg('path', {
      d: `M ${dx + 7} ${c.y - hAp / 2} Q ${dx - 13} ${c.y} ${dx + 7} ${c.y + hAp / 2}`,
      fill: 'none',
      stroke: 'var(--text-primary)',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }),
    svg('circle', { cx: dx + 9, cy: c.y, r: 2.4, fill: 'var(--text-primary)' }),
  );
  g.append(beam);

  // Reference direction to Earth (horizontal) + error annotation
  g.append(
    svg('line', {
      x1: dx, y1: c.y, x2: dx + 205, y2: c.y,
      stroke: 'var(--text-muted)', 'stroke-width': 1, opacity: 0.75,
    }),
    txt(dx + 54, c.y - 26, 'svg-label-muted', 'to Earth →', 'middle'),
  );
  if (s.txPointingErrArcsec > 0) {
    g.append(
      txt(dx - 14, c.y + 58, 'svg-label', `ε = ${angleFormat(errRad)} (exaggerated)`, 'end'),
    );
  }
  g.append(
    txt(c.x, c.y + 76, 'svg-label', `θ₃dB ${angleFormat(b.txHpbwRad)} · null ${angleFormat(b.txFirstNullRad)}`, 'middle'),
    txt(c.x, c.y + 93, 'svg-label-muted', `${siFormat(s.txDiameterM, 'm')} · ${siFormat(s.txPowerW, 'W')} · ${dbFormat(b.txGainDbi, 'dBi')}`, 'middle'),
  );
  root.append(shell, g);
}

function drawSolarInset(root: SVGElement, b: LinkBudget): void {
  const c = RX_INSET;
  const shell = insetShell(c, 'Beam arrival at the Solar System (to scale in AU)');
  const g = svg('g', { 'clip-path': 'url(#clip-rx)' });

  const viewAu = Math.max(b.firstNullRadiusAu * 1.08, b.missDistanceAu * 1.12, 3);
  const pxPerAu = (INSET_R - 14) / viewAu;
  const beamY = c.y + b.missDistanceAu * pxPerAu; // beam walks "south" of the Sun

  // Beam footprint: half-power disk (gradient ≈ main-lobe roll-off) + first null ring
  g.append(
    svg('circle', {
      cx: c.x,
      cy: beamY,
      r: b.footprintRadiusAu * pxPerAu,
      fill: 'url(#beam-grad)',
      stroke: 'var(--series-1)',
      'stroke-width': 1.5,
      opacity: 0.95,
    }),
    svg('circle', {
      cx: c.x,
      cy: beamY,
      r: b.firstNullRadiusAu * pxPerAu,
      fill: 'none',
      stroke: 'var(--series-1)',
      'stroke-width': 0.8,
      opacity: 0.45,
    }),
  );
  // Beam centre cross
  g.append(
    svg('path', {
      d: `M ${c.x - 6} ${beamY} H ${c.x + 6} M ${c.x} ${beamY - 6} V ${beamY + 6}`,
      stroke: 'var(--series-1)',
      'stroke-width': 1.4,
    }),
  );
  if (b.missDistanceAu > 0.01) {
    g.append(
      svg('line', {
        x1: c.x, y1: c.y, x2: c.x, y2: beamY,
        stroke: 'var(--series-1)', 'stroke-width': 1, opacity: 0.7,
      }),
    );
  }

  // Earth orbit (1 AU) + Sun — at true scale, usually vanishingly small
  const orbitR = Math.max(1 * pxPerAu, 0.4);
  g.append(
    svg('circle', {
      cx: c.x, cy: c.y, r: orbitR,
      fill: 'none', stroke: 'var(--earth)', 'stroke-width': 1, opacity: 0.9,
    }),
    svg('circle', {
      cx: c.x, cy: c.y, r: 3.4,
      fill: 'var(--star-g)', stroke: 'var(--surface-1)', 'stroke-width': 2,
    }),
    svg('circle', {
      cx: c.x + orbitR, cy: c.y, r: 2.2,
      fill: 'var(--earth)', stroke: 'var(--surface-1)', 'stroke-width': 1.5,
    }),
  );
  // Sun label: centred above, short vertical leader (stays inside the clip)
  g.append(
    svg('line', {
      x1: c.x, y1: c.y - 8, x2: c.x, y2: c.y - 44,
      stroke: 'var(--text-muted)', 'stroke-width': 0.8, opacity: 0.8,
    }),
    txt(
      c.x,
      c.y - 52,
      'svg-label-muted',
      orbitR < 5 ? "Sun + Earth's orbit (1 AU, tiny here)" : "Sun + Earth's orbit (1 AU)",
      'middle',
    ),
  );

  // Footprint label sits under the half-power disk
  const fpPx = b.footprintRadiusAu * pxPerAu;
  g.append(
    txt(c.x, Math.min(beamY + fpPx + 16, c.y + INSET_R - 34), 'svg-label', '−3 dB footprint', 'middle'),
  );
  if (b.missDistanceAu > 0.01) {
    g.append(
      txt(c.x + 8, Math.min(c.y + (beamY - c.y) / 2 + 4, c.y + INSET_R - 44), 'svg-label', `miss ${trimNumber(b.missDistanceAu, 3)} AU`, 'start'),
    );
  }

  // Scale bar
  const barAu = niceNumber(70 / pxPerAu);
  const barPx = barAu * pxPerAu;
  const barY = c.y + INSET_R - 22;
  g.append(
    svg('path', {
      d: `M ${c.x - barPx / 2} ${barY} h ${barPx} M ${c.x - barPx / 2} ${barY - 4} v 8 M ${c.x + barPx / 2} ${barY - 4} v 8`,
      stroke: 'var(--text-secondary)',
      'stroke-width': 1.2,
      fill: 'none',
    }),
    txt(c.x, barY + 15, 'svg-tick', `${trimNumber(barAu, 3)} AU`, 'middle'),
  );
  root.append(shell, g);
}

function drawCenterFacts(root: SVGElement, b: LinkBudget, s: AppState): void {
  const cx = 600;
  let y = 208;
  const fact = (label: string, value: string): void => {
    root.append(txt(cx, y, 'svg-label-muted', label, 'middle'));
    root.append(txt(cx, y + 17, 'svg-label-strong', value, 'middle'));
    y += 44;
  };
  fact('half-power beam footprint at Earth', `radius ${trimNumber(b.footprintRadiusAu, 3)} AU`);
  fact('beam walk per arcsecond of pointing error', `${trimNumber(b.beamWalkAuPerArcsec, 3)} AU / ″`);
  fact(
    'beam centre currently misses the Sun by',
    b.missDistanceAu < 0.005 ? 'dead on target' : `${trimNumber(b.missDistanceAu, 3)} AU (${dbFormat(-b.txPointingLossDb)})`,
  );
  if (s.properMotionArcsecPerYr > 0) {
    fact(
      `aim-ahead for proper motion (μ = ${trimNumber(s.properMotionArcsecPerYr, 3)}″/yr × ${trimNumber(s.rangeLy, 3)} yr)`,
      angleFormat(arcsecToRad(b.aimAheadArcsec)),
    );
  }
}

function txt(x: number, y: number, cls: string, content: string, anchor: 'start' | 'middle' | 'end'): SVGElement {
  return svg('text', { x: x.toFixed(1), y: y.toFixed(1), class: cls, 'text-anchor': anchor, text: content });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function niceNumber(target: number): number {
  const exp = Math.floor(Math.log10(target));
  const base = target / 10 ** exp;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return nice * 10 ** exp;
}
