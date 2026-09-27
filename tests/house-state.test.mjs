import test from 'node:test';
import assert from 'node:assert/strict';
import { readJournal, saveJournal, discoverNotes, JOURNAL_KEY } from '../web/house-state.js';

test('journal persists discoveries, deduplicates, and drops unknown or corrupt IDs', () => {
  let saved;
  const storage = { getItem: key => key === JOURNAL_KEY ? saved : null, setItem: (_key, value) => { saved = value; } };
  const discovered = new Set();
  assert.equal(discoverNotes(discovered, [{id:'a'}, {id:'b'}, {id:'a'}]), 2);
  assert.equal(discoverNotes(discovered, [{id:'a'}]), 0);
  assert.equal(saveJournal(storage, discovered), true);
  assert.deepEqual([...readJournal(storage, ['a', 'b'])], ['a', 'b']);
  saved = JSON.stringify({version:1, ids:['a', 'unknown', 1, 'a', null]});
  assert.deepEqual([...readJournal(storage, ['a'])], ['a']);
  for (const bad of ['{', 'null', '[]', '{"version":2,"ids":["a"]}', '{"version":1,"ids":"a"}']) {
    saved = bad;
    assert.equal(readJournal(storage, ['a']).size, 0);
  }
});

test('blocked localStorage leaves an in-memory journal usable', () => {
  const storage = { getItem(){throw new Error('blocked');}, setItem(){throw new Error('full');} };
  const discovered = readJournal(storage, ['a']);
  discoverNotes(discovered, [{id:'a'}]);
  assert.equal(saveJournal(storage, discovered), false);
  assert.deepEqual([...discovered], ['a']);
});
