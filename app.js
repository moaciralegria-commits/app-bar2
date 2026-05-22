// =========================================================
// Mesa Viva — embaralhador de bar
// =========================================================

const GRID_SIZE = 10;

const SHAPES = [
  { id: 'r2', name: '2 lugares', w: 1, h: 2, seats: 2 },
  { id: 's4', name: '4 lugares', w: 2, h: 2, seats: 4 },
  { id: 'r6', name: '6 lugares', w: 2, h: 3, seats: 6 },
  { id: 'r8', name: '8 lugares', w: 2, h: 4, seats: 8 },
  { id: 'b3', name: 'Bistrô 3', w: 1, h: 3, seats: 3 },
  { id: 'l5', name: 'Comprida 5', w: 1, h: 5, seats: 5 },
];

const ICEBREAKERS = [
  "Conte a história mais maluca que rolou com você num bar.",
  "Qual filme você assistiu mais vezes na vida?",
  "Se pudesse jantar com qualquer pessoa, viva ou morta, quem seria?",
  "Qual a viagem mais marcante que você já fez?",
  "Conte uma habilidade inusitada que você tem.",
  "Qual a comida mais estranha que você já provou?",
  "Se ganhasse na loteria amanhã, o que faria primeiro?",
  "Qual música você não admite gostar?",
  "Conte um momento que você passou muita vergonha.",
  "Qual a coisa mais corajosa que já fez?",
  "Se pudesse viver em qualquer época da história, qual seria?",
  "Qual mania sua ninguém aqui sabe?",
  "Qual o melhor conselho que você já recebeu?",
  "Se tivesse que escolher um superpoder, qual seria?",
  "Qual a coisa mais cara que comprou por impulso?",
  "Qual era seu sonho de criança? Realizou?",
  "Apresente a pessoa do lado contando algo legal sobre ela (mesmo que invente).",
  "Qual o show ao vivo mais marcante que você viu?",
  "Conte uma vez que você se perdeu e foi parar num lugar inesperado.",
  "Se fosse um drink, qual seria e por quê?",
  "Qual a maior gambiarra que você fez que deu certo?",
  "Conta um trauma de infância que hoje é piada.",
  "Qual seu maior medo bobo?",
  "Se fosse vereador da sua cidade, qual lei aprovaria primeiro?",
  "Qual hobby você fingiu ter para impressionar alguém?",
  "Conte a história de uma cicatriz sua.",
  "Qual o aplicativo do seu celular que mais te envergonha?",
  "Última coisa que pesquisou no Google antes de vir pra cá?",
  "Qual a tatuagem que você quase fez (e não fez)?",
  "Se sua vida virasse série, qual o nome do episódio piloto?",
];

const TIPS = [
  "Apresente quem chegou na mesa nova antes de qualquer outra conversa.",
  "Quem está há mais tempo na mesa puxa o assunto.",
  "Regra de ouro: nada de celular nos primeiros 5 min.",
  "Brinda primeiro, conversa depois.",
  "Se a conversa morrer, use a provocação acima.",
];

// =========================================================
// State
// =========================================================

const state = {
  participants: [],
  relations: [],                // [{ id, aId, bId, mode: 'together' | 'separate' }]
  tables: [],
  pairHistory: new Map(),       // "idA|idB" -> count
  currentAssignment: new Map(), // tableId -> [participantId, ...]
  round: 0,
  newPairsRound: 0,
  timerInterval: null,
  remainingSeconds: 0,
  paused: false,
  selectedShapeId: null,
  deleteMode: false,
};

const RELATION_PENALTY = 100000;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// =========================================================
// Setup screen
// =========================================================

const els = {
  list: document.getElementById('participants-list'),
  addForm: document.getElementById('add-participant'),
  nameInput: document.getElementById('participant-name'),
  toLayoutBtn: document.getElementById('to-layout'),

  relationsSection: document.getElementById('relations-section'),
  relationsList: document.getElementById('relations-list'),
  relA: document.getElementById('rel-a'),
  relB: document.getElementById('rel-b'),
  relMode: document.getElementById('rel-mode'),
  addRelationBtn: document.getElementById('add-relation-btn'),

  palette: document.getElementById('palette'),
  grid: document.getElementById('grid'),
  peopleCount: document.getElementById('people-count'),
  capacityCount: document.getElementById('capacity-count'),
  toSessionBtn: document.getElementById('to-session'),
  clearGridBtn: document.getElementById('clear-grid'),

  layoutView: document.getElementById('layout-view'),
  roundNum: document.getElementById('round-num'),
  roundInfo: document.getElementById('round-info'),
  timerEl: document.getElementById('timer'),
  icebreakerText: document.getElementById('icebreaker-text'),
  newIcebreakerBtn: document.getElementById('new-icebreaker'),
  newPairsEl: document.getElementById('new-pairs'),
  totalPairsEl: document.getElementById('total-pairs'),
  coverageEl: document.getElementById('coverage'),
  shuffleBtn: document.getElementById('shuffle-now'),
  pauseBtn: document.getElementById('toggle-pause'),
  endBtn: document.getElementById('end-session'),
  roundMinutes: document.getElementById('round-minutes'),
  soundOn: document.getElementById('sound-on'),
};

function renderParticipants() {
  els.list.innerHTML = '';
  els.list.classList.toggle('is-empty', state.participants.length === 0);

  if (state.participants.length > 0) {
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = `${state.participants.length} ${state.participants.length === 1 ? 'pessoa' : 'pessoas'}`;
    els.list.appendChild(count);
  }

  state.participants.forEach(p => {
    const li = document.createElement('li');
    li.textContent = p.name;
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.setAttribute('aria-label', `Remover ${p.name}`);
    x.addEventListener('click', () => {
      state.participants = state.participants.filter(it => it.id !== p.id);
      state.relations = state.relations.filter(r => r.aId !== p.id && r.bId !== p.id);
      renderParticipants();
    });
    li.appendChild(x);
    els.list.appendChild(li);
  });
  els.relationsSection.hidden = state.participants.length < 2;
  renderRelations();
}

function addNamesFromInput() {
  const raw = els.nameInput.value;
  if (!raw.trim()) return 0;
  const names = raw
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
  let added = 0;
  for (const name of names) {
    if (name.length > 30) continue;
    if (state.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) continue;
    state.participants.push({ id: uid(), name });
    added++;
  }
  els.nameInput.value = '';
  renderParticipants();
  return added;
}

function renderRelations() {
  // Selects
  const buildOptions = () =>
    '<option value="">—</option>' +
    state.participants
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join('');
  const opts = buildOptions();
  const prevA = els.relA.value;
  const prevB = els.relB.value;
  els.relA.innerHTML = opts;
  els.relB.innerHTML = opts;
  if (state.participants.some(p => p.id === prevA)) els.relA.value = prevA;
  if (state.participants.some(p => p.id === prevB)) els.relB.value = prevB;

  // List
  els.relationsList.innerHTML = '';
  state.relations.forEach(r => {
    const a = state.participants.find(p => p.id === r.aId);
    const b = state.participants.find(p => p.id === r.bId);
    if (!a || !b) return;
    const li = document.createElement('li');
    li.className = r.mode;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = r.mode === 'together' ? '💞' : '⚡';
    li.appendChild(icon);

    const names = document.createElement('span');
    names.className = 'names';
    names.textContent = `${a.name} ${r.mode === 'together' ? 'com' : 'longe de'} ${b.name}`;
    li.appendChild(names);

    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Remover vínculo');
    x.addEventListener('click', () => {
      state.relations = state.relations.filter(it => it.id !== r.id);
      renderRelations();
    });
    li.appendChild(x);
    els.relationsList.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

els.addRelationBtn.addEventListener('click', () => {
  const aId = els.relA.value;
  const bId = els.relB.value;
  const mode = els.relMode.value;
  if (!aId || !bId || aId === bId) return;
  const dup = state.relations.some(r =>
    (r.aId === aId && r.bId === bId) || (r.aId === bId && r.bId === aId)
  );
  if (dup) return;
  state.relations.push({ id: uid(), aId, bId, mode });
  els.relA.value = '';
  els.relB.value = '';
  renderRelations();
});

const ORIG_PLACEHOLDER = els.nameInput.placeholder;
els.nameInput.addEventListener('input', () => {
  els.nameInput.placeholder = ORIG_PLACEHOLDER;
});

els.addForm.addEventListener('submit', e => {
  e.preventDefault();
  addNamesFromInput();
  els.nameInput.focus();
});

// Auto-add anything still typed in the input when the user taps away.
// Handles the common case of "I typed a name but forgot to tap +".
els.nameInput.addEventListener('blur', () => {
  addNamesFromInput();
});

els.toLayoutBtn.addEventListener('click', () => {
  // Sweep up any pending text first
  if (els.nameInput.value.trim()) addNamesFromInput();
  if (state.participants.length < 2) {
    els.nameInput.focus();
    els.nameInput.classList.remove('shake');
    void els.nameInput.offsetWidth; // restart animation
    els.nameInput.classList.add('shake');
    els.nameInput.placeholder = 'Precisa de pelo menos 2 nomes…';
    return;
  }
  showScreen('screen-layout');
});

// =========================================================
// Layout editor
// =========================================================

function renderPalette() {
  els.palette.innerHTML = '';

  SHAPES.forEach(sh => {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.dataset.shapeId = sh.id;

    const shape = document.createElement('div');
    shape.className = 'shape';
    shape.style.gridTemplateColumns = `repeat(${sh.w}, 8px)`;
    for (let i = 0; i < sh.w * sh.h; i++) shape.appendChild(document.createElement('div'));
    item.appendChild(shape);

    const lbl = document.createElement('div');
    lbl.className = 'label';
    lbl.textContent = sh.name;
    item.appendChild(lbl);

    item.addEventListener('click', () => selectShape(sh.id));
    els.palette.appendChild(item);
  });

  // Delete tool
  const del = document.createElement('div');
  del.className = 'palette-item delete';
  del.innerHTML = `<div class="shape">🗑</div><div class="label">Apagar</div>`;
  del.addEventListener('click', () => selectShape('__delete__'));
  els.palette.appendChild(del);
}

function selectShape(id) {
  state.selectedShapeId = id === '__delete__' ? null : id;
  state.deleteMode = id === '__delete__';
  document.querySelectorAll('.palette-item').forEach(p => {
    const isThis = (p.dataset.shapeId === id) || (state.deleteMode && p.classList.contains('delete'));
    p.classList.toggle('selected', isThis);
  });
}

function shapeById(id) { return SHAPES.find(s => s.id === id); }

function isOverlap(x, y, w, h) {
  if (x + w > GRID_SIZE || y + h > GRID_SIZE) return true;
  return state.tables.some(t =>
    !(x + w <= t.x || t.x + t.w <= x || y + h <= t.y || t.y + t.h <= y)
  );
}

function renderGrid() {
  els.grid.innerHTML = '';
  els.grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  els.grid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

  const occupied = new Set();
  state.tables.forEach(t => {
    for (let dx = 0; dx < t.w; dx++)
      for (let dy = 0; dy < t.h; dy++)
        occupied.add(`${t.x + dx},${t.y + dy}`);
  });

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      if (!occupied.has(`${x},${y}`)) {
        cell.classList.add('tappable');
        cell.addEventListener('click', () => onCellTap(x, y));
      }
      els.grid.appendChild(cell);
    }
  }

  state.tables.forEach(t => {
    const block = document.createElement('div');
    block.className = 'table-block';
    if (state.deleteMode) block.classList.add('delete-mode');
    block.style.gridColumn = `${t.x + 1} / span ${t.w}`;
    block.style.gridRow = `${t.y + 1} / span ${t.h}`;
    block.textContent = `${t.seats}p`;
    block.addEventListener('click', e => {
      e.stopPropagation();
      if (state.deleteMode) {
        state.tables = state.tables.filter(it => it.id !== t.id);
        renderGrid();
        updateCapacity();
      }
    });
    els.grid.appendChild(block);
  });
}

function onCellTap(x, y) {
  if (state.deleteMode || !state.selectedShapeId) return;
  const sh = shapeById(state.selectedShapeId);
  if (!sh) return;
  if (isOverlap(x, y, sh.w, sh.h)) return;
  state.tables.push({ id: uid(), x, y, w: sh.w, h: sh.h, seats: sh.seats });
  renderGrid();
  updateCapacity();
}

function updateCapacity() {
  const cap = state.tables.reduce((s, t) => s + t.seats, 0);
  els.peopleCount.textContent = state.participants.length;
  els.capacityCount.textContent = cap;
  els.toSessionBtn.disabled =
    state.tables.length === 0 ||
    cap < state.participants.length ||
    state.participants.length < 2;
}

els.clearGridBtn.addEventListener('click', () => {
  if (state.tables.length === 0) return;
  state.tables = [];
  renderGrid();
  updateCapacity();
});

els.toSessionBtn.addEventListener('click', () => {
  startSession();
  showScreen('screen-session');
});

// =========================================================
// Session — shuffle + render
// =========================================================

function startSession() {
  state.round = 0;
  state.pairHistory = new Map();
  nextRound();
}

function nextRound() {
  state.round++;
  els.roundNum.textContent = state.round;
  assignSeats();
  renderLayoutView();
  showIcebreaker();
  updateStats();
  resetTimer();
}

function assignSeats() {
  const ppl = state.participants;
  if (ppl.length === 0) return;

  let bestAssignment = null;
  let bestScore = Infinity;
  let bestNewPairs = 0;

  const attempts = Math.min(600, 80 + ppl.length * 20);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const order = shuffleArray([...ppl]);
    let idx = 0;
    let score = 0;
    let newPairs = 0;
    const assignment = new Map();
    const personToTable = new Map();

    for (const table of state.tables) {
      const group = order.slice(idx, idx + table.seats);
      idx += table.seats;
      for (let i = 0; i < group.length; i++) {
        personToTable.set(group[i].id, table.id);
        for (let j = i + 1; j < group.length; j++) {
          const c = state.pairHistory.get(pairKey(group[i].id, group[j].id)) || 0;
          // Quadratic penalty so repeating the same pair gets very expensive
          score += c * c * 4 + c;
          if (c === 0) newPairs++;
        }
      }
      assignment.set(table.id, group.map(p => p.id));
    }

    // Enforce relations with a very high penalty
    for (const r of state.relations) {
      const at = personToTable.get(r.aId);
      const bt = personToTable.get(r.bId);
      if (at === undefined || bt === undefined) continue;
      if (r.mode === 'together' && at !== bt) score += RELATION_PENALTY;
      else if (r.mode === 'separate' && at === bt) score += RELATION_PENALTY;
    }

    if (score < bestScore) {
      bestScore = score;
      bestAssignment = assignment;
      bestNewPairs = newPairs;
      if (score === 0) break; // perfect: no repeats, all constraints honored
    }
  }

  state.currentAssignment = bestAssignment;
  state.newPairsRound = bestNewPairs;

  for (const ids of bestAssignment.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = pairKey(ids[i], ids[j]);
        state.pairHistory.set(k, (state.pairHistory.get(k) || 0) + 1);
      }
    }
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderLayoutView() {
  els.layoutView.innerHTML = '';
  els.layoutView.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  els.layoutView.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const c = document.createElement('div');
    c.className = 'grid-cell';
    els.layoutView.appendChild(c);
  }

  state.tables.forEach(t => {
    const ids = state.currentAssignment.get(t.id) || [];
    const block = document.createElement('div');
    block.className = 'session-table';
    block.style.gridColumn = `${t.x + 1} / span ${t.w}`;
    block.style.gridRow = `${t.y + 1} / span ${t.h}`;
    ids.forEach(id => {
      const p = state.participants.find(x => x.id === id);
      if (!p) return;
      const tag = document.createElement('span');
      tag.className = 'seat-name';
      tag.textContent = p.name;
      block.appendChild(tag);
    });
    els.layoutView.appendChild(block);
  });
}

function showIcebreaker() {
  // Alternate between icebreakers and tips (1 in 4 chance of a tip)
  const useTip = Math.random() < 0.2 && state.round > 1;
  const pool = useTip ? TIPS : ICEBREAKERS;
  els.icebreakerText.textContent = pool[Math.floor(Math.random() * pool.length)];
}

els.newIcebreakerBtn.addEventListener('click', showIcebreaker);

function updateStats() {
  const totalPossiblePairs = state.participants.length * (state.participants.length - 1) / 2;
  const pairsMade = [...state.pairHistory.values()].filter(v => v > 0).length;
  const coverage = totalPossiblePairs === 0 ? 0 : Math.round((pairsMade / totalPossiblePairs) * 100);

  els.newPairsEl.textContent = state.newPairsRound;
  els.totalPairsEl.textContent = `${pairsMade}/${totalPossiblePairs}`;
  els.coverageEl.textContent = `${coverage}%`;

  els.roundInfo.textContent =
    `${state.participants.length} pessoas em ${state.tables.length} mesas`;
}

// =========================================================
// Timer
// =========================================================

function resetTimer() {
  state.remainingSeconds = Math.max(1, parseInt(els.roundMinutes.value, 10) || 15) * 60;
  state.paused = false;
  els.pauseBtn.textContent = '⏸ Pausar';
  els.timerEl.classList.remove('alert');
  updateTimerDisplay();
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (state.paused) return;
  state.remainingSeconds--;
  if (state.remainingSeconds <= 10 && state.remainingSeconds > 0) {
    els.timerEl.classList.add('alert');
  }
  if (state.remainingSeconds <= 0) {
    clearInterval(state.timerInterval);
    onTimerEnd();
    return;
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(state.remainingSeconds / 60);
  const s = state.remainingSeconds % 60;
  els.timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
}

function onTimerEnd() {
  els.timerEl.textContent = 'TROCAR!';
  els.timerEl.classList.add('alert');
  if (els.soundOn.checked) beep();
  if (navigator.vibrate) navigator.vibrate([240, 120, 240, 120, 360]);
  setTimeout(nextRound, 1400);
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tones = [880, 1100, 1320];
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.01);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.16);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.18);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (_) { /* audio not available */ }
}

els.pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
  els.pauseBtn.textContent = state.paused ? '▶ Retomar' : '⏸ Pausar';
});

els.shuffleBtn.addEventListener('click', () => {
  clearInterval(state.timerInterval);
  nextRound();
});

els.endBtn.addEventListener('click', () => {
  clearInterval(state.timerInterval);
  showScreen('screen-setup');
});

els.roundMinutes.addEventListener('change', () => {
  // Adjust running timer to new value
  const v = parseInt(els.roundMinutes.value, 10);
  if (!isFinite(v) || v < 1) { els.roundMinutes.value = 1; }
  if (v > 120) { els.roundMinutes.value = 120; }
});

// =========================================================
// Routing
// =========================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-layout') {
    if (!state.selectedShapeId && !state.deleteMode) selectShape(SHAPES[1].id);
    renderPalette();
    if (state.selectedShapeId) {
      document.querySelectorAll('.palette-item').forEach(p =>
        p.classList.toggle('selected', p.dataset.shapeId === state.selectedShapeId)
      );
    }
    renderGrid();
    updateCapacity();
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('.back').forEach(b => {
  b.addEventListener('click', () => showScreen(b.dataset.target));
});

// =========================================================
// iOS-friendly tap handling
// =========================================================
// On iOS, tapping a button while a text input has focus can cause the keyboard
// to dismiss and the viewport to reflow, which sometimes "eats" the click on
// the button. Listen to pointerdown so the action fires before that happens.

// pointerdown fires before the input loses focus, so we add the pending
// name even if the click event gets eaten by an iOS reflow. The submit
// and click handlers below are safety nets — addNamesFromInput is
// idempotent (an empty input is a no-op).
els.addForm.querySelector('button').addEventListener('pointerdown', () => {
  addNamesFromInput();
});

// =========================================================
// Init
// =========================================================

renderParticipants();

// Visible confirmation that JS is running (helps debugging on mobile)
const okBanner = document.getElementById('js-ok');
if (okBanner) {
  okBanner.hidden = false;
  setTimeout(() => { okBanner.style.opacity = '0.3'; }, 3000);
}
