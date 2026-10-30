// Every keyboard shortcut, grouped. Shown on the title screen and in the pause menu.
export const CONTROLS = [
  ['Moving', [
    ['W A S D', 'Walk'],
    ['Mouse / arrows', 'Look around'],
    ['2-finger drag', 'Look around (trackpad)'],
    ['Pinch', 'Zoom in / out'],
    ['Shift', 'Sprint'],
    ['Space', 'Jump'],
  ]],
  ['Cat actions', [
    ['R / Click', 'Scratch'],
    ['E', 'Hiss'],
    ['Q', 'Meow'],
    ['G', 'Pick up / drop item'],
    ['T', 'Talk / interact / shop'],
    ['F', 'Get in a car'],
  ]],
  ['Driving', [
    ['W / S', 'Gas / brake'],
    ['A / D', 'Steer'],
    ['Space', 'Handbrake'],
    ['H', 'Horn'],
    ['F', 'Get out'],
  ]],
  ['Menus', [
    ['Esc or `', 'This menu'],
    ['Tab', 'Quest log'],
    ['I', 'Inventory'],
    ['C', 'Character & skills'],
    ['M', 'Map'],
    ['1 - 5', 'Use hotbar item'],
    ['P', 'Pixel size'],
  ]],
];

export function controlsHTML() {
  return CONTROLS.map(([group, rows]) => `<div class="cgroup"><h4>${group}</h4>${rows
    .map(([k, d]) => `<div class="crow"><kbd>${k}</kbd><span>${d}</span></div>`)
    .join('')}</div>`).join('');
}
