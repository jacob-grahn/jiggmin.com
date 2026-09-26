export function resolveRoute(pathname, games) {
  if (pathname === '/' || pathname === '/index.html') return {kind: 'home'};
  let slug;
  try { slug = decodeURIComponent(pathname.replace(/^\//, '').replace(/\/$/, '')); }
  catch { return {kind: 'missing'}; }
  const game = games.find(game => game.id === slug);
  return game ? {kind: 'game', game} : {kind: 'missing'};
}

export function writeGameUrl(id, location = window.location, history = window.history) {
  const path = id ? `/${encodeURIComponent(id)}` : '/';
  // Avoid duplicate history entries for an already-loaded game or cancelled drag.
  if (location.pathname.replace(/\/$/, '') === path.replace(/\/$/, '')) return;
  history.pushState(null, '', path + location.search + location.hash);
}
