/**
 * Regression level touching every mode and interactive object once. Not shown in the game;
 * used by tests and for visual checks (open ?showcase=1&bot=1).
 */
import { LevelBuilder } from '../../js/levels/builder.js';

const b = new LevelBuilder({
  id: 'showcase', name: 'Showcase', difficulty: 'normal', bpm: 120, song: 'pulseReactor',
  bg: 'circuit', ground: 'grid',
  palette: { bg: '#1b0a3d', ground: '#28105a', line: '#ffb000', obj: '#ff8a1f', deco: '#7df9ff' },
});

let x = 12;
// Pads and orbs (cube).
b.pad(x, 0, 'Yellow'); b.block(x + 4, 0, 6, 3); x += 14;
b.pad(x, 0, 'Pink'); b.spikes(x + 2, 0, 2); x += 8;
b.orb(x, 2, 'Yellow'); b.spikes(x - 1, 0, 3); x += 8;
b.orb(x, 2, 'Pink'); x += 6;
b.pad(x, 0, 'Red'); b.block(x + 6, 0, 4, 5); x += 16;
// Gravity: walk on a ceiling, then a green orb flips you up again.
b.portal('gravUp', x, 1.5); b.block(x - 2, 5, 22, 1);
b.spikes(x + 9, 4, 1, { rot: 180 });
b.portal('gravDown', x + 16, 3.5); x += 24;
b.orb(x, 1.5, 'Green'); b.block(x - 2, 5, 16, 1);
b.portal('gravDown', x + 12, 3.5); x += 18;

// Ship corridor with pillars and a saw.
b.portal('portalShip', x, 1.5); x += 6;
b.block(x + 4, 0, 1, 4); b.block(x + 12, 6, 1, 4); b.saw(x + 20, 5, 'M');
b.block(x + 28, 0, 1, 3); b.block(x + 28, 7, 1, 3); x += 36;

// Ball.
b.gate('portalBall', x, 4.5); x += 8;
b.spikes(x + 4, 0, 3); b.ceilSpikes(x + 12, 7, 3); b.spikes(x + 20, 0, 3); x += 28;

// UFO.
b.gate('portalUfo', x, 1.5, 0, 8); x += 6;
b.block(x + 4, 0, 2, 2); b.block(x + 12, 0, 2, 3); b.spikes(x + 18, 0, 4); x += 26;

// Wave zigzag between slopes.
b.gate('portalWave', x, 5); x += 6;
for (let i = 0; i < 3; i++) {
  b.block(x, 0, 4, 2); b.block(x + 4, 0, 1, 1);
  b.slope(x + 4, 1, { fx: true }); b.slope(x + 5, 0, { fx: true });
  b.block(x, 7, 4, 3);
  x += 10;
}

// Robot: high jump onto a tall block.
b.gate('portalRobot', x, 4.5); x += 6;
b.block(x + 4, 0, 6, 3); x += 16;

// Spider: teleport to the ceiling of a tunnel and back.
b.gate('portalSpider', x, 1.5); x += 6;
b.spikes(x + 4, 0, 6); b.spikes(x + 14, 7, 6, { rot: 180 }); x += 24;

// Swing.
b.gate('portalSwing', x, 1.5, 0, 8); x += 6;
b.block(x + 6, 0, 1, 4); b.block(x + 14, 6, 1, 4); x += 22;

// Mini cube, dual, mirror, speed, moving saw, triggers.
b.gate('portalCube', x, 5); x += 4;
b.portal('sizeMini', x, 1.5); x += 6;
b.spikes(x + 4, 0, 1); x += 8;
b.portal('sizeNormal', x, 1.5); x += 4;
b.portal('speed3', x, 1); x += 6;
b.portal('dualOn', x, 1.5); x += 10;
b.portal('dualOff', x, 1.5); b.portal('speed1', x + 2, 1); x += 6;
b.portal('mirrorOn', x, 1.5); x += 12;
b.portal('mirrorOff', x, 1.5); x += 6;
b.saw(x + 4, 1, 'S', { props: { path: { dx: 0, dy: 3, period: 1.5 } } });
x += 10;
b.inGroup(5, () => b.block(x + 6, 3, 3, 1));
b.trigger('trMove', x, { group: 5, dx: 0, dy: -3, duration: 0.4 });
b.trigger('trColor', x, { channel: 'bg', color: '#063a2a', duration: 1 });
b.trigger('trPulse', x + 2, { channel: 'obj', color: '#ffffff' });
b.trigger('trZoom', x + 2, { zoom: 0.85, duration: 0.6 });
b.trigger('trShake', x + 4, { strength: 6, duration: 0.3 });
b.trigger('trParticles', x + 4, { count: 30, color: '#ffd500', kind: 'confetti' }, 3);
x += 14;
b.coin(x, 2);
b.orb(x + 6, 1.5, 'Dash', { rot: -30 });
x += 16;
b.end(x);

export default b.build();
