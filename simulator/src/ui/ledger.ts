import type { LinkBudget } from '../physics/linkBudget';
import type { AppState } from '../state';
import { angleFormat, arcsecToRad, dbFormat, rateFormat, siFormat, trimNumber } from '../physics/units';
import { el } from './dom';

/** The classic link budget ledger: every gain and loss, in decibels. */
export function initLedger(container: HTMLElement): {
  update(b: LinkBudget, s: AppState): void;
} {
  const tbody = el('tbody');
  container.append(
    el('table', { class: 'ledger' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Term' }),
          el('th', { class: 'num', text: 'Value' }),
          el('th', { text: 'Detail' }),
        ]),
      ]),
      tbody,
    ]),
  );

  const update = (b: LinkBudget, s: AppState): void => {
    const rows: Array<['section' | 'row' | 'total', string, string, string]> = [
      ['section', 'Transmit', '', ''],
      ['row', 'Transmit power', dbFormat(b.txPowerDbw, 'dBW'), siFormat(s.txPowerW, 'W')],
      ['row', 'Antenna gain', dbFormat(b.txGainDbi, 'dBi'), `${siFormat(s.txDiameterM, 'm')} dish, η = ${trimNumber(s.apertureEfficiency, 3)}`],
      ['row', 'Pointing loss', dbFormat(-b.txPointingLossDb), s.txPointingErrArcsec === 0 ? 'on boresight' : `${angleFormat(arcsecToRad(s.txPointingErrArcsec))} off boresight`],
      ['total', 'EIRP', dbFormat(b.eirpDbw, 'dBW'), ''],
      ['section', 'Path', '', ''],
      ['row', 'Free-space path loss', dbFormat(-b.pathLossDb), `${trimNumber(s.rangeLy, 3)} ly at λ = ${siFormat(b.lambdaM, 'm')}`],
      ['section', 'Receive', '', ''],
      ['row', 'Antenna gain', dbFormat(b.rxGainDbi, 'dBi'), `${siFormat(s.rxDiameterM, 'm')} dish`],
      ['row', 'Pointing loss', dbFormat(-b.rxPointingLossDb), s.rxPointingErrArcsec === 0 ? 'on boresight' : 'receiver off target'],
      ['total', 'Received power', dbFormat(b.rxPowerDbw, 'dBW'), siFormat(b.rxPowerW, 'W')],
      ['section', 'Noise', '', ''],
      ['row', 'Thermal noise density', dbFormat(b.thermalNoiseDbwHz, 'dBW/Hz'), `kT at ${trimNumber(s.systemTempK, 3)} K`],
      ['row', 'Host-star noise density', dbFormat(b.starNoiseDbwHz, 'dBW/Hz'), starNote(b)],
      ['total', 'C/N₀', dbFormat(b.cn0DbHz, 'dB-Hz'), rateFormat(b.capacityBps)],
    ];
    tbody.replaceChildren(
      ...rows.map(([kind, term, value, detail]) => {
        if (kind === 'section') {
          return el('tr', { class: 'section' }, [el('td', { colspan: '3', text: term })]);
        }
        return el('tr', { class: kind === 'total' ? 'total' : '' }, [
          el('td', { text: term }),
          el('td', { class: 'num', text: value }),
          el('td', { class: 'detail', text: detail }),
        ]);
      }),
    );
  };

  return { update };
}

function starNote(b: LinkBudget): string {
  const below = b.thermalNoiseDbwHz - b.starNoiseDbwHz;
  return `${dbFormat(below, 'dB')} below thermal — negligible, as the notebook found`;
}
