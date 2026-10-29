// Muskelgruppen und Feinmuskeln (SPEC.md, Abschnitt 5)

export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Brust' },
  { id: 'shoulders', label: 'Schultern' },
  { id: 'arms', label: 'Arme' },
  { id: 'back', label: 'Rücken' },
  { id: 'legs', label: 'Beine' },
  { id: 'hips', label: 'Hüfte' },
  { id: 'calves', label: 'Waden' },
  { id: 'core', label: 'Core' },
];

export const MUSCLES = [
  { id: 'chest_upper', group: 'chest', label: 'Obere Brust' },
  { id: 'chest_mid', group: 'chest', label: 'Mittlere Brust' },
  { id: 'chest_lower', group: 'chest', label: 'Untere Brust' },
  { id: 'delt_front', group: 'shoulders', label: 'Vordere Schulter' },
  { id: 'delt_side', group: 'shoulders', label: 'Seitliche Schulter' },
  { id: 'delt_rear', group: 'shoulders', label: 'Hintere Schulter' },
  { id: 'lats', group: 'back', label: 'Lat' },
  { id: 'upper_back', group: 'back', label: 'Oberer Rücken / Rhomboiden' },
  { id: 'traps', group: 'back', label: 'Oberer Trapez' },
  { id: 'lower_back', group: 'back', label: 'Unterer Rücken' },
  { id: 'biceps', group: 'arms', label: 'Bizeps' },
  { id: 'triceps', group: 'arms', label: 'Trizeps' },
  { id: 'forearms', group: 'arms', label: 'Unterarm' },
  { id: 'quads', group: 'legs', label: 'Quadrizeps' },
  { id: 'hamstrings', group: 'legs', label: 'Beinbeuger' },
  { id: 'glutes', group: 'hips', label: 'Gesäß' },
  { id: 'glute_med', group: 'hips', label: 'Gesäß seitlich' },
  { id: 'hip_flexors', group: 'hips', label: 'Hüftbeuger' },
  { id: 'adductors', group: 'hips', label: 'Adduktoren' },
  { id: 'calves', group: 'calves', label: 'Waden' },
  { id: 'abs', group: 'core', label: 'Gerade Bauchmuskeln' },
  { id: 'obliques', group: 'core', label: 'Schräge Bauchmuskeln' },
  { id: 'deep_core', group: 'core', label: 'Tiefe Rumpfmuskulatur' },
];

export const groupLabel = (id) => MUSCLE_GROUPS.find((group) => group.id === id)?.label ?? id;
export const muscleLabel = (id) => MUSCLES.find((muscle) => muscle.id === id)?.label ?? id;
