(() => {
  'use strict';
  const key = 'thread-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark'].includes(value) ? value : 'system';
  const read = () => { try { return valid(localStorage.getItem(key)); } catch { return 'system'; } };
  let preference = read();
  function apply() {
    const theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.bsTheme = theme;
    document.documentElement.style.colorScheme = theme;
    const dark = theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', `${dark ? '라이트' : '다크'} 모드로 전환`);
      button.title = `현재 ${dark ? '다크' : '라이트'} 모드${preference === 'system' ? ' · 기기 설정' : ''}`;
      button.querySelector('[data-theme-icon]').textContent = dark ? '☾' : '☀';
      button.querySelector('[data-theme-label]').textContent = dark ? '다크' : '라이트';
    });
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const active = button.dataset.themeChoice === preference;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function choose(value) {
    preference = valid(value);
    try {
      if (preference === 'system') localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch { /* Theme still works when browser storage is unavailable. */ }
    apply();
  }
  // Run before CSS paints, so saved/OS dark mode has no light-page flash.
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => choose(document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark')));
    document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => choose(button.dataset.themeChoice)));
  });
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { preference = read(); apply(); } });
})();
