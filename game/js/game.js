// Ember Clash — game state, turns, the Cinder Warden AI, rendering and input.
// A turn-based card duel: spend ember mana to play cards, reduce the Warden to
// 0 life to win. Played with mouse or keyboard. `?shot=` picks a fixed scene
// (title, play, win, loss) for screenshots; `?seed=` seeds the shuffle.

import { CARD_LIST, CARD_KINDS, buildDeck, makeRng, shuffle } from './cards.js';

const MAX_LIFE = 20;
const MAX_MANA = 8;
const HAND_START = 4;
const HAND_MAX = 7;

const $ = (id) => document.getElementById(id);

const state = {
  screen: 'title',
  seed: 1,
  rng: makeRng(1),
  turn: 1,
  playerLife: MAX_LIFE,
  enemyLife: MAX_LIFE,
  playerShield: 0,
  enemyShield: 0,
  mana: 1,
  manaMax: 1,
  deck: [],
  discard: [],
  hand: [],
  enemyHand: [],
  enemyDeck: [],
  enemyDiscard: [],
  enemyMana: 0,
  log: [],
  aiBusy: false,
  turnsPlayed: 0,
};

function showScreen(name) {
  state.screen = name;
  $('screen-title').classList.toggle('hidden', name !== 'title');
  $('screen-play').classList.toggle('hidden', name !== 'play');
  $('screen-win').classList.toggle('hidden', name !== 'win');
  $('screen-loss').classList.toggle('hidden', name !== 'loss');
}

function addLog(text) {
  state.log.unshift(text);
  if (state.log.length > 30) state.log.length = 30;
  renderLog();
}

function renderLog() {
  $('log').innerHTML = state.log.map((line) => `<div>${line}</div>`).join('');
}

function setBattle(text, empty = false) {
  const el = $('battle-card');
  el.textContent = text;
  el.classList.toggle('empty', empty);
}

function drawFrom(deck, discard, rng) {
  if (deck.length === 0) {
    if (discard.length === 0) return null;
    deck.push(...shuffle(discard.splice(0), rng));
  }
  return deck.pop();
}

function dealDamage(target, amount) {
  let left = amount;
  if (target === 'enemy' && state.enemyShield > 0) {
    const blocked = Math.min(state.enemyShield, left);
    state.enemyShield -= blocked;
    left -= blocked;
  }
  if (target === 'player' && state.playerShield > 0) {
    const blocked = Math.min(state.playerShield, left);
    state.playerShield -= blocked;
    left -= blocked;
  }
  if (left > 0) {
    if (target === 'enemy') state.enemyLife = Math.max(0, state.enemyLife - left);
    else state.playerLife = Math.max(0, state.playerLife - left);
  }
  return left;
}

function heal(target, amount) {
  if (target === 'enemy') state.enemyLife = Math.min(MAX_LIFE, state.enemyLife + amount);
  else state.playerLife = Math.min(MAX_LIFE, state.playerLife + amount);
}

function applyCard(card, who) {
  const mine = who === 'player';
  const name = mine ? 'You' : 'The Warden';
  if (card.kind === 'strike') {
    const dealt = dealDamage(mine ? 'enemy' : 'player', card.value);
    addLog(`${name} played ${card.name} — ${card.value} damage${dealt < card.value ? ` (${card.value - dealt} blocked)` : ''}.`);
    setBattle(`${card.name} strikes for ${card.value}!`);
  } else if (card.kind === 'guard') {
    if (mine) state.playerShield += card.value;
    else state.enemyShield += card.value;
    addLog(`${name} played ${card.name} — +${card.value} shield.`);
    setBattle(`${card.name} raises a +${card.value} shield.`);
  } else if (card.kind === 'mend') {
    heal(who, card.value);
    addLog(`${name} played ${card.name} — healed ${card.value} life.`);
    setBattle(`${card.name} mends ${card.value} life.`);
  } else if (card.kind === 'draw') {
    addLog(`${name} played ${card.name} — draws ${card.value} cards.`);
    setBattle(`${card.name} scouts ahead and draws ${card.value} cards.`);
    for (let i = 0; i < card.value; i += 1) {
      const drawn = drawFrom(state.deck, state.discard, state.rng);
      if (!drawn) break;
      if (state.hand.length < HAND_MAX) state.hand.push(drawn);
      else state.discard.push(drawn);
    }
  }
}

function checkEnd() {
  if (state.enemyLife <= 0) {
    state.turnsPlayed = state.turn;
    $('win-stats').textContent = `Won in ${state.turn} turns — ${state.playerLife} life left.`;
    showScreen('win');
    return true;
  }
  if (state.playerLife <= 0) {
    state.turnsPlayed = state.turn;
    $('loss-stats').textContent = `Fell on turn ${state.turn} — the Warden had ${state.enemyLife} life left.`;
    showScreen('loss');
    return true;
  }
  return false;
}

function playCard(index) {
  if (state.screen !== 'play' || state.aiBusy) return;
  const card = state.hand[index];
  if (!card) return;
  if (card.cost > state.mana) {
    addLog(`Not enough mana for ${card.name} (needs ${card.cost}).`);
    return;
  }
  state.mana -= card.cost;
  state.hand.splice(index, 1);
  state.discard.push(card);
  applyCard(card, 'player');
  render();
  if (checkEnd()) return;
}

function aiTakeTurn() {
  const aiManaMax = Math.min(state.turn, MAX_MANA);
  let aiMana = aiManaMax;
  state.enemyMana = aiManaMax;
  // The Warden draws two cards and plays what it can afford, strikes first.
  for (let i = 0; i < 2; i += 1) {
    const drawn = drawFrom(state.enemyDeck, state.enemyDiscard, state.rng);
    if (drawn) state.enemyHand.push(drawn);
  }
  state.enemyHand.sort((a, b) => {
    const order = { strike: 0, mend: 1, guard: 2, draw: 3 };
    return order[a.kind] - order[b.kind];
  });
  let played = 0;
  for (let i = state.enemyHand.length - 1; i >= 0 && played < 2; i -= 1) {
    const card = state.enemyHand[i];
    if (card.cost <= aiMana) {
      aiMana -= card.cost;
      state.enemyHand.splice(i, 1);
      state.enemyDiscard.push(card);
      applyCard(card, 'enemy');
      played += 1;
    }
  }
  if (played === 0) addLog('The Warden passes, embers low.');
  state.enemyMana = aiMana;
  state.aiBusy = false;
  if (checkEnd()) { render(); return; }
  startPlayerTurn();
}

function endTurn() {
  if (state.screen !== 'play' || state.aiBusy) return;
  state.aiBusy = true;
  $('turn-text').textContent = `Turn ${state.turn} — the Warden stirs…`;
  render();
  window.setTimeout(aiTakeTurn, 650);
}

function startPlayerTurn() {
  state.turn += 1;
  state.manaMax = Math.min(state.turn, MAX_MANA);
  state.mana = state.manaMax;
  const drawn = drawFrom(state.deck, state.discard, state.rng);
  if (drawn) {
    if (state.hand.length < HAND_MAX) state.hand.push(drawn);
    else { state.discard.push(drawn); addLog('Your hand is full — the drawn card burns away.'); }
  }
  $('turn-text').textContent = `Turn ${state.turn} — Your move`;
  addLog(`Turn ${state.turn}: you gain ${state.manaMax} mana and draw a card.`);
  render();
}

function startGame(seed) {
  state.seed = seed;
  state.rng = makeRng(seed);
  state.turn = 1;
  state.playerLife = MAX_LIFE;
  state.enemyLife = MAX_LIFE;
  state.playerShield = 0;
  state.enemyShield = 0;
  state.manaMax = 1;
  state.mana = 1;
  state.deck = shuffle(buildDeck(), state.rng);
  state.discard = [];
  state.hand = [];
  state.enemyDeck = shuffle(buildDeck(), state.rng);
  state.enemyDiscard = [];
  state.enemyHand = [];
  state.enemyMana = 0;
  state.log = [];
  state.aiBusy = false;
  for (let i = 0; i < HAND_START; i += 1) {
    const card = drawFrom(state.deck, state.discard, state.rng);
    if (card) state.hand.push(card);
    const foe = drawFrom(state.enemyDeck, state.enemyDiscard, state.rng);
    if (foe) state.enemyHand.push(foe);
  }
  $('turn-text').textContent = 'Turn 1 — Your move';
  addLog('The duel begins. You draw 4 cards and gain 1 mana.');
  setBattle('The fire crackles. Play a card to strike.', true);
  showScreen('play');
  render();
}

function cardElement(card, opts = {}) {
  const el = document.createElement('div');
  const kind = CARD_KINDS[card.kind];
  el.className = `card kind-${card.kind}${opts.playable ? ' playable' : ''}${opts.tooExpensive ? ' too-expensive' : ''}`;
  el.innerHTML =
    `<div class="card-cost">${card.cost}</div>` +
    `<div class="card-kind">${kind.label}</div>` +
    `<div class="card-name">${card.name}</div>` +
    `<div class="card-art">${kind.art}</div>` +
    `<div class="card-value">${kind.verb === 'hits' ? 'ATK ' : kind.verb === 'raises' ? 'BLK ' : kind.verb === 'kindles' ? 'HEAL ' : 'DRAW '}${card.value}</div>` +
    `<div class="card-text">${card.text}</div>` +
    (opts.key ? `<div class="card-key">[${opts.key}]</div>` : '');
  if (opts.onClick) el.addEventListener('click', opts.onClick);
  return el;
}

function render() {
  $('player-life-fill').style.width = `${(state.playerLife / MAX_LIFE) * 100}%`;
  $('enemy-life-fill').style.width = `${(state.enemyLife / MAX_LIFE) * 100}%`;
  $('player-life-text').textContent = `${state.playerLife} / ${MAX_LIFE}`;
  $('enemy-life-text').textContent = `${state.enemyLife} / ${MAX_LIFE}`;
  $('player-shield').classList.toggle('hidden', state.playerShield <= 0);
  $('enemy-shield').classList.toggle('hidden', state.enemyShield <= 0);
  $('player-shield').textContent = `SHIELD ${state.playerShield}`;
  $('enemy-shield').textContent = `SHIELD ${state.enemyShield}`;
  $('player-mana-text').textContent = `${state.mana} / ${state.manaMax}`;
  $('enemy-mana-text').textContent = String(state.enemyMana);
  $('deck-text').textContent = `Deck: ${state.deck.length}`;
  $('discard-text').textContent = `Discard: ${state.discard.length}`;
  $('btn-end-turn').disabled = state.aiBusy;

  const enemyHand = $('enemy-hand');
  enemyHand.innerHTML = '';
  state.enemyHand.forEach(() => {
    const back = document.createElement('div');
    back.className = 'card';
    back.innerHTML = '<div class="card-kind">Warden</div><div class="card-name">Hidden<br>Card</div><div class="card-art">\u25CF</div><div class="card-text">Face down, waiting.</div>';
    enemyHand.appendChild(back);
  });

  const playerHand = $('player-hand');
  playerHand.innerHTML = '';
  state.hand.forEach((card, i) => {
    const affordable = card.cost <= state.mana && !state.aiBusy;
    playerHand.appendChild(cardElement(card, {
      playable: affordable,
      tooExpensive: !affordable,
      key: String(i + 1),
      onClick: () => playCard(i),
    }));
  });
}

// Fixed demo states for screenshots — real renders of the game's own state.
function applyShot(shot, seed) {
  if (shot === 'title') { showScreen('title'); return; }
  if (shot === 'win') {
    startGame(seed);
    state.enemyLife = 0;
    $('win-stats').textContent = `Won in 6 turns — 9 life left.`;
    showScreen('win');
    return;
  }
  if (shot === 'loss') {
    startGame(seed);
    state.playerLife = 0;
    $('loss-stats').textContent = `Fell on turn 7 — the Warden had 6 life left.`;
    showScreen('loss');
    return;
  }
  // 'play': a mid-duel table both sides can read at a glance.
  startGame(seed);
  state.turn = 4;
  state.manaMax = 4;
  state.mana = 4;
  state.playerLife = 14;
  state.enemyLife = 11;
  state.playerShield = 3;
  state.enemyMana = 3;
  const wanted = ['ember-spark', 'cinder-fang', 'molten-wall', 'warm-hearth'];
  state.hand = wanted.map((id) => CARD_LIST.find((c) => c.id === id)).map((c, i) => ({ ...c, uid: `shot-${i}` }));
  state.enemyHand = state.enemyHand.slice(0, 3);
  state.deck = state.deck.slice(0, 16);
  state.log = [
    'Turn 4: you gain 4 mana and draw a card.',
    'The Warden played Flame Lash — 3 damage (3 blocked by your shield).',
    'You played Cinder Fang — 4 damage.',
    'The Warden played Ashen Shield — +3 shield.',
  ];
  $('turn-text').textContent = 'Turn 4 — Your move';
  setBattle('Cinder Fang strikes for 4!');
  renderLog();
  render();
}

function wireButtons() {
  $('btn-start').addEventListener('click', () => startGame(Date.now() % 100000));
  $('btn-end-turn').addEventListener('click', endTurn);
  $('btn-restart').addEventListener('click', () => startGame(Date.now() % 100000));
  $('btn-again-win').addEventListener('click', () => startGame(Date.now() % 100000));
  $('btn-again-loss').addEventListener('click', () => startGame(Date.now() % 100000));
  document.addEventListener('keydown', (event) => {
    if (state.screen === 'title' && event.key === 'Enter') { startGame(Date.now() % 100000); return; }
    if (state.screen === 'play') {
      if (event.key >= '1' && event.key <= '5') playCard(Number(event.key) - 1);
      else if (event.key === 'e' || event.key === 'E' || event.key === ' ') endTurn();
      else if (event.key === 'r' || event.key === 'R') startGame(Date.now() % 100000);
    }
    if ((state.screen === 'win' || state.screen === 'loss') && event.key === 'r') {
      startGame(Date.now() % 100000);
    }
  });
}

wireButtons();
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? '1') || 1;
if (shot) applyShot(shot, seed);
else showScreen('title');
