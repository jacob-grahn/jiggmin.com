// Shared, always-visible room navigation. The parent button owns the tap area.
export function setRoomNavigation(button, label, direction) {
  button.classList.add('room-navigation');
  button.dataset.direction = direction;
  const circle = document.createElement('span');
  circle.className = 'room-navigation-circle';
  circle.setAttribute('aria-hidden', 'true');
  const chevron = document.createElement('span');
  chevron.className = 'room-navigation-chevron';
  circle.append(chevron);
  const name = document.createElement('span');
  name.className = 'room-navigation-label';
  name.textContent = label;
  button.replaceChildren(circle, name);
}

const fades = new WeakMap();
export function fadeNavigation(node, visible) {
  const opacity = visible ? '1' : '0';
  const previous = fades.get(node);
  if (previous?.opacity === opacity) return previous.finished;
  const from = getComputedStyle(node).opacity;
  previous?.animation.cancel();
  node.style.opacity = opacity;
  const duration = from === opacity || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000;
  const animation = node.animate([{opacity: from}, {opacity}], {duration, easing: 'ease-in-out'});
  const finished = animation.finished.catch(() => {});
  fades.set(node, {opacity, animation, finished});
  return finished;
}
