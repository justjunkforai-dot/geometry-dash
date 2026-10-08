/**
 * Original synthesized tracks, stored as pattern data for the step sequencer (audio.js).
 *
 * Notation (one character per 16th note, patterns repeat over their length):
 *   drums  k kick · s snare · c clap · h hats ('x' closed, 'o' open) — 'X' = accent
 *   bass   scale degrees relative to the bar's chord root
 *   lead   scale degrees relative to the key root
 *   arp    chord-tone indices (0 root, 1 third, 2 fifth, 3 octave, 4 tenth …)
 *   degree chars: '0'-'9' = 0..9, 'A'-'E' = 10..14, 'a'-'g' = -1..-7, '.' rest, '-' hold
 * song: [bars, drums, bass, lead, arp, pad, fx] sections; `loop` = section to repeat from.
 * prog: chord roots (scale degrees) per bar, cycled.
 */

const FOUR = 'x...x...x...x...';
const BACK = '....x.......x...';
const OFF8 = '..x...x...x...x.';

export const TRACKS = {
  firstSteps: {
    name: 'First Steps', bpm: 128, root: 53, scale: 'major', prog: [0, 4, 5, 3],
    inst: { bass: { type: 'sawtooth', cutoff: 700 }, lead: { type: 'square', cutoff: 2600, detune: 6, delay: 0.25 }, arp: { type: 'triangle', delay: 0.2 }, pad: { cutoff: 1200 } },
    drums: {
      intro: { k: 'x.......x.......', h: '....x.......x...' },
      main: { k: FOUR, s: BACK, h: OFF8 },
      drive: { k: FOUR, c: BACK, h: 'x.x.x.x.x.x.x.xo' },
      half: { k: 'x.......x.......', s: '........x.......', h: 'x...x...x...x...' },
    },
    bass: { main: '0.0.0.0.0.0.0.4.', drive: '0.00.00.0.00.07.' },
    lead: {
      a: '4.4.5.4.2---0...1.1.2.1.4---....5.5.7.5.4---2...3.3.2.3.4-------',
      b: '7.7.7.9.7.4.2.4.6.6.6.8.6.4.1...7.7.7.9.A.9.7.5.6---5---4-------',
    },
    arp: { up: '0123', wide: '01230123012343210123012301234321' },
    song: [
      [2, 'intro', null, null, 'up', true, 'riser'],
      [4, 'main', 'main', null, 'up', true],
      [4, 'main', 'main', 'a', null, true],
      [4, 'drive', 'drive', 'b', 'up', true, 'crash'],
      [4, 'drive', 'drive', 'b', 'wide', true],
      [4, 'half', 'main', 'a', 'up', true, 'riser'],
      [4, 'main', 'main', 'a', 'up', true, 'crash'],
      [4, 'drive', 'drive', 'b', 'wide', true],
      [4, 'intro', 'main', null, 'up', true],
    ],
    loop: 1,
  },

  neonSkyline: {
    name: 'Neon Skyline', bpm: 140, root: 52, scale: 'minor', prog: [0, 5, 2, 6],
    inst: { bass: { type: 'sawtooth', cutoff: 900, q: 6 }, lead: { type: 'sawtooth', cutoff: 3000, detune: 12, delay: 0.3 }, arp: { type: 'square', cutoff: 2600, delay: 0.25 }, pad: { cutoff: 1600 } },
    drums: {
      intro: { k: 'x.......x.......', h: 'x.o.x.o.x.o.x.o.' },
      main: { k: FOUR, s: BACK, h: 'x.o.x.o.x.o.x.o.' },
      run: { k: 'x...x...x...x.x.', s: BACK, c: '............x...', h: 'xxoxxxoxxxoxxxox' },
    },
    bass: { pump: '.0.0.0.0.0.0.0.0', run: '0.00.00.0.00.07.' },
    lead: {
      a: '7...6.7.4...2...5...4.5.2...0...4...2.4.6.7.6.4.6---5---3---1---',
      b: '7.7.9.7.6.4.6.7.5.5.7.5.4.2.4.5.4.4.6.4.2.4.6.9.8---7---6---4---',
    },
    arp: { a: '0123212301232123', b: '0212' },
    song: [
      [2, 'intro', null, null, 'a', true, 'riser'],
      [4, 'main', 'pump', null, 'a', true],
      [4, 'main', 'pump', 'a', 'b', true],
      [4, 'run', 'run', 'b', 'a', true, 'crash'],
      [4, 'run', 'run', 'b', 'a', true],
      [4, 'intro', 'pump', 'a', 'b', true, 'riser'],
      [4, 'run', 'run', 'b', 'a', true, 'crash'],
      [4, 'main', 'pump', 'a', 'a', true],
      [4, 'run', 'run', 'b', 'b', true],
      [4, 'intro', 'pump', null, 'a', true],
    ],
    loop: 1,
  },

  gravityWell: {
    name: 'Gravity Well', bpm: 120, root: 50, scale: 'dorian', prog: [0, 0, 3, 3],
    inst: { bass: { type: 'square', cutoff: 500, sub: 0.8 }, lead: { type: 'triangle', cutoff: 2400, detune: 5, vibrato: true, delay: 0.35, attack: 0.03 }, arp: { type: 'triangle', delay: 0.35, decay: 0.3 }, pad: { cutoff: 1000, type: 'triangle' } },
    drums: {
      intro: { h: 'x.x.x.x.x.x.x.x.' },
      main: { k: 'x.....x...x.....', s: '........x.......', h: 'x.x.x.xox.x.x.x.' },
      busy: { k: 'x.....x...x...x.', s: '....x.......x..x', h: 'xxxoxxxxxxxoxxxx' },
    },
    bass: { main: '0.......0.2.4...', busy: '0..0..0.0.2.4.2.' },
    lead: {
      a: '4---2---0---2-4-5---4---2---1---7---6---4---5-4-3---2---1-------',
      b: '7-6-4-2-4---7---8-7-5-4-5---2---9-8-7-6-7---4---6---5---4-------',
    },
    arp: { a: '0.2.1.3.0.2.1.3.', b: '0213' },
    song: [
      [2, 'intro', null, null, 'a', true, 'riser'],
      [4, 'main', 'main', null, 'a', true],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'busy', 'busy', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'busy', 'busy', 'b', 'b', true, 'crash'],
      [4, 'intro', 'main', 'a', 'a', true, 'riser'],
      [4, 'busy', 'busy', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', null, 'a', true],
    ],
    loop: 1,
  },

  pulseReactor: {
    name: 'Pulse Reactor', bpm: 132, root: 55, scale: 'phrygian', prog: [0, 0, 1, 0],
    inst: { bass: { type: 'sawtooth', cutoff: 1400, q: 12, sub: 0.3 }, lead: { type: 'square', cutoff: 2000, detune: 4, delay: 0.3 }, arp: { type: 'sawtooth', cutoff: 3200, delay: 0.3, decay: 0.15 }, pad: { cutoff: 900 } },
    drums: {
      intro: { k: FOUR, h: '..o...o...o...o.' },
      main: { k: FOUR, c: BACK, h: '..o...o...o...o.' },
      peak: { k: FOUR, c: BACK, s: '..............x.', h: 'xxoxxxoxxxoxxxox' },
    },
    bass: { acid: '0000300003000700', drop: '0.0.0.0.0.0.0.30' },
    lead: {
      a: '0..0..0.3..3..1.0..0..0.4..4..3.',
      b: '7.7.6.4.7.7.6.4.8.8.7.4.6---4---',
    },
    arp: { a: '0132', b: '01231323' },
    song: [
      [2, 'intro', 'acid', null, null, true, 'riser'],
      [4, 'main', 'acid', null, 'a', false],
      [4, 'main', 'acid', 'a', 'a', true],
      [4, 'peak', 'drop', 'b', 'b', true, 'crash'],
      [4, 'main', 'acid', 'a', 'a', false],
      [4, 'peak', 'acid', 'b', 'b', true, 'crash'],
      [4, 'intro', 'acid', null, 'a', true, 'riser'],
      [4, 'peak', 'drop', 'b', 'b', true, 'crash'],
      [4, 'main', 'acid', 'a', 'a', true],
      [4, 'peak', 'acid', 'b', 'b', true],
    ],
    loop: 1,
  },

  waveRunner: {
    name: 'Wave Runner', bpm: 156, root: 49, scale: 'minor', prog: [0, 6, 5, 6],
    inst: { bass: { type: 'sawtooth', cutoff: 600, q: 3, sub: 0.7 }, lead: { type: 'sawtooth', cutoff: 3600, detune: 14, delay: 0.3 }, arp: { type: 'square', cutoff: 3000, delay: 0.2, decay: 0.12 }, pad: { cutoff: 1800 } },
    drums: {
      intro: { h: 'xxxxxxxxxxxxxxxx' },
      dnb: { k: 'x.........x.....', s: '....x.......x...', h: 'xxxxxxxoxxxxxxxo' },
      roll: { k: 'x.........x.x...', s: '....x..x....x.xx', h: 'xxxxxxxoxxxxxxxo' },
    },
    bass: { long: '0---------------', move: '0-------0---4---' },
    lead: {
      a: '7.7.7.9.A.9.7...6.6.6.7.9.7.6...5.5.5.7.9.7.5.4.6---7---9---7---',
      b: 'A...9...7...9...8...7...6...4...7...6...5...4...6---4---2---1---',
    },
    arp: { a: '0123432101234321', b: '02130213' },
    song: [
      [2, 'intro', 'long', null, 'a', true, 'riser'],
      [4, 'dnb', 'long', null, 'a', true, 'crash'],
      [4, 'dnb', 'move', 'a', 'a', true],
      [4, 'roll', 'move', 'b', 'b', true, 'crash'],
      [4, 'dnb', 'long', 'a', 'a', true],
      [4, 'roll', 'move', 'b', 'b', true, 'crash'],
      [4, 'intro', 'long', 'a', 'a', true, 'riser'],
      [4, 'roll', 'move', 'b', 'b', true, 'crash'],
      [4, 'dnb', 'move', 'a', 'a', true],
      [4, 'roll', 'move', 'b', 'b', true],
      [4, 'intro', 'long', null, 'a', true],
    ],
    loop: 1,
  },

  mirrorMaze: {
    name: 'Mirror Maze', bpm: 126, root: 57, scale: 'harmonic', prog: [0, 3, 4, 0],
    inst: { bass: { type: 'triangle', cutoff: 900, sub: 0.6 }, lead: { type: 'triangle', cutoff: 2800, detune: 4, vibrato: true, delay: 0.4 }, arp: { type: 'square', cutoff: 2200, delay: 0.4, decay: 0.18 }, pad: { cutoff: 1100 } },
    drums: {
      intro: { k: 'x...............', h: '..x...x...x...x.' },
      main: { k: 'x...x...x...x...', s: '........x.......', h: '..x...x...x.x.x.' },
      tense: { k: 'x...x...x...x.x.', s: '....x.......x...', c: '...............x', h: 'x.xox.x.x.xox.x.' },
    },
    bass: { main: '0...0...0.4.0...', walk: '0.0.2.2.4.4.2.2.' },
    lead: {
      a: '7...6...7...4...5...4...3...2...6...5...6...4-----------3-2-1-0-',
      b: '4.5.6.7.6.5.4...5.6.7.8.7.6.5...6.7.8.9.8.7.6.4.7---6---4-------',
    },
    arp: { a: '0.1.2.3.2.1.0.1.', b: '0123' },
    song: [
      [2, 'intro', null, null, 'a', true, 'riser'],
      [4, 'main', 'main', null, 'a', true],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'tense', 'walk', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'tense', 'walk', 'b', 'b', true, 'crash'],
      [4, 'intro', 'main', 'a', 'a', true, 'riser'],
      [4, 'tense', 'walk', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', 'a', 'b', true],
      [4, 'tense', 'walk', 'b', 'b', true],
    ],
    loop: 1,
  },

  sawFactory: {
    name: 'Saw Factory', bpm: 136, root: 53, scale: 'minor', prog: [0, 0, 5, 4],
    inst: { bass: { type: 'square', cutoff: 800, q: 8, sub: 0.6 }, lead: { type: 'sawtooth', cutoff: 2200, detune: 18, delay: 0.2 }, arp: { type: 'sawtooth', cutoff: 1800, decay: 0.1 }, pad: { cutoff: 800 }, kickTone: 0.9 },
    drums: {
      intro: { k: 'x.x.....x.x.....', h: 'x...x...x...x...' },
      grind: { k: 'x.x...x.x.x...x.', s: '....X.......X...', h: 'x.xxx.xxx.xxx.xx' },
      stomp: { k: 'x...x...x...x...', c: '....x.......x...', s: '...............x', h: 'xxoxxxoxxxoxxxox' },
    },
    bass: { grind: '0.0.0.0.0.0.0.0.', stomp: '00.000.000.000.0' },
    lead: {
      a: '0.0.3.0.5.0.4.3.0.0.3.0.6.5.4...',
      b: '7-7-6-4-7-7-6-4-8-8-7-5-6---4---',
    },
    arp: { a: '0303', b: '01230123' },
    song: [
      [2, 'intro', 'grind', null, null, true, 'riser'],
      [4, 'grind', 'grind', null, 'a', false],
      [4, 'grind', 'grind', 'a', 'a', true],
      [4, 'stomp', 'stomp', 'b', 'b', true, 'crash'],
      [4, 'grind', 'grind', 'a', 'a', false],
      [4, 'stomp', 'stomp', 'b', 'b', true, 'crash'],
      [4, 'intro', 'grind', 'a', 'a', true, 'riser'],
      [4, 'stomp', 'stomp', 'b', 'b', true, 'crash'],
      [4, 'grind', 'grind', 'a', 'a', true],
      [4, 'stomp', 'stomp', 'b', 'b', true],
      [4, 'grind', 'grind', 'a', 'a', true],
    ],
    loop: 1,
  },

  finalDescent: {
    name: 'Final Descent', bpm: 160, root: 47, scale: 'minor', prog: [0, 5, 2, 6, 0, 3, 4, 4],
    inst: { bass: { type: 'sawtooth', cutoff: 1000, q: 5, sub: 0.6 }, lead: { type: 'sawtooth', cutoff: 3800, detune: 12, vibrato: true, delay: 0.3 }, arp: { type: 'square', cutoff: 3200, delay: 0.25, decay: 0.12 }, pad: { cutoff: 1800 } },
    drums: {
      intro: { k: 'x.......x.......', h: 'x.x.x.x.x.x.x.x.' },
      drive: { k: FOUR, s: BACK, h: 'xxoxxxoxxxoxxxox' },
      blast: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x.x.', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
      half: { k: 'x.......x.......', s: '........x.......', h: 'x...x...x...x...' },
    },
    bass: { drive: '0.0.0.0.0.0.0.0.', blast: '0000000000000070' },
    lead: {
      a: '7---6---4---2---5---4---2---0---4---2---4---6---7-------6-------',
      b: '7.7.9.7.A.9.7.6.5.5.7.5.9.7.5.4.4.4.6.4.7.6.4.2.6.6.7.9.B---9---',
    },
    arp: { a: '0123212301232123', b: '03120312' },
    song: [
      [2, 'intro', null, null, 'a', true, 'riser'],
      [4, 'drive', 'drive', null, 'a', true, 'crash'],
      [4, 'drive', 'drive', 'a', 'a', true],
      [4, 'blast', 'blast', 'b', 'b', true, 'crash'],
      [4, 'blast', 'blast', 'b', 'b', true],
      [4, 'half', 'drive', 'a', 'a', true, 'riser'],
      [4, 'drive', 'drive', 'a', 'a', true, 'crash'],
      [4, 'blast', 'blast', 'b', 'b', true, 'crash'],
      [4, 'blast', 'blast', 'b', 'b', true],
      [4, 'half', 'drive', 'a', 'a', true, 'riser'],
      [4, 'blast', 'blast', 'b', 'b', true, 'crash'],
      [4, 'drive', 'drive', 'a', 'a', true],
      [4, 'blast', 'blast', 'b', 'b', true],
      [4, 'blast', 'blast', 'b', 'b', true, 'crash'],
      [4, 'drive', 'drive', 'a', 'a', true],
      [4, 'blast', 'blast', 'b', 'b', true],
      [4, 'intro', 'drive', null, 'a', true],
    ],
    loop: 1,
  },

  prismCore: {
    name: 'Prism Core', bpm: 145, root: 52, scale: 'lydian', prog: [0, 1, 0, 1, 5, 4, 1, 1],
    inst: { bass: { type: 'sawtooth', cutoff: 1100, q: 6 }, lead: { type: 'square', cutoff: 3600, detune: 8, delay: 0.3 }, arp: { type: 'triangle', delay: 0.3, decay: 0.2 }, pad: { cutoff: 2000 } },
    drums: {
      intro: { k: 'x.......x.......', h: '..o...o...o...o.' },
      main: { k: FOUR, c: BACK, h: 'x.o.x.o.x.o.x.o.' },
      peak: { k: 'x...x...x...x.x.', s: BACK, c: BACK, h: 'xxoxxxoxxxoxxxox' },
    },
    bass: { main: '0.0.0.0.0.0.0.0.', peak: '0.00.00.0.00.07.' },
    lead: {
      a: '4.6.7.9.7.6.4...5.7.8.A.8.7.5...4.6.7.9.B.9.7.6.8---7---5---4---',
      b: 'B.9.B.9.7.9.7.6.A.8.A.8.7.8.7.5.B.9.B.D.B.9.7.9.A---9---8---7---',
    },
    arp: { a: '0123432101234321', b: '0213' },
    song: [
      [2, 'intro', null, null, 'a', true, 'riser'],
      [4, 'main', 'main', null, 'a', true, 'crash'],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'peak', 'peak', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', 'a', 'a', true],
      [4, 'peak', 'peak', 'b', 'b', true, 'crash'],
      [4, 'intro', 'main', 'a', 'a', true, 'riser'],
      [4, 'peak', 'peak', 'b', 'b', true, 'crash'],
      [4, 'main', 'main', 'a', 'a', true],
    ],
    loop: 1,
  },

  menu: {
    name: 'Neon Lounge', bpm: 108, root: 51, scale: 'major', prog: [0, 5, 3, 4],
    inst: { bass: { type: 'triangle', cutoff: 600, sub: 0.7 }, lead: { type: 'triangle', cutoff: 2400, detune: 5, vibrato: true, delay: 0.4, attack: 0.02 }, arp: { type: 'triangle', delay: 0.4, decay: 0.35 }, pad: { cutoff: 1100, attack: 0.6 } },
    drums: {
      soft: { k: 'x.......x.......', s: '........x.......', h: '..x...x...x...x.' },
      air: { h: '..x...x...x...x.' },
    },
    bass: { main: '0.......0...4...' },
    lead: { a: '4---2---4-5-7---6---5---4---2---3---2---0---2-3-4-------2-------' },
    arp: { a: '0.1.2.3.4.3.2.1.' },
    song: [
      [4, 'air', 'main', null, 'a', true],
      [8, 'soft', 'main', 'a', 'a', true],
      [4, 'soft', 'main', null, 'a', true],
    ],
    loop: 0,
  },

  editor: {
    name: 'Blueprint', bpm: 84, root: 50, scale: 'major', prog: [0, 3, 5, 4],
    inst: { bass: { type: 'sine', cutoff: 400, sub: 0.9 }, lead: { type: 'sine', cutoff: 2000, delay: 0.5 }, arp: { type: 'sine', delay: 0.5, decay: 0.6 }, pad: { cutoff: 800, attack: 1.2, release: 1.2, type: 'triangle' } },
    drums: { none: {} },
    bass: { main: '0---------------' },
    lead: {},
    arp: { a: '0.......2.......3.......1.......' },
    song: [[8, 'none', 'main', null, 'a', true]],
    loop: 0,
  },

  jingle: {
    name: 'Level Complete', bpm: 132, root: 60, scale: 'major', prog: [0, 3, 4, 0],
    inst: { bass: { type: 'sawtooth', cutoff: 900 }, lead: { type: 'square', cutoff: 3000, detune: 6, delay: 0.3 }, arp: { type: 'triangle', delay: 0.3 }, pad: { cutoff: 1600 } },
    drums: { hit: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.' } },
    bass: { main: '0.0.0.0.0.0.0.0.' },
    lead: { a: '0.2.4.7---4.7.9---7.9.B.E-------' },
    arp: { a: '0123' },
    song: [[2, 'hit', 'main', 'a', 'a', true]],
    loop: -1,
  },
};

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

/** Song ids selectable for custom levels (editor), in display order. */
export const LEVEL_SONGS = ['firstSteps', 'neonSkyline', 'gravityWell', 'pulseReactor', 'waveRunner', 'mirrorMaze', 'sawFactory', 'finalDescent', 'prismCore'];

/** Decodes a degree character; returns null for rests and 'hold' for '-'. */
export function degree(ch) {
  if (ch === '.' || ch === undefined || ch === ' ') return null;
  if (ch === '-') return 'hold';
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 69) return c - 55;
  if (c >= 97 && c <= 103) return -(c - 96);
  return null;
}

/** Semitone offset of a scale step (may be negative or span octaves). */
export function stepSemis(scale, n) {
  const s = SCALES[scale] || SCALES.major;
  const o = Math.floor(n / 7);
  return s[((n % 7) + 7) % 7] + 12 * o;
}

/** Total song length in seconds (one pass, without looping). */
export function songLength(id) {
  const t = TRACKS[id];
  if (!t) return 0;
  const bars = t.song.reduce((a, s) => a + s[0], 0);
  return (bars * 4 * 60) / t.bpm;
}
