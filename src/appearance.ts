const key = 'foliopdf.appearance';
const themes = ['system', 'light', 'dark', 'deep-dark'] as const;
const palettes = ['sage', 'ocean', 'lavender', 'sand', 'rose', 'slate', 'teal', 'custom'] as const;
type Theme = typeof themes[number];
type Palette = typeof palettes[number];

const theme = document.querySelector<HTMLSelectElement>('#appearance-theme')!;
const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="palette"]')];
const picker = document.querySelector<HTMLInputElement>('#accent-picker')!;
const hex = document.querySelector<HTMLInputElement>('#accent-hex')!;
const darkPdf = document.querySelector<HTMLInputElement>('#dark-pdf')!;
const validHex = /^#[0-9a-f]{6}$/i;
const current: { theme: Theme; palette: Palette; color: string; darkPdf: boolean } = {
  theme: 'system', palette: 'sage', color: '#719b77', darkPdf: false,
};

try {
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  if (themes.includes(saved.theme)) current.theme = saved.theme;
  if (palettes.includes(saved.palette)) current.palette = saved.palette;
  if (typeof saved.color === 'string' && validHex.test(saved.color)) current.color = saved.color;
  current.darkPdf = saved.darkPdf === true;
} catch { /* Use defaults if preferences are unavailable or invalid. */ }

function apply(): void {
  document.documentElement.dataset.theme = current.theme;
  document.documentElement.dataset.palette = current.palette;
  const root = document.documentElement;
  root.style.setProperty('--custom-accent', current.color);
  const channels = current.color.slice(1).match(/../g)!.map(pair => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  root.style.setProperty('--custom-on-accent', luminance > 0.179 ? '#000' : '#fff');
  root.toggleAttribute('data-dark-pdf', current.darkPdf);
  picker.value = hex.value = current.color;
  darkPdf.checked = current.darkPdf;
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

function selectCustomColor(value: string): void {
  current.color = value;
  current.palette = 'custom';
  save();
}

picker.addEventListener('input', () => selectCustomColor(picker.value));
hex.addEventListener('change', () => {
  const value = '#' + hex.value.trim().replace(/^#/, '');
  if (validHex.test(value)) selectCustomColor(value);
  else hex.value = current.color;
});
darkPdf.addEventListener('change', () => { current.darkPdf = darkPdf.checked; save(); });
