/**
 * Dark Mode CSS Lazy Loader
 * Only loads dark-mode.css when needed
 * Improves initial page load performance
 */

let darkModeLoaded = false;

export const loadDarkModeCSS = () => {
  if (darkModeLoaded) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/src/styles/dark-mode.css';
  link.id = 'dark-mode-styles';
  
  document.head.appendChild(link);
  darkModeLoaded = true;
};

export const unloadDarkModeCSS = () => {
  const existingLink = document.getElementById('dark-mode-styles');
  if (existingLink) {
    existingLink.remove();
    darkModeLoaded = false;
  }
};