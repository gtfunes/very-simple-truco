const STORAGE_KEY = 'truco:v1';
const TARGETS = [15, 30];
const DEFAULT_TARGET = 30;
// In a game to 30, the first 15 points are the «malas» and the next 15 the «buenas».
const MALAS = 15;
const BOX_SIZE = 5;
const DEFAULT_NAMES = ['Nosotros', 'Ellos'];
const NAME_MAX = 20;
const LOG_MAX = 200;
const MAX_GAMES = 999;
const SVG_NS = 'http://www.w3.org/2000/svg';
// The five matches of a box, in the order they are drawn: left, top, right, bottom, then the diagonal.
// Each one is a stick from (x1, y1) to (x2, y2) with its head at (hx, hy), on a 512 × 512 grid.
const MATCHES = [
  { x1: 136, y1: 392, x2: 136, y2: 128, hx: 136, hy: 122 },
  { x1: 120, y1: 136, x2: 384, y2: 136, hx: 390, hy: 136 },
  { x1: 376, y1: 120, x2: 376, y2: 384, hx: 376, hy: 390 },
  { x1: 392, y1: 376, x2: 128, y2: 376, hx: 122, hy: 376 },
  { x1: 168, y1: 344, x2: 328, y2: 184, hx: 332, hy: 180 },
];

const els = {
  undo: document.getElementById('undo'),
  banner: document.getElementById('banner'),
  next: document.getElementById('next'),
  status: document.getElementById('status'),
  board: document.getElementById('board'),
  target: document.getElementById('target'),
  reset: document.getElementById('reset'),
  clearGames: document.getElementById('clear-games'),
  actions: document.getElementById('actions'),
};
// Per team: els.teams[0] is the left column and the left half of the bar.
els.teams = [0, 1].map((i) => ({
  name: document.getElementById(`name-${i}`),
  games: document.getElementById(`games-${i}`),
  points: document.getElementById(`points-${i}`),
  stage: document.getElementById(`stage-${i}`),
  tally: document.getElementById(`tally-${i}`),
  minus: document.getElementById(`minus-${i}`),
  plus1: document.getElementById(`plus1-${i}`),
  plus2: document.getElementById(`plus2-${i}`),
  plus3: document.getElementById(`plus3-${i}`),
}));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let state = load();
// matchEls[team][box][match]
let matchEls = [];
let wakeLock = null;
let wakeLockPending = false;

// --- State -----------------------------------------------------------------

// A declaration, not a const: load() runs above, while the script is still being read.
function isPoints(value, target) {
  return Number.isInteger(value) && value >= 0 && value <= target;
}

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !TARGETS.includes(saved.target) || !Array.isArray(saved.teams) || saved.teams.length !== 2) {
      return null;
    }
    const { target } = saved;
    const teams = saved.teams.map((team) => ({
      name: typeof team?.name === 'string' ? team.name.slice(0, NAME_MAX) : '',
      points: isPoints(team?.points, target) ? team.points : 0,
      games: Number.isInteger(team?.games) && team.games >= 0 ? Math.min(team.games, MAX_GAMES) : 0,
    }));
    // Each undo step: which team, and its points before and after.
    const log = (Array.isArray(saved.log) ? saved.log : [])
      .filter((entry) => [0, 1].includes(entry?.team) && isPoints(entry.before, target) && isPoints(entry.after, target))
      .map(({ team, before, after }) => ({ team, before, after }))
      .slice(-LOG_MAX);
    return { target, teams, log };
  } catch {
    // Storage blocked or corrupt.
  }
  return null;
}

function load() {
  return (
    readSaved() ?? {
      target: DEFAULT_TARGET,
      teams: DEFAULT_NAMES.map(() => ({ name: '', points: 0, games: 0 })),
      log: [],
    }
  );
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the game still works, it just won't survive a reload.
  }
}

// Another tab with the same game may have scored; adopt its state so both show the same points.
function syncFromStorage() {
  const saved = readSaved();
  if (!saved) return;
  const targetChanged = saved.target !== state.target;
  state = saved;
  if (targetChanged) buildTally();
  render();
}

// --- Game ------------------------------------------------------------------

const teamName = (index) => state.teams[index].name.trim() || DEFAULT_NAMES[index];
const hasPoints = () => state.teams.some((team) => team.points > 0);
const winnerIndex = () => state.teams.findIndex((team) => team.points >= state.target);
const inMalas = (points) => state.target > MALAS && points < MALAS;

// The falta envido, as most of Argentina plays it: with both teams in the malas it wins the game;
// otherwise it is worth what the leading team still needs to reach the end.
function faltaText() {
  if (state.teams.every((team) => inMalas(team.points))) return 'La falta envido gana el partido';
  const leader = Math.max(...state.teams.map((team) => team.points));
  const value = state.target - leader;
  return `La falta envido vale ${value} ${value === 1 ? 'punto' : 'puntos'}`;
}

function addPoints(index, delta) {
  const team = state.teams[index];
  if (winnerIndex() !== -1 && delta > 0) return;
  const before = team.points;
  const after = Math.min(state.target, Math.max(0, before + delta));
  if (after === before) return;
  team.points = after;
  state.log.push({ team: index, before, after });
  if (state.log.length > LOG_MAX) state.log.shift();
  save();
  render();
  keepAwake();
  const won = winnerIndex() !== -1;
  navigator.vibrate?.(won ? [40, 80, 160] : 20);
  if (!reducedMotion.matches) {
    els.teams[index].points.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], {
      duration: 220,
      easing: 'ease-out',
    });
  }
}

function undoLast() {
  const entry = state.log.at(-1);
  if (!entry) return;
  const delta = entry.after - entry.before;
  const change = delta > 0 ? `+${delta}` : `−${-delta}`;
  if (!window.confirm(`¿Deshacer «${teamName(entry.team)}: ${change}»?`)) return;
  state.log.pop();
  state.teams[entry.team].points = entry.before;
  save();
  render();
}

// The win of a finished game counts here, when the next one starts, so an undo
// right after the last point never leaves a phantom win behind.
function newGame(target = state.target) {
  const winner = winnerIndex();
  if (winner !== -1) state.teams[winner].games = Math.min(MAX_GAMES, state.teams[winner].games + 1);
  state.teams.forEach((team) => {
    team.points = 0;
  });
  state.log = [];
  const targetChanged = target !== state.target;
  state.target = target;
  save();
  if (targetChanged) buildTally();
  render();
}

// Small words that do not make an initial: "Facundo y Valentina" → "FV".
const LINK_WORDS = new Set(['y', 'e', 'de', 'del', 'el', 'la', 'los', 'las']);

// "Facundo y Valentina" → "FV", "Nosotros" → "No".
function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  const main = words.filter((word) => !LINK_WORDS.has(word.toLowerCase()));
  const picked = main.length ? main : words;
  if (picked.length > 1) return picked.slice(0, 2).map((word) => [...word][0].toUpperCase()).join('');
  const [first = '', second = ''] = [...(picked[0] ?? '')];
  return first.toUpperCase() + second;
}

// A name too long for its column shows as initials instead of being cut off; the banner keeps it whole.
function fitNames() {
  els.teams.forEach((ui, index) => {
    const name = teamName(index);
    ui.name.textContent = name;
    if (ui.name.scrollWidth > ui.name.clientWidth) ui.name.textContent = initials(name);
  });
}

function renameTeam(index) {
  const name = window.prompt(`Nombre del equipo (${DEFAULT_NAMES[index]})`, state.teams[index].name);
  if (name === null) return;
  state.teams[index].name = name.trim().slice(0, NAME_MAX);
  save();
  render();
}

// --- Screen wake lock --------------------------------------------------------
// The phone sits on the table between hands, so keep it from locking.

async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || wakeLockPending) return;
  wakeLockPending = true;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Denied (for example, battery saver): the screen may dim, nothing else breaks.
  } finally {
    wakeLockPending = false;
  }
}

// --- Rendering -------------------------------------------------------------

function svgEl(name, attributes) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

// One box of five matches, drawn like the squares on a paper truco sheet.
function buildBox() {
  const svg = svgEl('svg', { viewBox: '0 0 512 512', class: 'box' });
  svg.append(svgEl('rect', { x: 128, y: 128, width: 256, height: 256, rx: 12, class: 'frame' }));
  const matches = MATCHES.map(({ x1, y1, x2, y2, hx, hy }) => {
    const g = svgEl('g', { class: 'match' });
    g.append(svgEl('line', { x1, y1, x2, y2, class: 'stick' }), svgEl('circle', { cx: hx, cy: hy, r: 22, class: 'head' }));
    svg.append(g);
    return g;
  });
  return { svg, matches };
}

// Runs when the length of the game changes; render() lights up the matches.
function buildTally() {
  const boxes = state.target / BOX_SIZE;
  els.board.dataset.boxes = String(boxes);
  matchEls = els.teams.map(({ tally }) => {
    const built = [];
    const children = [];
    for (let i = 0; i < boxes; i += 1) {
      if (state.target > MALAS && i === MALAS / BOX_SIZE) {
        const divider = document.createElement('p');
        divider.className = 'divider';
        divider.textContent = 'Buenas';
        children.push(divider);
      }
      const { svg, matches } = buildBox();
      children.push(svg);
      built.push(matches);
    }
    tally.replaceChildren(...children);
    return built;
  });
}

function render() {
  const winner = winnerIndex();
  const over = winner !== -1;
  const showGames = state.teams.some((team) => team.games > 0);

  state.teams.forEach((team, index) => {
    const ui = els.teams[index];
    const name = teamName(index);
    ui.name.setAttribute('aria-label', `${name}: cambiar el nombre`);
    ui.points.textContent = String(team.points);
    ui.points.classList.toggle('won', index === winner);
    ui.stage.textContent = state.target > MALAS ? (inMalas(team.points) ? 'Malas' : 'Buenas') : '';
    ui.stage.hidden = state.target <= MALAS;
    ui.stage.classList.toggle('buenas', !inMalas(team.points));
    ui.games.hidden = !showGames;
    ui.games.textContent = `🏆 ${team.games}`;
    ui.games.setAttribute('aria-label', `${team.games} ${team.games === 1 ? 'partido ganado' : 'partidos ganados'}`);
    matchEls[index].forEach((matches, box) => {
      const lit = Math.min(BOX_SIZE, Math.max(0, team.points - box * BOX_SIZE));
      matches.forEach((match, i) => match.classList.toggle('on', i < lit));
    });
    ui.minus.disabled = team.points === 0;
    [ui.plus1, ui.plus2, ui.plus3].forEach((button) => {
      button.disabled = over;
    });
    ui.minus.setAttribute('aria-label', `Restar 1 a ${name}`);
    ui.plus1.setAttribute('aria-label', `Sumar 1 a ${name}`);
    ui.plus2.setAttribute('aria-label', `Sumar 2 a ${name}`);
    ui.plus3.setAttribute('aria-label', `Sumar 3 a ${name}`);
  });

  if (over) {
    const loser = state.teams[1 - winner];
    els.banner.textContent = `¡Partido para ${teamName(winner)}! ${state.teams[winner].points} a ${loser.points}`;
    els.status.textContent = '';
  } else {
    els.status.textContent = faltaText();
  }
  els.banner.hidden = !over;
  els.next.hidden = !over;
  els.status.hidden = over;

  fitNames();
  els.undo.disabled = state.log.length === 0;
  els.target.value = String(state.target);
  els.reset.disabled = !hasPoints();
  els.clearGames.disabled = !showGames;
}

// --- Events ----------------------------------------------------------------

els.teams.forEach((ui, index) => {
  ui.name.addEventListener('click', () => renameTeam(index));
  ui.minus.addEventListener('click', () => addPoints(index, -1));
  ui.plus1.addEventListener('click', () => addPoints(index, 1));
  ui.plus2.addEventListener('click', () => addPoints(index, 2));
  ui.plus3.addEventListener('click', () => addPoints(index, 3));
});

els.undo.addEventListener('click', undoLast);
els.next.addEventListener('click', () => newGame());

els.reset.addEventListener('click', () => {
  if (hasPoints() && winnerIndex() === -1 && !window.confirm('¿Empezar un partido nuevo? Se borran los puntos de este.')) {
    return;
  }
  newGame();
});

els.clearGames.addEventListener('click', () => {
  if (!window.confirm('¿Borrar los partidos ganados de los dos equipos?')) return;
  state.teams.forEach((team) => {
    team.games = 0;
  });
  save();
  render();
});

els.target.addEventListener('change', () => {
  const target = Number(els.target.value);
  if (hasPoints() && winnerIndex() === -1 && !window.confirm('Cambiar el largo del partido empieza uno nuevo. ¿Seguimos?')) {
    els.target.value = String(state.target);
    return;
  }
  newGame(target);
});

// Ask for the wake lock on the first touch, so the screen stays on from the start.
document.addEventListener('pointerdown', keepAwake, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  syncFromStorage();
  if (hasPoints()) keepAwake();
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) syncFromStorage();
});

// Column widths change with the screen (rotation, split view), so check the names again.
new ResizeObserver(fitNames).observe(els.board);

// Keep the page padding in step with the real height of the bottom bar (large text, safe areas).
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--bar-height', `${els.actions.offsetHeight}px`);
}).observe(els.actions);

// Offline support for the deployed site. Skipped on localhost so it never caches other local dev servers.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

buildTally();
render();
