// Eigene Strich-Icons als SVG (keine externe Bibliothek)
const svg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  training: svg(
    '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'
  ),
  history: svg(
    '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
  ),
  exercises: svg(
    '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'
  ),
  stats: svg(
    '<path d="M5 20v-6M10 20V10M15 20v-8M20 20V5"/>'
  ),
  settings: svg(
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'
  ),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
  scale: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M7.5 12a4.5 4.5 0 0 1 9 0Z"/><path d="m12 12 1.6-2.4"/>'),
  upload: svg('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>'),
  download: svg('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/>'),
  shield: svg('<path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z"/><path d="m9 12 2 2 4-4"/>'),
  sliders: svg('<path d="M6 4v16M12 4v16M18 4v16"/><circle cx="6" cy="14" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="18" cy="16" r="2"/>'),
  back: svg('<path d="m15 5-7 7 7 7"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z"/><circle cx="12" cy="12.5" r="3.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  archive: svg('<rect x="3.5" y="4" width="17" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  unlink: svg('<path d="M15.7 14 18.7 11a4 4 0 0 0-5.7-5.7l-1 1M8.3 10l-3 3a4 4 0 0 0 5.7 5.7l1-1M4 4l16 16"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  grip: svg('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>'),
};
