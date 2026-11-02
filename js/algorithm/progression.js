// Vorschlag für die nächste Ausführung einer Übung (SPEC.md, Abschnitte 7.1–7.6).
// Reine Funktion: bekommt Historie und Einstellungen, liefert Sätze und eine Begründung in einem Satz.
// Evidenz: Doppelte Progression und RIR-Steuerung sind als Prinzipien gut belegt;
// die konkreten Schwellenwerte sind Heuristiken und deshalb alle einstellbar.
import { shiftLoad, roundToStep, loadRank, loadOf, sameLoad, isLevelBased } from './loads.js';
import { sessionBestE1rm } from './e1rm.js';
import { jumpStrategy } from './jumps.js';
import { readinessEffects } from './readiness.js';

const fmt = (value) => String(Math.round(value * 100) / 100).replace('.', ',');

export function describeLoad(load, exercise) {
  if (!load) return '–';
  if (load.seconds != null) return `${load.seconds} s`;
  if (load.level != null) return `${exercise.type === 'band' ? 'Band' : 'Stufe'} ${load.level}`;
  if (exercise.type === 'band') return 'gleiches Band';
  if (load.weight == null) return '–';
  if (exercise.type === 'bodyweight') return load.weight ? `KG + ${fmt(load.weight)} kg` : 'KG';
  return `${fmt(load.weight)} kg${exercise.type === 'assisted' ? ' Hilfe' : ''}`;
}

const mains = (sets) => sets.filter((set) => set.done !== false && !set.dropFrom);

// Intensivsätze der letzten Ausführung; ohne Satztypen die schwersten Sätze
function intenseSetsOf(sets, exercise) {
  const main = mains(sets);
  const intense = main.filter((set) => set.setType === 'intense');
  if (intense.length) return intense;
  const ranks = main.map((set) => loadRank(loadOf(set), exercise) ?? -Infinity);
  const max = Math.max(...ranks);
  return main.filter((_, i) => ranks[i] === max);
}

const bestReps = (sets) => Math.max(...sets.map((set) => set.reps ?? 0));

// Wie oft in Folge die Untergrenze im besten Intensivsatz verfehlt wurde
function consecutiveFails(history, exercise, settings) {
  let count = 0;
  for (const execution of history) {
    const intense = intenseSetsOf(execution.sets, exercise);
    if (!intense.length || bestReps(intense) >= settings.intenseRange.min) break;
    count++;
  }
  return count;
}

// Last um die Tagesform verringern: kg-Übungen in %, sonst eine Stufe leichter
function reduceLoad(load, exercise, pct, settings) {
  if (!pct || !load) return load;
  if (exercise.type === 'weight' && load.weight != null) {
    return { weight: roundToStep(load.weight * (1 - pct / 100), exercise.steps, 'down') };
  }
  return shiftLoad(load, exercise, -1, settings) ?? load;
}

// Zeit-Übungen: alle Sätze erreichen das Ziel → +timeStep
function suggestTime(last, exercise, settings, effects, count) {
  const seconds = mains(last.sets).map((set) => set.seconds).filter((value) => value != null);
  if (!seconds.length) return null;
  const target = last.suggestion?.targetSeconds ?? Math.max(...seconds);
  const reached = seconds.every((value) => value >= target);
  const next = reached ? target + settings.timeStep : target;
  const load = reduceLoad({ seconds: next }, exercise, effects.loadReductionPct, settings);
  const setCount = Math.max(1, count);
  return {
    sets: Array.from({ length: setCount }, () => ({ setType: 'intense', load, reps: null, rir: settings.intenseRIR + effects.rirBonus })),
    reason: reached ? `Alle Sätze ${target} s gehalten → +${settings.timeStep} s` : `Ziel: ${target} s in allen Sätzen`,
    targetSeconds: next,
  };
}

/**
 * @param exercise     Übung (Typ, Stufen)
 * @param history      frühere Ausführungen, neueste zuerst: [{ sets, suggestion? }]
 * @param sameContext  false = Historie aus dem anderen Kontext → Vorschlag „unsicher“
 * @param readiness    { feeling, illness } des heutigen Trainings
 * @param isFirstInGroup  erste Übung dieser Muskelgruppe heute → Aufwärmsatz
 * @param bodyweightKg letzter Körpergewicht-Eintrag vor dem Training (für Körpergewichtstypen)
 */
export function suggestExercise({ exercise, history, settings: baseSettings, sameContext = true, readiness = {}, isFirstInGroup = true, bodyweightKg = null }) {
  // Eigene Wiederholungsbereiche der Übung überschreiben die Standardwerte (SPEC 4.1 repRanges)
  const settings = {
    ...baseSettings,
    volumeRange: exercise.repRanges?.volume ?? baseSettings.volumeRange,
    intenseRange: exercise.repRanges?.intense ?? baseSettings.intenseRange,
  };
  const last = history?.[0];
  if (!last || mains(last.sets).length === 0) return null;

  const effects = readinessEffects(readiness, settings);
  const intenseCount = effects.noIntense ? 0
    : Math.max(0, settings.intenseSets + effects.intenseDelta + effects.setsPerExerciseDelta);
  const intenseRir = settings.intenseRIR + effects.rirBonus;
  const volumeRir = settings.volumeRIR + effects.rirBonus;
  const notes = [];

  // ---- Zeit-Übungen ----
  if (exercise.type === 'time') {
    const time = suggestTime(last, exercise, settings, effects, intenseCount || 1);
    if (!time) return null;
    return finish(time.sets, time.reason, { targetSeconds: time.targetSeconds });
  }

  const { min: repMin, max: repMax } = settings.intenseRange;
  const intense = intenseSetsOf(last.sets, exercise);
  const e1rm = sessionBestE1rm(last.sets, exercise, settings, bodyweightKg);

  // Lasten der Intensivsätze: bei laufendem Teilsprung gibt es zwei verschiedene
  const ranked = [...intense].sort((a, b) => (loadRank(loadOf(b), exercise) ?? 0) - (loadRank(loadOf(a), exercise) ?? 0));
  const topLoad = loadOf(ranked[0]);
  const baseLoad = loadOf(ranked.at(-1));
  const partialRunning = !sameLoad(topLoad, baseLoad);

  // Ziel-Wdh. je Satz: vom letzten Mal, fehlende Sätze wie der letzte
  const lastReps = intense.map((set) => set.reps ?? repMin);
  const repsAt = (i) => lastReps[Math.min(i, lastReps.length - 1)];
  const weakestPlusOne = () => {
    const targets = Array.from({ length: intenseCount }, (_, i) => repsAt(i));
    if (targets.length) {
      const weakest = targets.indexOf(Math.min(...targets));
      targets[weakest] += 1;
    }
    return targets;
  };

  let intenseLoads = [];
  let intenseTargets = [];
  let reason;
  let strategyUsed = null;

  if (partialRunning) {
    // Teilsprung läuft: Sätze mit neuer Last, die die Untergrenze schaffen, bekommen einen Nachfolger
    const newSets = intense.filter((set) => sameLoad(loadOf(set), topLoad));
    const held = newSets.every((set) => (set.reps ?? 0) >= repMin);
    const newCount = Math.min(intenseCount, newSets.length + (held ? 1 : 0));
    intenseLoads = Array.from({ length: intenseCount }, (_, i) => (i < newCount ? topLoad : baseLoad));
    intenseTargets = Array.from({ length: intenseCount }, (_, i) => (i < newCount ? Math.max(repMin, held ? repMin : repsAt(i)) : repsAt(i)));
    strategyUsed = 'partial';
    reason = newCount >= intenseCount
      ? `Teilsprung geschafft → alle Sätze mit ${describeLoad(topLoad, exercise)}`
      : held
        ? `Teilsprung: ${newCount} von ${intenseCount} Sätzen mit ${describeLoad(topLoad, exercise)}`
        : `Teilsprung: ${describeLoad(topLoad, exercise)} noch unter ${repMin} Wdh. → ${newCount} Satz halten`;
  } else if (bestReps(intense) < repMin) {
    const fails = consecutiveFails(history, exercise, settings);
    if (fails >= settings.dropAfterFails) {
      const lighter = shiftLoad(topLoad, exercise, -1, settings) ?? topLoad;
      intenseLoads = Array(intenseCount).fill(lighter);
      intenseTargets = Array(intenseCount).fill(repMin);
      reason = `${fails}× unter ${repMin} Wdh. → eine Stufe leichter (${describeLoad(lighter, exercise)})`;
    } else {
      intenseLoads = Array(intenseCount).fill(topLoad);
      intenseTargets = weakestPlusOne();
      reason = `Unter ${repMin} Wdh. → ${describeLoad(topLoad, exercise)} halten`;
    }
  } else if (intense.every((set) => (set.reps ?? 0) >= repMax)) {
    // Obergrenze in allen Intensivsätzen erreicht → steigern, Sprung-Strategie beachten
    const stepKg = isLevelBased(exercise) ? null : exercise.steps?.step;
    const { strategy, reps: jumpReps } = jumpStrategy(stepKg, e1rm, settings);
    strategyUsed = strategy;
    const reportedRir = Math.max(...intense.map((set) => set.rir ?? settings.defaultRIR));
    const double = effects.allowDouble && strategy === 'normal' && reportedRir >= settings.intenseRIR + settings.doubleStepRIR;
    const extendGoal = repMax + settings.extendReps;
    const heavier = shiftLoad(topLoad, exercise, double ? 2 : 1, settings);
    const canIncrease = heavier && !sameLoad(heavier, topLoad);

    if (!canIncrease) {
      intenseLoads = Array(intenseCount).fill(topLoad);
      intenseTargets = weakestPlusOne();
      reason = exercise.type === 'band' && !exercise.steps?.levels?.length
        ? 'gleiches Band halten, +1 Wdh. (Bandstärken in der Übung eintragen)'
        : 'Schwerste Stufe erreicht → Wdh. steigern';
    } else if (strategy === 'extend' && !intense.every((set) => (set.reps ?? 0) >= extendGoal)) {
      intenseLoads = Array(intenseCount).fill(topLoad);
      intenseTargets = Array.from({ length: intenseCount }, (_, i) => Math.min(extendGoal, repsAt(i) + 1));
      reason = `Großer Sprung (≈ ${fmt(jumpReps)} Wdh.) → erst bis ${extendGoal} Wdh. sammeln`;
    } else if (strategy === 'partial') {
      intenseLoads = Array.from({ length: intenseCount }, (_, i) => (i === 0 ? heavier : topLoad));
      intenseTargets = Array.from({ length: intenseCount }, (_, i) => (i === 0 ? repMin : repsAt(i)));
      reason = `Großer Sprung (≈ ${fmt(jumpReps)} Wdh.) → Teilsprung: 1 Satz mit ${describeLoad(heavier, exercise)}`;
    } else {
      intenseLoads = Array(intenseCount).fill(heavier);
      intenseTargets = Array(intenseCount).fill(repMin);
      reason = double
        ? `${repMax} Wdh. mit RIR ${reportedRir} → zwei Stufen: ${describeLoad(heavier, exercise)}`
        : `${strategy === 'extend' ? extendGoal : repMax} Wdh. erreicht → ${describeLoad(heavier, exercise)}`;
    }
  } else {
    intenseLoads = Array(intenseCount).fill(topLoad);
    intenseTargets = weakestPlusOne();
    reason = `${describeLoad(topLoad, exercise)} halten, +1 Wdh. im schwächsten Satz`;
  }

  // ---- Volumensatz ----
  const { min: volMin, max: volMax } = settings.volumeRange;
  const lastVolume = mains(last.sets).filter((set) => set.setType === 'volume').at(-1);
  let volumeSet = null;
  if (lastVolume) {
    const load = loadOf(lastVolume);
    if ((lastVolume.reps ?? 0) >= volMax) {
      const up = shiftLoad(load, exercise, 1, settings);
      volumeSet = { load: up ?? load, reps: up && !sameLoad(up, load) ? volMin : (lastVolume.reps ?? volMin) + 1 };
      if (up && !sameLoad(up, load)) notes.push(`Volumensatz ${volMax} Wdh. → ${describeLoad(up, exercise)}`);
    } else {
      volumeSet = { load, reps: (lastVolume.reps ?? volMin - 1) + 1 };
    }
  } else if (exercise.type === 'weight' && e1rm) {
    // Kein Volumensatz beim letzten Mal: Last für volMin Wdh. aus dem 1RM schätzen
    volumeSet = { load: { weight: roundToStep(e1rm / (1 + volMin / 30), exercise.steps, 'down') }, reps: volMin };
  } else {
    const easier = shiftLoad(intenseLoads[0] ?? topLoad, exercise, -1, settings);
    if (easier) volumeSet = { load: easier, reps: volMin };
  }

  // ---- Aufwärmsatz (Pflicht nur bei der ersten Übung je Muskelgruppe) ----
  let warmupSet = null;
  if (isFirstInGroup) {
    const reference = intenseLoads[0] ?? volumeSet?.load ?? topLoad;
    let warmLoad;
    if (exercise.type === 'weight' && reference.weight != null) {
      warmLoad = { weight: roundToStep(reference.weight * settings.warmupPct / 100, exercise.steps, 'nearest') };
    } else if (exercise.type === 'bodyweight') {
      warmLoad = { weight: 0 };
    } else {
      warmLoad = shiftLoad(reference, exercise, -2, settings) ?? reference;
    }
    // Aufwärmen nie schwerer als der Volumensatz
    if (volumeSet && (loadRank(warmLoad, exercise) ?? -Infinity) > (loadRank(volumeSet.load, exercise) ?? Infinity)) warmLoad = volumeSet.load;
    const lastWarmup = mains(last.sets).find((set) => set.setType === 'warmup');
    warmupSet = { load: warmLoad, reps: lastWarmup?.reps ?? volMax };
  }

  // ---- Tagesform: Last verringern ----
  const reduce = (load) => reduceLoad(load, exercise, effects.loadReductionPct, settings);
  const sets = [];
  if (warmupSet) sets.push({ setType: 'warmup', load: warmupSet.load, reps: warmupSet.reps, rir: null });
  // „1 Satz weniger pro Übung“ trifft bei krankheitsbedingt 0 Intensivsätzen den Volumensatz nicht
  if (volumeSet) sets.push({ setType: 'volume', load: reduce(volumeSet.load), reps: volumeSet.reps, rir: volumeRir });
  intenseLoads.forEach((load, i) => sets.push({ setType: 'intense', load: reduce(load), reps: intenseTargets[i], rir: intenseRir }));

  if (effects.loadReductionPct && exercise.type === 'weight' && warmupSet) sets[0].load = reduce(sets[0].load);
  if (effects.noIntense) reason = 'Heute nur Aufwärm- und Volumensatz';

  return finish(sets, [reason, ...notes].join(' · '), { strategy: strategyUsed, e1rm });

  function finish(resultSets, text, extra = {}) {
    const reasonText = [text, ...effects.labels].filter(Boolean).join(' · ');
    return {
      sets: resultSets,
      reason: reasonText,
      uncertain: !sameContext,
      reduced: effects.reduced,
      ...extra,
    };
  }
}
