/**
 * Ultimate Janken v2 - Game Engine
 * Rule: Each round, 1/2/3 are randomly assigned to Rock/Scissors/Paper.
 *       Win = your hand's value. Draw = both get hand's value. Lose = 0.
 *       First to 5 wins a set. Sudden death on tie.
 */

const HAND = { ROCK: 0, SCISSORS: 1, PAPER: 2 };
const HAND_LABEL = ['グー', 'チョキ', 'パー'];
const HAND_EMOJI = ['✊', '✌️', '✋'];
const SET_SCORE = 5;

// All 6 permutations of [1, 2, 3]
const PERMUTATIONS = [
  [1, 2, 3], [1, 3, 2], [2, 1, 3],
  [2, 3, 1], [3, 1, 2], [3, 2, 1],
];

function randomValues() {
  return PERMUTATIONS[Math.floor(Math.random() * PERMUTATIONS.length)];
}

// Returns: 1 = p1 wins, -1 = p2 wins, 0 = draw
function judge(h1, h2) {
  if (h1 === h2) return 0;
  if ((h1 === HAND.ROCK && h2 === HAND.SCISSORS) ||
      (h1 === HAND.SCISSORS && h2 === HAND.PAPER) ||
      (h1 === HAND.PAPER && h2 === HAND.ROCK)) return 1;
  return -1;
}

function calcTurn(h1, h2, values) {
  const result = judge(h1, h2);
  let p1Pts = 0, p2Pts = 0;

  if (result === 1) {
    p1Pts = values[h1];
  } else if (result === -1) {
    p2Pts = values[h2];
  } else {
    // Draw: both get their hand's value (same hand, same value)
    p1Pts = values[h1];
    p2Pts = values[h2];
  }

  return { result, p1Pts, p2Pts, h1, h2 };
}

// === Game State ===
class UltimateJankenGame {
  constructor(bestOf = 1) {
    this.bestOf = bestOf; // 1 or 3
    this.reset();
  }

  reset() {
    this.sets = { p1: 0, p2: 0 };
    this.resetSet();
    this.matchFinished = false;
    this.matchWinner = null;
  }

  resetSet() {
    this.scores = { p1: 0, p2: 0 };
    this.turn = 0;
    this.values = null;
    this.history = [];
    this.setFinished = false;
    this.setWinner = null;
    this.suddenDeath = false;
  }

  startTurn() {
    this.turn++;
    if (this.suddenDeath) {
      this.values = [0, 0, 0]; // No values in sudden death
    } else {
      this.values = randomValues();
    }
    return {
      turn: this.turn,
      values: [...this.values],
      scores: { ...this.scores },
      suddenDeath: this.suddenDeath,
    };
  }

  submitHands(h1, h2) {
    if (this.suddenDeath) {
      const result = judge(h1, h2);
      const entry = { turn: this.turn, h1, h2, result, p1Pts: 0, p2Pts: 0, suddenDeath: true };
      this.history.push(entry);

      if (result !== 0) {
        this.setFinished = true;
        this.setWinner = result === 1 ? 'p1' : 'p2';
        this._checkMatch();
      }
      return { ...entry, scores: { ...this.scores }, setFinished: this.setFinished, setWinner: this.setWinner, matchFinished: this.matchFinished, matchWinner: this.matchWinner };
    }

    const turnResult = calcTurn(h1, h2, this.values);
    this.scores.p1 += turnResult.p1Pts;
    this.scores.p2 += turnResult.p2Pts;

    const entry = { turn: this.turn, ...turnResult, values: [...this.values], suddenDeath: false };
    this.history.push(entry);

    // Check set win
    if (this.scores.p1 >= SET_SCORE || this.scores.p2 >= SET_SCORE) {
      if (this.scores.p1 !== this.scores.p2) {
        this.setFinished = true;
        this.setWinner = this.scores.p1 > this.scores.p2 ? 'p1' : 'p2';
        this._checkMatch();
      } else {
        // Both hit 5+ at same time -> sudden death
        this.suddenDeath = true;
      }
    }

    return { ...entry, scores: { ...this.scores }, setFinished: this.setFinished, setWinner: this.setWinner, matchFinished: this.matchFinished, matchWinner: this.matchWinner, suddenDeath: this.suddenDeath };
  }

  _checkMatch() {
    if (this.setWinner) {
      this.sets[this.setWinner]++;
    }
    const need = Math.ceil(this.bestOf / 2);
    if (this.sets.p1 >= need || this.sets.p2 >= need) {
      this.matchFinished = true;
      this.matchWinner = this.sets.p1 >= need ? 'p1' : 'p2';
    }
  }

  nextSet() {
    if (this.matchFinished) return;
    this.resetSet();
  }

  getState() {
    return {
      bestOf: this.bestOf,
      sets: { ...this.sets },
      scores: { ...this.scores },
      turn: this.turn,
      values: this.values ? [...this.values] : null,
      suddenDeath: this.suddenDeath,
      setFinished: this.setFinished,
      setWinner: this.setWinner,
      matchFinished: this.matchFinished,
      matchWinner: this.matchWinner,
      history: this.history,
    };
  }
}

// === CPU AI ===
function cpuChoose(values, suddenDeath) {
  if (suddenDeath) return Math.floor(Math.random() * 3);
  // Favor high-value hands with weight = value^2
  const weights = values.map(v => v * v);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < 3; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 2;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HAND, HAND_LABEL, HAND_EMOJI, SET_SCORE, UltimateJankenGame, cpuChoose, judge, calcTurn, randomValues };
}
