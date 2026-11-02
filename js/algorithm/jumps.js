// Sprung-Strategie: Wie groß ist der nächste Gewichtsschritt relativ zur Kraft? (SPEC.md, Abschnitt 7.5)
// Reine Funktionen. Ein Schritt von 5 kg ist bei 40 kg viel (≈ 4 Wdh.), bei 120 kg wenig.

// sprungWdh = (Gewichtsschritt / e1RM × 100) / repPct
export function jumpInReps(stepKg, e1rm, settings) {
  if (!stepKg || !e1rm) return null;
  return ((stepKg / e1rm) * 100) / settings.repPct;
}

// 'normal' | 'extend' (erst Wdh. sammeln) | 'partial' (Teilsprung). Ohne e1RM: normal steigern.
export function jumpStrategy(stepKg, e1rm, settings) {
  const reps = jumpInReps(stepKg, e1rm, settings);
  if (reps == null || reps <= settings.jumpNormal) return { strategy: 'normal', reps };
  if (reps <= settings.jumpExtend) return { strategy: 'extend', reps };
  return { strategy: 'partial', reps };
}
