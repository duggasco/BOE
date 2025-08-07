// This script should be inlined in index.html to prevent FOUC
// It runs before React loads and applies the saved theme immediately

export const themeScript = `
(function() {
  const saved = localStorage.getItem('theme-mode');
  const validModes = ['light', 'dark', 'system'];
  const mode = validModes.includes(saved) ? saved : 'system';
  
  let actualTheme = mode;
  if (mode === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  document.documentElement.classList.add(actualTheme);
  document.documentElement.setAttribute('data-theme', actualTheme);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', actualTheme === 'dark' ? '#0f1419' : '#ffffff');
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = actualTheme === 'dark' ? '#0f1419' : '#ffffff';
    document.head.appendChild(meta);
  }
})();
`;