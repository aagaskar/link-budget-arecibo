/** Manual light/dark override on top of the OS preference. */

const KEY = 'lbs-theme';
const MODES = ['auto', 'light', 'dark'] as const;
type Mode = (typeof MODES)[number];

export function initTheme(button: HTMLButtonElement): void {
  let mode = (localStorage.getItem(KEY) as Mode | null) ?? 'auto';
  if (!MODES.includes(mode)) mode = 'auto';

  const apply = (): void => {
    if (mode === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    button.textContent = `theme: ${mode}`;
  };

  button.addEventListener('click', () => {
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]!;
    localStorage.setItem(KEY, mode);
    apply();
  });
  apply();
}
