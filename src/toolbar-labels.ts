const toggle = document.querySelector<HTMLInputElement>('#toolbar-labels')!;
try { toggle.checked = localStorage.getItem('foliopdf.toolbar-labels') === 'true'; } catch { /* Session defaults. */ }

for (const button of document.querySelectorAll<HTMLButtonElement>('.toolbar button[aria-label]')) {
  const label = document.createElement('span');
  label.className = 'toolbar-label';
  label.textContent = button.getAttribute('aria-label');
  button.append(label);
}

function apply(): void {
  document.documentElement.toggleAttribute('data-toolbar-labels', toggle.checked);
}
apply();
toggle.addEventListener('change', () => {
  apply();
  try { localStorage.setItem('foliopdf.toolbar-labels', String(toggle.checked)); } catch { /* Session only. */ }
});

export {};
