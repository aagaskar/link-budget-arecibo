import { STAR_PRESETS } from '../physics/presets';
import { angleFormat, arcsecToRad, siFormat, trimNumber } from '../physics/units';
import { applyPreset, markCustomDistance, NOTEBOOK_CONFIG, type AppState } from '../state';
import { el } from './dom';

interface Scale {
  toSlider(value: number): number;
  fromSlider(t: number): number;
}

const STEPS = 1000;

const logScale = (min: number, max: number): Scale => ({
  toSlider: (v) => (Math.log10(v / min) / Math.log10(max / min)) * STEPS,
  fromSlider: (t) => min * (max / min) ** (t / STEPS),
});

const linearScale = (min: number, max: number): Scale => ({
  toSlider: (v) => ((v - min) / (max - min)) * STEPS,
  fromSlider: (t) => min + (t / STEPS) * (max - min),
});

/** Log scale whose leftmost position snaps to exactly zero (pointing error). */
const zeroLogScale = (min: number, max: number): Scale => ({
  toSlider: (v) => (v <= 0 ? 0 : Math.max(1, logScale(min, max).toSlider(v))),
  fromSlider: (t) => (t <= 0 ? 0 : logScale(min, max).fromSlider(t)),
});

interface ControlSpec {
  label: string;
  note?: string;
  scale: Scale;
  get(s: AppState): number;
  set(s: AppState, v: number): void;
  format(v: number, s: AppState): string;
}

export function initControls(
  container: HTMLElement,
  state: AppState,
  onChange: () => void,
): { update(): void } {
  const presetButtons = new Map<string, HTMLButtonElement>();
  const blurb = el('div', { class: 'preset-blurb' });
  const presetRow = el('div', { class: 'preset-row', role: 'group', 'aria-label': 'Transmitter star presets' });
  for (const preset of STAR_PRESETS) {
    const btn = el('button', { type: 'button', text: preset.name });
    btn.addEventListener('click', () => {
      applyPreset(state, preset);
      onChange();
    });
    presetButtons.set(preset.id, btn);
    presetRow.append(btn);
  }
  container.append(presetRow, blurb);

  const controls: Array<{ spec: ControlSpec; slider: HTMLInputElement; readout: HTMLOutputElement }> = [];

  const addSection = (title: string): void => {
    container.append(el('div', { class: 'control-section', text: title }));
  };

  const addControl = (spec: ControlSpec): void => {
    const slider = el('input', {
      type: 'range',
      min: '0',
      max: String(STEPS),
      step: '1',
      'aria-label': spec.label,
    });
    const readout = el('output');
    slider.addEventListener('input', () => {
      spec.set(state, spec.scale.fromSlider(Number(slider.value)));
      onChange();
    });
    const head = el('div', { class: 'control-head' }, [
      el('label', { text: spec.label }),
      readout,
    ]);
    const wrap = el('div', { class: 'control' }, [head, slider]);
    if (spec.note) wrap.append(el('div', { class: 'control-note', text: spec.note }));
    container.append(wrap);
    controls.push({ spec, slider, readout });
  };

  addSection('Link geometry');
  addControl({
    label: 'Distance to star',
    scale: logScale(1, 50),
    get: (s) => s.rangeLy,
    set: (s, v) => {
      s.rangeLy = v;
      markCustomDistance(s);
    },
    format: (v) => `${trimNumber(v, 3)} ly`,
  });

  addSection('Remote transmitter (at the star)');
  addControl({
    label: 'Dish diameter',
    note: 'Arecibo: 305 m. Beamwidth and gain both follow from this.',
    scale: logScale(0.5, 1000),
    get: (s) => s.txDiameterM,
    set: (s, v) => (s.txDiameterM = v),
    format: (v) => siFormat(v, 'm'),
  });
  addControl({
    label: 'Transmit power',
    note: 'The 1974 Arecibo message used 450 kW.',
    scale: logScale(100, 1e9),
    get: (s) => s.txPowerW,
    set: (s, v) => (s.txPowerW = v),
    format: (v) => siFormat(v, 'W'),
  });
  addControl({
    label: 'Pointing error',
    note: 'Angle between the beam axis and the true direction to Earth.',
    scale: zeroLogScale(0.1, 3600),
    get: (s) => s.txPointingErrArcsec,
    set: (s, v) => (s.txPointingErrArcsec = v),
    format: (v) => (v === 0 ? 'perfect' : angleFormat(arcsecToRad(v))),
  });

  addSection('Receiver (Arecibo, Earth)');
  addControl({
    label: 'Dish diameter',
    scale: logScale(1, 1000),
    get: (s) => s.rxDiameterM,
    set: (s, v) => (s.rxDiameterM = v),
    format: (v) => siFormat(v, 'm'),
  });
  addControl({
    label: 'System noise temperature',
    note: '300 K matches the notebook; a cryogenic receiver reaches ~25 K.',
    scale: logScale(4, 1000),
    get: (s) => s.systemTempK,
    set: (s, v) => (s.systemTempK = v),
    format: (v) => `${trimNumber(v, 3)} K`,
  });
  addControl({
    label: 'Pointing error',
    scale: zeroLogScale(0.1, 3600),
    get: (s) => s.rxPointingErrArcsec,
    set: (s, v) => (s.rxPointingErrArcsec = v),
    format: (v) => (v === 0 ? 'perfect' : angleFormat(arcsecToRad(v))),
  });

  addSection('Both antennas');
  addControl({
    label: 'Carrier frequency',
    scale: logScale(300e6, 30e9),
    get: (s) => s.frequencyHz,
    set: (s, v) => (s.frequencyHz = v),
    format: (v) => siFormat(v, 'Hz'),
  });
  addControl({
    label: 'Aperture efficiency',
    note: '0.434 reproduces the 74 dBi from the Arecibo transmitter manual.',
    scale: linearScale(0.3, 0.8),
    get: (s) => s.apertureEfficiency,
    set: (s, v) => (s.apertureEfficiency = v),
    format: (v) => trimNumber(v, 3),
  });

  const resetBtn = el('button', { type: 'button', text: 'Reset to notebook baseline' });
  resetBtn.addEventListener('click', () => {
    Object.assign(state, NOTEBOOK_CONFIG);
    const notebook = STAR_PRESETS.find((p) => p.id === 'notebook')!;
    applyPreset(state, notebook);
    onChange();
  });
  container.append(el('div', { class: 'reset-row' }, [resetBtn]));

  const update = (): void => {
    for (const [id, btn] of presetButtons) {
      btn.setAttribute('aria-pressed', String(id === state.presetId));
    }
    const active = STAR_PRESETS.find((p) => p.id === state.presetId);
    blurb.textContent = active ? active.blurb : 'Custom distance';
    for (const { spec, slider, readout } of controls) {
      const value = spec.get(state);
      slider.value = String(Math.round(spec.scale.toSlider(value)));
      readout.textContent = spec.format(value, state);
    }
  };

  update();
  return { update };
}
