import {setRoomNavigation,fadeNavigation} from './room-navigation.js?v=fade-1';
import {createHouseRenderer} from './house-release-renderer.js?v=source-models-1';
import { readJournal, saveJournal, discoverNotes, validateHouseData } from './house-state.js';

const ROOMS = ['hallway', 'workshop', 'attic', 'basement', 'private-hall'];
const DOORS = { 'door-workshop': 'workshop', 'door-attic': 'attic', 'door-basement': 'basement', 'door-private-hall': 'private-hall' };
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

export async function createHouse({ onOpen = () => {}, onExit = () => {}, onRoomChange = () => {}, onCollectBonus = () => {}, getDen, ensureDen, unloadDen, loadBasementCartridges } = {}) {
  let exiting;
  let open = false, destroyed = false, room = 'hallway', roomTicket = 0;
  let data, manifest, view, travelling = false, contentRequest, discovered = new Set(), storage, persistence = true;
  let modalReturn, modalKind, journalOnly=false, revealing=false;
  try { storage = window.localStorage; } catch { persistence = false; }
  const root = el('section', 'house-overlay');
  root.hidden = true; root.inert = true; root.setAttribute('aria-label', 'Explore the house');
  const header = el('header', 'house-header');
  const back = button('', () => room === 'hallway' ? returnToDen() : enter('hallway'), 'house-back');
  back.style.opacity = '0';
  back.setAttribute('aria-label', 'Return to hallway');
  setRoomNavigation(back, 'Hallway', 'down');
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

  async function hideNavigation() {
    hotspots.inert = true; back.disabled = true; view?.setInteractive(false);
    await Promise.all([fadeNavigation(hotspots, false), fadeNavigation(back, false)]);
  }
  function showNavigation() {
    hotspots.inert = false; back.disabled = false;
    fadeNavigation(hotspots, true); fadeNavigation(back, true);
  }
  function resize() {
    if (!open) return;
    const rect = viewport.getBoundingClientRect();
    // Match the den's viewport so returning does not change the image crop.
    scene.style.width = `${rect.width}px`;
    scene.style.height = `${rect.height}px`;
    view?.resize();
  }
  function updateJournal() { journal.textContent = `Journal · ${discovered.size}`; }
  function closeModal() {
    if (journalOnly) { journalOnly=false; exit(); return; }
    shade.hidden = true; modalBody.replaceChildren(); modalKind = null;
    header.inert = viewport.inert = footer.inert = false;
    if (open && !travelling) view?.setActive(true);
    if (open && modalReturn?.isConnected && !modalReturn.closest('[hidden]')) modalReturn.focus();
  }
  function openModal(label, kind) {
    const wasOpen = !shade.hidden;
    if (!wasOpen) modalReturn = document.activeElement;
    modalKind = kind; modalTitle.textContent = label; close.textContent = '×'; close.setAttribute('aria-label','Dismiss paper');
    modalBody.replaceChildren(); shade.hidden = false;
    header.inert = viewport.inert = footer.inert = true;
    view?.setInteractive(false);
    dialog.classList.toggle('house-paper', kind === 'notes');
    dialog.classList.toggle('house-journal', kind === 'journal'); close.focus();
  }
  function noteCard(note, showTitle = true, discovery = false) {
    const card = el('article', 'house-note');
    if (showTitle) card.append(el('h3', '', note.title));
    for (const paragraph of note.body.split(/\n\s*\n/)) card.append(el('p', '', paragraph));
    if (note.kind === 'cartridge' && note.gameId) {
      card.append(el('p','house-discovery',discovery?'Cartridge found. It will drop onto the den table when you return. Insert it into the console to play.':'Cartridge collected. Insert it into the den console to play.'));
    }
    return card;
  }
  function showNotes(notes,cartridgeLabel) {
    const added = discoverNotes(discovered, notes);
    persistence = saveJournal(storage, discovered); updateJournal();
    for(const note of notes)if(note.kind==='cartridge')onCollectBonus(note.gameId);
    if (added) live.textContent = `${added === 1 ? 'A paper' : `${added} papers`} saved in your journal.`;
    openModal(notes.length === 1 ? notes[0].title : 'A few scraps', 'notes');

    if(cartridgeLabel){const cartridge=el('figure','house-found-cartridge'),image=el('img');image.src=cartridgeLabel;image.alt=`${notes.find(note=>note.kind==='cartridge')?.title??'Found'} cartridge`;cartridge.append(image);modalBody.append(cartridge);}
    notes.forEach(note => modalBody.append(noteCard(note, notes.length !== 1, true)));
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
        const origin=await view?.revealScrap(id,unread.find(note=>note.kind==='cartridge')?.gameId);
        if (!open || ticket!==roomTicket) return;
        dialog.style.setProperty('--paper-x',`${(origin?.x??50)-50}vw`);
        dialog.style.setProperty('--paper-y',`${(origin?.y??50)-50}vh`);
        showNotes(unread,origin?.cartridgeLabel);
      } catch { live.textContent='The discovery could not load. Please try that object again.'; }
      finally { revealing=false;if(open&&ticket===roomTicket&&shade.hidden)view?.setInteractive(true); }
      return;
    }
    const locked = data.lockedDoors.find(door => door.id === id);
    if (locked) { openModal(locked.title, 'notes'); modalBody.append(el('p', '', locked.body)); }
  }
  function hotspotLabel(id) {
    if (id === 'door-den') return 'Return to the den';
    if (id === 'door-private-hall') return 'Look left up the hallway';
    if (id === 'door-attic') return 'Open the attic hatch';
    if (DOORS[id]) return `Enter ${data.rooms.find(info => info.id === DOORS[id]).title}`;
    return data.notes.find(note => note.room === room && note.hotspot === id)?.title
      ?? data.lockedDoors.find(door => door.id === id)?.title;
  }
  async function content() {
    if (data) return;
    contentRequest ??= Promise.all([json('/data/house-notes.json?v=bitey-1'), json('/web/assets/house/hotspots.json?v=bitey-1')])
      .then(([notes, objects]) => {
        objects['private-hall']=[];
        const validData = validateHouseData(notes);
        validData.rooms.push({id:'private-hall',title:'Rear hall'});
        objects.hallway=objects.hallway.filter(o=>!o.id.startsWith('locked-door')&&o.id!=='door-den');
        objects.hallway.push({id:'door-private-hall',x:.01,y:.4,width:.06,height:.2});
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
        data = validData; manifest = objects;
        discovered = readJournal(storage, data.notes.map(note => note.id)); updateJournal();
      }).catch(error => { contentRequest = null; throw error; });
    return contentRequest;
  }
  async function enter(destination = 'hallway', doorId) {
    if (destroyed || travelling || exiting) return;
    if (!ROOMS.includes(destination)) destination = 'hallway';
    closeModal();
    const wasOpen = open;
    open = true; root.hidden = false; root.inert = false;
    if (!wasOpen) onOpen();
    const ticket = ++roomTicket;
    travelling = true;
    const fading = hideNavigation();
    loading.hidden = wasOpen; loading.classList.toggle('house-loading-transition', wasOpen);
    loading.replaceChildren(el('p', '', 'Opening the door…')); resize();
    try {
      await fading;
      if (!open || ticket !== roomTicket) return;
      hotspots.replaceChildren();
      await content();
      if (!open || ticket !== roomTicket) return;
      view ??= createHouseRenderer(scene,{onActivate:activate,getDen,ensureDen,unloadDen,loadBasementCartridges,collected:new Set(data.notes.filter(note=>data.notes.filter(n=>n.hotspot===note.hotspot).every(n=>discovered.has(n.id))).map(note=>note.hotspot))});
      await view.load(destination);
      if (!open || ticket !== roomTicket) return;
      await view.travel(destination, () => { loading.hidden = true; });
      if (!open || ticket !== roomTicket) return;
      room = destination;
      back.classList.toggle('house-back-down', room !== 'hallway');
      setRoomNavigation(back, room === 'hallway' ? 'Den' : 'Hallway', room === 'hallway' ? 'right' : 'down');
      back.classList.toggle('house-back-den',room==='hallway');
      back.setAttribute('aria-label', room === 'hallway' ? 'Return to den' : 'Return to hallway');
      const info = data.rooms.find(info => info.id === destination);
      title.textContent = info.title;
      const targetButtons = new Map();
      for (const object of manifest[destination]) {
        const label = hotspotLabel(object.id); if (!label) continue;
        const hit = button('', () => activate(object.id), 'house-hotspot');
        hit.setAttribute('aria-label', label);
        if (DOORS[object.id] || object.id === 'door-den') {
          const destination = DOORS[object.id];
          const name = destination ? data.rooms.find(info => info.id === destination).title : 'Den';
          const direction = object.id === 'door-private-hall' ? 'left' : object.id === 'door-attic' ? 'up' : object.id === 'door-workshop' ? 'up-left' : 'up-right';
          hit.classList.add('house-door-navigation');
          if (object.id === 'door-private-hall') hit.classList.add('house-hall-direction');
          setRoomNavigation(hit, name, direction);
        } else hit.append(el('span', 'house-hotspot-label', label));
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
    } catch (error) {
      console.error('House entry failed',error);
      if (!open || ticket !== roomTicket) return;
      loading.hidden = false;
      loading.replaceChildren(el('p', '', 'The door is sticking. This room could not load.'), button('Try again', () => enter(destination, doorId)), button('Return to den', exit));
      loading.querySelector('button')?.focus();
    } finally {
      if (ticket === roomTicket) { travelling = false; showNavigation(); view?.setActive(shade.hidden); }
    }
  }
  async function returnToDen() {
    if (travelling) return;
    travelling = true;
    const ticket = roomTicket;
    try {
      await hideNavigation();
      if (!open || ticket !== roomTicket) return;
      hotspots.replaceChildren();
      await view?.depart();
    }
    catch(error){console.error('Den travel failed',error);}
    finally { hotspots.inert = false; if (ticket === roomTicket) await exit(); }
  }
  function exit() {
    if(exiting)return exiting;
    if(!open)return Promise.resolve();
    journalOnly=false;root.classList.remove('house-journal-only');
    roomTicket++;shade.hidden=true;modalBody.replaceChildren();open=false;
    header.inert=viewport.inert=footer.inert=false;
    fadeNavigation(hotspots,false);fadeNavigation(back,false);hotspots.replaceChildren();
    travelling=true;
    const oldView=view;view=null;
    exiting=(async()=>{
      await oldView?.dispose();
      await ensureDen?.();
      root.hidden=true;root.inert=true;travelling=false;back.disabled=false;onExit();
    })().catch(error=>{
      open=true;travelling=false;loading.hidden=false;
      loading.replaceChildren(el('p','','The den could not load.'),button('Try again',()=>exit()));
      console.error('Den return failed',error);
    }).finally(()=>{exiting=null;});
    return exiting;
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
    exit(); destroyed = true; roomTicket++;
    document.removeEventListener('keydown', keydown, true); window.removeEventListener('resize', resize); view?.dispose(); root.remove();
  } };
}
