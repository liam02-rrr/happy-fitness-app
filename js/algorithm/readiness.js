// Tagesform (SPEC.md, Abschnitt 7.6): Gefühl und Krankheit verändern Last, Sätze und Ziel-RIR.
// Reine Funktion. Die Wirkungen kombinieren sich.

export function readinessEffects({ feeling = 'normal', illness = 'none' } = {}, settings) {
  const effects = {
    rirBonus: 0,          // Ziel-RIR höher
    allowDouble: true,    // Doppelsprünge erlaubt
    loadReductionPct: 0,  // Last weniger in %
    intenseDelta: 0,      // Intensivsätze mehr/weniger
    setsPerExerciseDelta: 0,
    noIntense: false,     // nur Aufwärm- und Volumensatz
    reduced: false,       // zählt nicht für Plateau
    labels: [],
  };

  if (feeling === 'tired') {
    effects.rirBonus += 1;
    effects.allowDouble = false;
    effects.reduced = true;
    effects.labels.push('müde: Ziel-RIR +1');
  }
  if (feeling === 'weak') {
    effects.loadReductionPct += settings.weakPct;
    effects.intenseDelta -= 1;
    effects.allowDouble = false;
    effects.reduced = true;
    effects.labels.push(`schwach: −${String(settings.weakPct).replace('.', ',')} %, 1 Intensivsatz weniger`);
  }
  if (illness === 'recent') {
    effects.loadReductionPct += settings.recentIllPct;
    effects.setsPerExerciseDelta -= 1;
    effects.allowDouble = false;
    effects.reduced = true;
    effects.labels.push(`angeschlagen: −${String(settings.recentIllPct).replace('.', ',')} %, 1 Satz weniger`);
  }
  if (illness === 'current') {
    effects.noIntense = true;
    effects.allowDouble = false;
    effects.reduced = true;
    effects.labels.push('krank: nur Aufwärm- und Volumensatz');
  }
  return effects;
}
