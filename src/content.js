export const STAGES = [
  { id: 'meadow', name: 'Blissfully violent', file: 'hillside.exe', subtitle: 'A beautiful day to break a combo record.', color: '#d6f563' },
  { id: 'desk', name: 'After-school fight club', file: 'deskspace.exe', subtitle: 'Small fighters. Big stationery energy.', color: '#ffb779' },
  { id: 'night', name: 'Midnight connection', file: 'afterhours.exe', subtitle: 'One more round before you log off.', color: '#b8a1ff' },
];

export const MOVES = {
  jab: { key: '1', name: 'Rush', tag: 'QUICK STRING', damage: 19, duration: .28, reach: 270, knock: 22, stun: .38, words: ['jab', 'zip', 'pop', 'hit', 'bam', 'pow', 'tap', 'rip', 'snap', 'dart', 'rush', 'flash', 'quick', 'crack', 'spark', 'strike', 'burst', 'punch'] },
  heavy: { key: '2', name: 'Breaker', tag: 'BREAK GUARDS', damage: 38, duration: .52, reach: 260, knock: 72, stun: .65, words: ['crash', 'break', 'smash', 'clash', 'punch', 'crush', 'hammer', 'thunder', 'wreck', 'impact', 'shatter', 'power', 'heavy', 'breaker', 'force', 'quake'] },
  launch: { key: '3', name: 'Skyward', tag: 'LAUNCH + JUGGLE', damage: 23, duration: .4, reach: 300, knock: 18, stun: .5, words: ['rise', 'lift', 'soar', 'wind', 'high', 'send', 'boost', 'vault', 'upper', 'launch', 'elevate', 'spring', 'flight', 'skyward', 'ascend', 'leap'] },
  slam: { key: '4', name: 'Full stop', tag: 'AIR FINISHER', damage: 48, duration: .48, reach: 350, knock: 38, stun: .85, words: ['boom', 'drop', 'down', 'slam', 'dunk', 'fall', 'plunge', 'crater', 'finish', 'impact', 'ground', 'thump', 'flatten', 'collapse', 'strike'] },
};

export const DIFFICULTIES = {
  chill: { label: 'Chill', damage: .55, speed: .68, tell: 1.45 },
  normal: { label: 'Normal', damage: 1, speed: .86, tell: 1.12 },
  fierce: { label: 'Fierce', damage: 1.3, speed: 1.02, tell: .92 },
};

export const ENEMY_TYPES = {
  doodle: { name: 'Doodle', hp: 64, speed: 63, damage: 12, tell: 1.08, reach: 98, color: '#ff826e' },
  runner: { name: 'Skitter', hp: 48, speed: 108, damage: 10, tell: .84, reach: 100, color: '#bba3ff' },
  brute: { name: 'Blockhead', hp: 118, speed: 43, damage: 19, tell: 1.45, reach: 118, color: '#ffc16c' },
};

export const TUTORIAL = [
  { title: 'Your words hit hard.', body: 'Type the word below. Finish it to rush your target and attack.', goal: 'Land a Rush attack', action: 'jab' },
  { title: 'Send them skyward.', body: 'Press 3 to choose Skyward, then type its word. Your target goes airborne.', goal: 'Launch the dummy', action: 'launch' },
  { title: 'Put a full stop on it.', body: 'While the target is in the air, press 4 and type the word. Re-launch with 3 if they land.', goal: 'Land an aerial Full stop', action: 'slam' },
  { title: 'Make some space.', body: 'Tap Space to dash. Hold ← or → to choose a direction. You are invulnerable during the dash.', goal: 'Dodge once', action: 'dodge' },
  { title: 'Heavy words.', body: 'Press 2 and type its word to break a guard. Hold Shift to guard yourself; it uses stamina.', goal: 'Land a Breaker', action: 'heavy' },
  { title: 'You have the keyboard.', body: 'Training is now free play. Try Rush while the target is airborne. Tab switches targets; Esc opens the pause menu.', goal: 'Free play · no damage · no time limit', action: null },
];
