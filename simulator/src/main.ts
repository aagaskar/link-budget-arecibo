import './style.css';
import { computeLinkBudget } from './physics/linkBudget';
import { initialState } from './state';
import { initChart } from './ui/chart';
import { initControls } from './ui/controls';
import { mustGet } from './ui/dom';
import { initGeometry } from './ui/geometry';
import { initHero } from './ui/hero';
import { initLedger } from './ui/ledger';
import { initTheme } from './ui/theme';

const state = initialState();

initTheme(mustGet<HTMLButtonElement>(document, '#theme-toggle'));
const hero = initHero(mustGet<HTMLElement>(document, '#hero'));
const geometry = initGeometry(mustGet<SVGSVGElement>(document, '#geometry'));
const ledger = initLedger(mustGet<HTMLElement>(document, '#ledger'));
const chart = initChart(
  mustGet<HTMLElement>(document, '#chart-wrap'),
  mustGet<SVGSVGElement>(document, '#chart'),
  mustGet<HTMLElement>(document, '#point-table'),
);

const render = (): void => {
  const budget = computeLinkBudget(state);
  hero.update(budget);
  geometry.update(budget, state);
  ledger.update(budget, state);
  chart.update(budget, state);
  controls.update();
};

const controls = initControls(mustGet<HTMLElement>(document, '#controls'), state, render);
render();
