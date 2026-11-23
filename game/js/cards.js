// Ember Clash — card catalogue and deck building.
// Kinds: strike (damage), guard (block), mend (heal), draw (draw cards).
// Every card is an original Ember Clash design: name, mana cost, value, flavour.

export const CARD_KINDS = {
  strike: { label: 'Strike', art: '\u25B2', verb: 'hits' },
  guard: { label: 'Guard', art: '\u25C6', verb: 'raises' },
  mend: { label: 'Mend', art: '\u2726', verb: 'kindles' },
  draw: { label: 'Draw', art: '\u25CF', verb: 'summons' },
};

// One entry per unique card. `copies` says how many of it go in the deck.
export const CARD_LIST = [
  { id: 'ember-spark', name: 'Ember Spark', kind: 'strike', cost: 1, value: 2,
    text: 'A small flame, faithfully thrown.', copies: 3 },
  { id: 'cinder-fang', name: 'Cinder Fang', kind: 'strike', cost: 2, value: 4,
    text: 'A bite of hot ash.', copies: 2 },
  { id: 'flame-lash', name: 'Flame Lash', kind: 'strike', cost: 2, value: 3,
    text: 'Whips across the table like a lit rope.', copies: 2 },
  { id: 'coal-fist', name: 'Coal Fist', kind: 'strike', cost: 3, value: 6,
    text: 'A glove of glowing coal, swung once.', copies: 2 },
  { id: 'blaze-burst', name: 'Blaze Burst', kind: 'strike', cost: 3, value: 5,
    text: 'The hearth sneezes fire.', copies: 2 },
  { id: 'inferno-roar', name: 'Inferno Roar', kind: 'strike', cost: 4, value: 7,
    text: 'The whole fireplace answers at once.', copies: 1 },
  { id: 'ash-phoenix', name: 'Ash Phoenix', kind: 'strike', cost: 5, value: 9,
    text: 'It rises, it screams, it burns.', copies: 1 },
  { id: 'ashen-shield', name: 'Ashen Shield', kind: 'guard', cost: 1, value: 3,
    text: 'Packed ash, hard as brick.', copies: 3 },
  { id: 'stone-ember', name: 'Stone Ember', kind: 'guard', cost: 2, value: 5,
    text: 'A warm stone between you and harm.', copies: 2 },
  { id: 'molten-wall', name: 'Molten Wall', kind: 'guard', cost: 3, value: 8,
    text: 'Molten rock, poured and held.', copies: 1 },
  { id: 'kindling-light', name: 'Kindling Light', kind: 'mend', cost: 1, value: 2,
    text: 'A small warmth, carefully kept.', copies: 2 },
  { id: 'warm-hearth', name: 'Warm Hearth', kind: 'mend', cost: 2, value: 4,
    text: 'Sit by it. Breathe. Mend.', copies: 2 },
  { id: 'phoenix-tears', name: 'Phoenix Tears', kind: 'mend', cost: 3, value: 7,
    text: 'Each drop closes a wound.', copies: 1 },
  { id: 'ember-scout', name: 'Ember Scout', kind: 'draw', cost: 2, value: 2,
    text: 'A bright spark runs ahead and brings back two cards.', copies: 2 },
];

export function buildDeck() {
  const deck = [];
  for (const card of CARD_LIST) {
    for (let i = 0; i < card.copies; i += 1) {
      deck.push({ ...card, uid: `${card.id}-${i}` });
    }
  }
  return deck;
}

export function cardById(id) {
  return CARD_LIST.find((c) => c.id === id) ?? null;
}

// Seeded random (mulberry32) so screenshot states are reproducible.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(array, rng) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
