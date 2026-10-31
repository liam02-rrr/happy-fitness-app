// Pausentimer (SPEC.md, Abschnitt 6.2): startet nach dem Haken, +15 s / −15 s / überspringen, Ton am Ende.
// Gerechnet wird mit der Endzeit, damit der Timer auch nach dem Sperren des iPhones stimmt.
import { h } from './dom.js';

const STEP_SECONDS = 15;
const STORAGE_KEY = 'overload-rest-end';

let audioContext = null;

// iOS erlaubt Ton nur, wenn der AudioContext bei einem Tipp entsperrt wurde
export function unlockAudio() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function beep() {
  if (!audioContext) return;
  const now = audioContext.currentTime;
  [0, 0.25, 0.5].forEach((offset, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.22);
  });
}

function readStoredEnd() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return value > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function storeEnd(value) {
  try {
    value ? localStorage.setItem(STORAGE_KEY, String(value)) : localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ohne Speicher läuft der Timer trotzdem, nur nicht über einen Neustart hinweg
  }
}

const pad = (n) => String(n).padStart(2, '0');

export function createRestTimer() {
  let end = null;
  let total = 0;
  let tick = null;

  const time = h('span', { class: 'rest-time num' });
  const label = h('span', { class: 'rest-label' }, 'Pause');
  const progress = h('span', { class: 'rest-progress-bar' });
  const el = h('div', { class: 'rest-timer', hidden: true, role: 'timer', 'aria-live': 'off' },
    h('span', { class: 'rest-progress' }, progress),
    h('div', { class: 'rest-main' },
      h('div', { class: 'rest-text' }, label, time),
      h('div', { class: 'rest-actions' },
        h('button', { type: 'button', class: 'rest-btn', onclick: () => adjust(-STEP_SECONDS) }, '−15'),
        h('button', { type: 'button', class: 'rest-btn', onclick: () => adjust(STEP_SECONDS) }, '+15'),
        h('button', { type: 'button', class: 'rest-btn rest-skip', onclick: () => stop() }, 'Weiter')
      )
    )
  );

  function render() {
    const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    time.textContent = `${Math.floor(remaining / 60)}:${pad(remaining % 60)}`;
    progress.style.transform = `scaleX(${total ? remaining / total : 0})`;
    el.classList.toggle('is-ending', remaining <= 10);
    if (remaining <= 0) finish();
  }

  function start(seconds) {
    total = seconds;
    end = Date.now() + seconds * 1000;
    storeEnd(end);
    el.hidden = false;
    el.classList.remove('is-done');
    label.textContent = 'Pause';
    clearInterval(tick);
    tick = setInterval(render, 250);
    render();
  }

  function adjust(delta) {
    if (!end) return;
    end = Math.max(Date.now() + 1000, end + delta * 1000);
    total = Math.max(total, Math.ceil((end - Date.now()) / 1000));
    storeEnd(end);
    render();
  }

  function finish() {
    clearInterval(tick);
    end = null;
    storeEnd(null);
    beep();
    el.classList.add('is-done');
    label.textContent = 'Pause vorbei';
    time.textContent = 'Los geht’s';
    setTimeout(() => {
      if (!end) el.hidden = true;
    }, 4000);
  }

  function stop() {
    clearInterval(tick);
    end = null;
    storeEnd(null);
    el.hidden = true;
  }

  // Nach einem Neustart der App einen laufenden Timer fortsetzen
  const stored = readStoredEnd();
  if (stored) {
    total = Math.ceil((stored - Date.now()) / 1000);
    start(total);
    end = stored;
  }

  // Beim Zurückkehren in die App sofort aktualisieren
  const onVisible = () => end && render();
  document.addEventListener('visibilitychange', onVisible);

  // Anzeige aufräumen; ein laufender Timer bleibt gespeichert und läuft beim nächsten Öffnen weiter
  function destroy() {
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVisible);
  }

  return { el, start, stop, destroy, isRunning: () => end != null };
}
