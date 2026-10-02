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
