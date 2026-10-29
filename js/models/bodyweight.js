import { getAll, put, remove, newId } from '../db.js';

// Alle Körpergewicht-Einträge, neueste zuerst
export async function listBodyweight() {
  const all = await getAll('bodyweight');
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export function addBodyweight({ date, kg }) {
  return put('bodyweight', { id: newId(), date, kg });
}

export function deleteBodyweight(id) {
  return remove('bodyweight', id);
}
