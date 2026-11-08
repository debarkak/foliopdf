const key = 'foliopdf.appearance';
const themes = ['system', 'light', 'dark'] as const;
const palettes = ['sage', 'ocean', 'lavender', 'sand'] as const;
type Theme = typeof themes[number];
type Palette = typeof palettes[number];

const theme = document.querySelector<HTMLSelectElement>('#appearance-theme')!;
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="palette"]')];
let current: { theme: Theme; palette: Palette } = { theme: 'system', palette: 'sage' };

try {
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  if (themes.includes(saved.theme)) current.theme = saved.theme;
  if (palettes.includes(saved.palette)) current.palette = saved.palette;
} catch { /* Use defaults if preferences are unavailable or invalid. */ }

function apply(): void {
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.dataset.palette = current.palette;
  theme.value = current.theme;
  radios.forEach(radio => { radio.checked = radio.value === current.palette; });
}
function save(): void {
  apply();
  try { localStorage.setItem(key, JSON.stringify(current)); } catch { /* Settings still apply for this session. */ }
}
apply();
theme.addEventListener('change', () => { if (themes.includes(theme.value as Theme)) { current.theme = theme.value as Theme; save(); } });
radios.forEach(radio => radio.addEventListener('change', () => { if (palettes.includes(radio.value as Palette)) { current.palette = radio.value as Palette; save(); } }));
