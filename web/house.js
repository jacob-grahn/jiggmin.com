import {createHouseRenderer} from './house-renderer.js?v=house-ink-4';
import { readJournal, saveJournal, discoverNotes, validateHouseData } from './house-state.js';

export const HOUSE_MEDIA_QUERY = '(min-width: 1000px) and (min-aspect-ratio: 69/50) and (pointer: fine)';
const ROOMS = ['hallway', 'workshop', 'attic', 'basement'];
const DOORS = { 'door-workshop': 'workshop', 'door-attic': 'attic', 'door-basement': 'basement' };
const focusable = 'button:not(:disabled),a[href],input,[tabindex="0"],ruffle-player,iframe';
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, className = '') {
  const node = el('button', className, text);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
async function json(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('This part of the house could not load.');
  return response.json();
}

export async function createHouse({ onOpen = () => {}, onExit = () => {}, onRoomChange = () => {}, getDen } = {}) {
  let open = false, destroyed = false, room = 'hallway', roomTicket = 0, playTicket = 0;
  let data, manifest, anchors, view, travelling = false, contentRequest, discovered = new Set(), storage, persistence = true;
  let player, playAbort, modalReturn, modalKind, bonusRequest, journalOnly=false, revealing=false;
  try { storage = window.localStorage; } catch { persistence = false; }
  const media = window.matchMedia(HOUSE_MEDIA_QUERY);
  const root = el('section', 'house-overlay');
  root.hidden = true; root.inert = true; root.setAttribute('aria-label', 'Explore the house');
  const header = el('header', 'house-header');
  const back = button('‹', () => room === 'hallway' ? returnToDen() : enter('hallway'), 'house-back');
  back.setAttribute('aria-label', 'Return to hallway');
  const heading = el('div', 'house-heading');
  const kicker = el('p', 'house-kicker');
  const title = el('h1', '', 'The house'); title.tabIndex = -1;
  heading.append(kicker, title);
  const journal = button('Journal · 0', showJournal);
  header.append(back, heading);
  const viewport = el('div', 'house-viewport');
  const scene = el('div', 'house-scene');
  const hotspots = el('div', 'house-hotspots');
  const loading = el('div', 'house-loading'); loading.setAttribute('role', 'status');
  scene.append(hotspots, loading); viewport.append(scene);
  const footer = el('div', 'house-footer');
  const description = el('p', 'house-description');
  footer.append(description);
  const live = el('p', 'house-sr'); live.setAttribute('role', 'status');
  const shade = el('div', 'house-modal-shade'); shade.hidden = true;
  const dialog = el('section', 'house-dialog'); dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'house-dialog-title');
  dialog.tabIndex = -1;
  const modalHeader = el('div', 'house-dialog-header');
  const modalTitle = el('h2'); modalTitle.id = 'house-dialog-title';
  const close = button('×', closeModal); close.setAttribute('aria-label','Dismiss paper');
  const modalBody = el('div', 'house-dialog-body');
  modalHeader.append(modalTitle, close); dialog.append(modalHeader, modalBody); shade.append(dialog);
  root.append(header, viewport, footer, live, shade); document.body.append(root);

  function resize() {
    if (!open) return;
    stopPlayer();
    if (modalKind === 'game') closeModal();
    if (!media.matches && !journalOnly) { exit(); return; }
    const rect = viewport.getBoundingClientRect();
    scene.style.width = `${Math.min(rect.width, rect.height * 1.6)}px`;
    view?.resize();
  }
  function updateJournal() { journal.textContent = `Journal · ${discovered.size}`; }
  function stopPlayer() {
    playTicket++; playAbort?.abort(); playAbort = null;
    if (player) { try { player.ruffle().suspend(); } catch {} player.remove(); player = null; }
  }
  function closeModal() {
    if (journalOnly) { journalOnly=false; exit(); return; }
    stopPlayer(); shade.hidden = true; modalBody.replaceChildren(); modalKind = null;
    header.inert = viewport.inert = footer.inert = false;
    if (open && !travelling) view?.setActive(true);
    if (open && modalReturn?.isConnected && !modalReturn.closest('[hidden]')) modalReturn.focus();
  }
  function openModal(label, kind) {
    const wasOpen = !shade.hidden;
    stopPlayer();
    if (!wasOpen) modalReturn = document.activeElement;
    modalKind = kind; modalTitle.textContent = label; close.textContent = '×'; close.setAttribute('aria-label',kind==='game'?'Eject cartridge':'Dismiss paper');
    modalBody.replaceChildren(); shade.hidden = false;
    header.inert = viewport.inert = footer.inert = true;
    view?.setInteractive(false);
    dialog.classList.toggle('house-dialog-game', kind === 'game');
    dialog.classList.toggle('house-paper', kind === 'notes');
    dialog.classList.toggle('house-journal', kind === 'journal'); close.focus();
  }
  function noteCard(note, showTitle = true) {
    const card = el('article', 'house-note');
    if (showTitle) card.append(el('h3', '', note.title));
    for (const paragraph of note.body.split(/\n\s*\n/)) card.append(el('p', '', paragraph));
    if (note.kind === 'cartridge' && note.gameId) {
      card.append(button('Play cartridge', () => play(note)));
    }
    return card;
  }
  function showNotes(notes) {
    const added = discoverNotes(discovered, notes);
    persistence = saveJournal(storage, discovered); updateJournal();
    if (added) live.textContent = `${added === 1 ? 'A paper' : `${added} papers`} saved in your journal.`;
    openModal(notes.length === 1 ? notes[0].title : 'A few scraps', 'notes');

    notes.forEach(note => modalBody.append(noteCard(note, notes.length !== 1)));
    if (!persistence) modalBody.append(el('p', 'house-save-notice', 'Your journal will stay with you for this visit. This browser could not save it for later.'));
  }
  function showJournal() {
    if (!data) return;
    openModal(`Journal · ${discovered.size}`, 'journal');
    if (!discovered.size) modalBody.append(el('p', '', 'Scraps found behind objects will be kept here.'));
    for (const roomInfo of data.rooms) {
      const found = data.notes.filter(note => note.room === roomInfo.id && discovered.has(note.id));
      if (!found.length) continue;
      modalBody.append(el('h3', 'house-journal-room', roomInfo.title));
      found.forEach(note => modalBody.append(noteCard(note)));
    }
    if (!persistence) modalBody.append(el('p', 'house-save-notice', 'Your journal is saved for this visit only.'));
  }
  async function activate(id) {
    if (travelling || revealing) return;
    if (id === 'door-den') { returnToDen(); return; }
    if (DOORS[id]) { enter(DOORS[id], id); return; }
    const notes = data.notes.filter(note => note.room === room && note.hotspot === id);
    if (notes.length) {
      const unread=notes.filter(note=>!discovered.has(note.id));
      if (!unread.length) return;
      revealing=true;view?.setInteractive(false);
      const ticket=roomTicket;
      try {
        const origin=await view?.revealScrap(id);
        if (!open || ticket!==roomTicket) return;
        dialog.style.setProperty('--paper-x',`${(origin?.x??50)-50}vw`);
        dialog.style.setProperty('--paper-y',`${(origin?.y??50)-50}vh`);
        showNotes(unread);
      } finally { revealing=false; }
      return;
    }
    const locked = data.lockedDoors.find(door => door.id === id);
    if (locked) { openModal(locked.title, 'notes'); modalBody.append(el('p', '', locked.body)); }
  }
  function hotspotLabel(id) {
    if (id === 'door-den') return 'Return to the den';
    if (id === 'door-attic') return 'Pull cord to the attic';
    if (DOORS[id]) return `Enter ${data.rooms.find(info => info.id === DOORS[id]).title}`;
    return data.notes.find(note => note.room === room && note.hotspot === id)?.title
      ?? data.lockedDoors.find(door => door.id === id)?.title;
  }
  async function content() {
    if (data) return;
    contentRequest ??= Promise.all([json('/data/house-notes.json?v=hall-landing-back-1'), json('/web/assets/house/hotspots.json?v=hall-landing-back-1'), json('/web/assets/house/anchors.json?v=hall-landing-back-1')])
      .then(([notes, objects, positions]) => {
        const validData = validateHouseData(notes);
        for (const id of ROOMS) {
          if (!Array.isArray(objects?.[id])) throw new Error('The objects in this room could not load.');
          for (const object of objects[id]) {
            if (!object || typeof object.id !== 'string' || !['x','y','width','height'].every(key => Number.isFinite(object[key]))
              || object.x < 0 || object.y < 0 || object.width <= 0 || object.height <= 0
              || object.x + object.width > 1.001 || object.y + object.height > 1.001) {
              throw new Error('The objects in this room could not load.');
            }
          }
        }
        data = validData; manifest = objects; anchors = positions;
        discovered = readJournal(storage, data.notes.map(note => note.id)); updateJournal();
      }).catch(error => { contentRequest = null; throw error; });
    return contentRequest;
  }
  async function enter(destination = 'hallway', doorId) {
    if (destroyed || travelling) return;
    if (!media.matches) { if (open) exit(); else onExit(); return; }
    if (!ROOMS.includes(destination)) destination = 'hallway';
    closeModal();
    const wasOpen = open, previous = room;
    open = true; root.hidden = false; root.inert = false;
    if (!wasOpen) onOpen();
    const ticket = ++roomTicket;
    travelling = true; back.disabled = true; hotspots.replaceChildren();
    loading.hidden = wasOpen; loading.classList.toggle('house-loading-transition', wasOpen);
    loading.replaceChildren(el('p', '', 'Opening the door…')); resize();
    try {
      await content();
      if (!open || ticket !== roomTicket) return;
      view ??= createHouseRenderer(scene,{onActivate:activate,getDen,collected:new Set(data.notes.filter(note=>data.notes.filter(n=>n.hotspot===note.hotspot).every(n=>discovered.has(n.id))).map(note=>note.hotspot))});
      await view.load(destination);
      if (!open || ticket !== roomTicket) return;
      loading.hidden = true;
      await view.travel(destination, doorId ? anchors[previous][doorId] : null, doorId, destination === 'hallway' ? anchors.hallway[`door-${wasOpen ? previous : 'den'}`] : null);
      if (!open || ticket !== roomTicket) return;
      room = destination;
      back.setAttribute('aria-label', room === 'hallway' ? 'Return to den' : 'Return to hallway');
      const info = data.rooms.find(info => info.id === destination);
      title.textContent = info.title;
      const targetButtons = new Map();
      for (const object of manifest[destination]) {
        const label = hotspotLabel(object.id); if (!label) continue;
        const hit = button('', () => activate(object.id), 'house-hotspot');
        hit.setAttribute('aria-label', label); hit.append(el('span', 'house-hotspot-label', label));
        Object.assign(hit.style, {left:`${object.x*100}%`,top:`${object.y*100}%`,width:`${object.width*100}%`,height:`${object.height*100}%`});
        hotspots.append(hit); targetButtons.set(object.id,hit);
      }
      const bindings = new Map();
      for (const [id,target] of view.fixedTargets) { const hit=targetButtons.get(id); if(hit)bindings.set(target,hit); }
      for (const prop of view.props) {
        let hit = prop.hotspot && targetButtons.get(prop.hotspot);
        if (!hit) {
          hit = button('', () => view.activateProp(prop), 'house-hotspot house-prop-target');
          hit.setAttribute('aria-label', `${prop.mode === 'throw' ? 'Toss' : 'Nudge'} ${prop.title}`);
          hotspots.append(hit);
        }
        hit.classList.add('house-prop-target');
        bindings.set(prop, hit);
      }
      view.bindTargets(bindings);
      title.focus(); onRoomChange(destination);
    } catch {
      if (!open || ticket !== roomTicket) return;
      loading.hidden = false;
      loading.replaceChildren(el('p', '', 'The door is sticking. This room could not load.'), button('Try again', () => enter(destination, doorId)), button('Return to den', exit));
      loading.querySelector('button')?.focus();
    } finally {
      if (ticket === roomTicket) { travelling = false; back.disabled = false; view?.setActive(shade.hidden); }
    }
  }
  async function play(note) {
    openModal(note.title, 'game');
    const status = el('p', 'house-game-status', 'Loading the cartridge…'); status.setAttribute('role', 'status');
    const stage = el('div', 'house-game-stage'); modalBody.append(status, stage);
    const ticket = playTicket; playAbort = new AbortController(); const signal = playAbort.signal;
    try {
      bonusRequest ??= json('/data/bonus-games.json').catch(error => { bonusRequest = null; throw error; });
      const bonus = await bonusRequest;
      if (ticket !== playTicket || !open) return;
      const game = bonus.games?.find(game => game.id === note.gameId);
      if (!game || typeof game.file !== 'string' || !/^games\/bonus\/[a-z0-9-]+\/game\.swf$/.test(game.file)) throw new Error('This cartridge is unavailable.');
      if (!window.RufflePlayer?.newest) throw new Error('The cartridge player could not start. Return to the den and try again.');
      const response = await fetch(`/${game.file}`, {signal});
      if (!response.ok) throw new Error('The cartridge could not load.');
      const bytes = await response.arrayBuffer();
      if (ticket !== playTicket || !open) return;
      const width = Number(game.embedWidth) || 700, height = Number(game.embedHeight) || 400;
      stage.style.aspectRatio = `${width}/${height}`;
      const active = window.RufflePlayer.newest().createPlayer(); active.tabIndex = 0; player = active; stage.append(active);
      await active.ruffle().load({data:bytes,swfFileName:`${game.id}.swf`,autoplay:'on',allowScriptAccess:false,allowNetworking:'internal',scale:'showAll',logLevel:'error'});
      if (ticket !== playTicket || !open) { try { active.ruffle().suspend(); } catch {} active.remove(); return; }
      status.textContent = 'Click inside the game to play. Eject returns to the room.';
    } catch (error) {
      if (ticket !== playTicket || !open || signal.aborted) return;
      stopPlayer(); status.textContent = error.message || 'The cartridge could not load.';
      modalBody.append(button('Try again', () => play(note)));
    }
  }
  async function returnToDen() {
    if (travelling) return;
    travelling = true; back.disabled = true; hotspots.inert = true;
    const ticket = roomTicket;
    try { await view?.depart(anchors?.hallway['door-den'], 'door-den'); }
    finally { hotspots.inert = false; if (ticket === roomTicket) exit(); }
  }
  function exit() {
    if (!open) return;
    journalOnly=false;root.classList.remove('house-journal-only');
    roomTicket++; closeModal(); open = false; root.hidden = true; root.inert = true;
    hotspots.replaceChildren(); view?.cancel(); travelling = false; back.disabled = false; onExit();
  }
  function keydown(event) {
    if (!open) return;
    if (event.key === 'Escape' && view?.cancelGrab()) { event.preventDefault(); event.stopPropagation(); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!shade.hidden) closeModal(); else if (!travelling && room !== 'hallway') enter('hallway'); else exit(); return; }
    if (shade.hidden || event.key !== 'Tab') return;
    const nodes = [...dialog.querySelectorAll(focusable)].filter(node => !node.closest('[hidden]'));
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }
  document.addEventListener('keydown', keydown, true);
  window.addEventListener('resize', resize);
  shade.addEventListener('click', event => { if (event.target === shade) closeModal(); });
  return { enter, exit, async openJournal() {
    await content();
    if (!open) { journalOnly=true;open=true;root.hidden=false;root.inert=false;root.classList.add('house-journal-only');onOpen(); }
    showJournal();
  }, get isOpen() { return open; }, destroy() {
    exit(); destroyed = true; roomTicket++; stopPlayer();
    document.removeEventListener('keydown', keydown, true); window.removeEventListener('resize', resize); view?.dispose(); root.remove();
  } };
}
