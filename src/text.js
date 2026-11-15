// The "how it works" cards, shown the first time each idea turns up.
const touch = () => matchMedia('(pointer: coarse)').matches;
// Devices with both a touchscreen and a mouse get both sets of instructions.
const both = () => matchMedia('(any-pointer: coarse)').matches && matchMedia('(any-pointer: fine)').matches;
const TOUCH_HOW = 'The <b>Turn / Leaf</b> switch at the bottom decides what a tap does. On <b>Leaf</b>, a tap lays a leaf and <b>press and hold</b> turns the tile; on <b>Turn</b> it is the other way round. After you turn a tile the switch goes back to Leaf; you can change that in Settings. Tap a number to clear around it once its leaves are placed. Pinch to zoom, drag to move a large garden.';
const MOUSE_HOW = '<b>Left-click</b> turns a tile. <b>Right-click</b> lays a leaf. Click a number to clear around it once its leaves are placed. Scroll to zoom.';

export const RULES = {
  basics: {
    title: 'Hush, they are sleeping',
    body: () => `
      <p>Dormice are asleep under some of these tiles. Turn over every tile that has <b>nobody</b> under it and the garden is yours.</p>
      <p>A <b>number</b> tells you how many sleepers hide in the tiles touching it. No number means none, and the game opens those neighbours for you.</p>
      <p>When you are sure a tile hides a sleeper, lay a <b>leaf</b> on it so you do not turn it by accident.</p>
      ${both() ? `<p class="how">With a mouse: ${MOUSE_HOW}</p><p class="how">By touch: ${TOUCH_HOW}</p>` : `<p class="how">${touch() ? TOUCH_HOW : MOUSE_HOW}</p>`}
      <p>Wake a dormouse and you lose a heart. Stuck? The <b>Hint</b> button shows the next step and explains why it works.</p>`,
  },
  hex: {
    title: 'Honeycomb',
    body: () => `<p>Six-sided tiles touch <b>six</b> neighbours, so numbers run from 1 to 6. Everything else works the way you know.</p>`,
  },
  tri: {
    title: 'The trellis',
    body: () => `<p>A triangle counts every tile that shares a <b>corner</b> with it: twelve in all, not just the three along its sides.</p>
      <p>${touch() ? 'Press and hold' : 'Hover over'} a number to see exactly which tiles it is counting.</p>`,
  },
  counts: {
    title: 'Flowerbeds',
    body: () => `<p>The garden is planted in coloured beds. The chips above the board show how many sleepers each colour <b>still hides</b>.</p>
      <p>When a colour reaches 0, everything left in it is safe. When it has as many tiles left as sleepers, every one of them is taken.</p>`,
  },
  lines: {
    title: 'Row by row',
    body: () => `<p>A number in a small circle beside the board counts the sleepers along a whole <b>straight line</b> of tiles, starting next to it.</p>
      <p>${touch() ? 'Tap' : 'Click'} the circle to see its line. Once your leaves along the line make up its number, that also turns the rest of the line. A 0 clears its line straight away.</p>`,
  },
  split: {
    title: 'Sun and shade',
    body: () => `<p>Tiles lie in the sun (amber) or in the shade (blue). Each clue now shows <b>two numbers</b>: the left one counts neighbours in the sun, the right one neighbours in the shade.</p>
      <p>Two small clues are often easier than one big one.</p>`,
  },
  owls: {
    title: 'Owl watch',
    body: () => `<p>A number inside a <b>ring</b> belongs to an owl. Owls see further: they count every tile within <b>two steps</b>, not only the ones touching.</p>
      <p>${touch() ? 'Press and hold' : 'Hover over'} an owl to see its whole view.</p>`,
  },
  twins: {
    title: 'Twin nests',
    body: () => `<p>Tiles marked with <b>two dots</b> are twin nests. They hold two sleepers or none at all.</p>
      <p>Clues and the counter count sleepers, so a full twin nest adds 2.</p>`,
  },
};
