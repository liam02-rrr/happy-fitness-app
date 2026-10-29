// Kleine Helfer zum Bauen der Oberfläche. Text wird immer als Text eingesetzt (kein innerHTML),
// damit Notizen und Namen nie als HTML ausgeführt werden.

// h('button', { class: 'btn', onclick: fn }, 'Text', child, …)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key in el && key !== 'list') {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }
  el.append(...children.flat().filter((child) => child != null && child !== false));
  return el;
}

// SVG-Markup aus der eigenen Icon-Sammlung als Element
export function icon(svgMarkup) {
  const template = document.createElement('template');
  template.innerHTML = svgMarkup.trim();
  return template.content.firstChild;
}
