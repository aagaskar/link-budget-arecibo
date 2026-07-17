import type { LinkBudget } from '../physics/linkBudget';
import { transferTimeS } from '../physics/linkBudget';
import { dbFormat, durationFormat, rateFormat, siFormat, trimNumber } from '../physics/units';
import { el } from './dom';

interface Verdict {
  color: string;
  glyph: string;
  label: string;
}

function verdictFor(bps: number): Verdict {
  if (bps >= 500)
    return { color: 'var(--status-good)', glyph: '✓', label: 'Real data link — kbps-class, like the notebook baseline' };
  if (bps >= 10)
    return { color: 'var(--status-warning)', glyph: '~', label: 'Slow telemetry only — think weather-station, not science archive' };
  if (bps >= 0.1)
    return { color: 'var(--status-serious)', glyph: '!', label: 'A beacon, not a data link' };
  return { color: 'var(--status-critical)', glyph: '✕', label: 'Effectively no link — send the beetles' };
}

export function initHero(container: HTMLElement): { update(b: LinkBudget): void } {
  const heroValue = el('div', { class: 'value' });
  const heroDetail = el('div', { class: 'detail' });
  const verdictDot = el('span', { class: 'dot', 'aria-hidden': 'true' });
  const verdictText = el('span');
  const heroTile = el('div', { class: 'card hero-tile' }, [
    el('div', { class: 'label', text: 'Shannon capacity (power-limited limit)' }),
    heroValue,
    heroDetail,
    el('div', { class: 'verdict' }, [verdictDot, verdictText]),
  ]);

  const tiles: Array<{ value: HTMLElement; detail: HTMLElement; render(b: LinkBudget): [string, string] }> = [];
  const addTile = (label: string, render: (b: LinkBudget) => [string, string]): void => {
    const value = el('div', { class: 'value' });
    const detail = el('div', { class: 'detail' });
    container.append(
      el('div', { class: 'card stat-tile' }, [el('div', { class: 'label', text: label }), value, detail]),
    );
    tiles.push({ value, detail, render });
  };

  container.append(heroTile);
  addTile('Received power', (b) => [siFormat(b.rxPowerW, 'W'), dbFormat(b.rxPowerDbw, 'dBW')]);
  addTile('C/N₀', (b) => [dbFormat(b.cn0DbHz, 'dB-Hz'), `noise ${dbFormat(b.totalNoiseDbwHz, 'dBW/Hz')}`]);
  addTile('Signal photons', (b) => [
    `${siFormat(b.photonRatePerS, 'γ')}/s`,
    'the link literally counts photons',
  ]);
  addTile('One-way delay', (b) => [
    `${trimNumber(b.lightTravelYears, 3)} yr`,
    'no ACKs, no retries',
  ]);
  addTile('1 TB of science data', (b) => [
    durationFormat(transferTimeS(1e12, b.capacityBps)),
    'at Shannon capacity',
  ]);

  const update = (b: LinkBudget): void => {
    const [big, unit] = splitRate(b.capacityBps);
    heroValue.replaceChildren(big, el('span', { class: 'unit', text: unit }));
    heroDetail.textContent =
      b.totalPointingLossDb > 0.05
        ? `${rateFormat(b.capacityNoPointingBps)} with perfect pointing — ${dbFormat(b.totalPointingLossDb)} pointing loss`
        : 'with perfect pointing on both ends';
    const v = verdictFor(b.capacityBps);
    verdictDot.style.background = v.color;
    verdictDot.textContent = v.glyph;
    verdictText.textContent = v.label;
    for (const t of tiles) {
      const [value, detail] = t.render(b);
      t.value.textContent = value;
      t.detail.textContent = detail;
    }
  };

  return { update };
}

function splitRate(bps: number): [string, string] {
  if (!Number.isFinite(bps) || bps <= 0) return ['0', 'bps'];
  const units: Array<[number, string]> = [
    [1e12, 'Tbps'],
    [1e9, 'Gbps'],
    [1e6, 'Mbps'],
    [1e3, 'kbps'],
  ];
  for (const [scale, unit] of units) {
    if (bps >= scale) return [trimNumber(bps / scale, 3), unit];
  }
  if (bps >= 0.01) return [trimNumber(bps, 3), 'bps'];
  return [bps.toExponential(1), 'bps'];
}
