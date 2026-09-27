export const JOURNAL_KEY = 'jiggmin.house.journal.v1';

// Only known IDs survive an old save, malformed data, or changed house content.
export function readJournal(storage, validIds) {
  const valid = new Set(validIds);
  try {
    const saved = JSON.parse(storage?.getItem(JOURNAL_KEY) ?? 'null');
    if (saved?.version !== 1 || !Array.isArray(saved.ids)) return new Set();
    return new Set(saved.ids.filter(id => typeof id === 'string' && valid.has(id)));
  } catch { return new Set(); }
}

export function saveJournal(storage, discovered) {
  try {
    storage?.setItem(JOURNAL_KEY, JSON.stringify({ version: 1, ids: [...discovered] }));
    return Boolean(storage);
  } catch { return false; }
}

export function discoverNotes(discovered, notes) {
  let added = 0;
  for (const note of notes) {
    if (!discovered.has(note.id)) { discovered.add(note.id); added++; }
  }
  return added;
}

export function validateHouseData(data) {
  if (!data || !Array.isArray(data.rooms) || !Array.isArray(data.notes) || !Array.isArray(data.lockedDoors)) {
    throw new Error('The house notes could not be read.');
  }
  const roomIds = new Set(['hallway', 'workshop', 'attic', 'basement']);
  const seen = new Set();
  for (const note of data.notes) {
    if (!note || typeof note.id !== 'string' || seen.has(note.id) || !roomIds.has(note.room)
      || typeof note.hotspot !== 'string' || typeof note.title !== 'string' || typeof note.body !== 'string'
      || !['note', 'cartridge'].includes(note.kind)
      || (note.gameId !== undefined && typeof note.gameId !== 'string')) {
      throw new Error('The house notes could not be read.');
    }
    seen.add(note.id);
  }
  for (const id of roomIds) {
    if (!data.rooms.some(room => room?.id === id && typeof room.title === 'string')) {
      throw new Error('A room description is missing.');
    }
  }
  for (const door of data.lockedDoors) {
    if (!door || typeof door.id !== 'string' || typeof door.title !== 'string' || typeof door.body !== 'string') {
      throw new Error('A door description could not be read.');
    }
  }
  return data;
}
