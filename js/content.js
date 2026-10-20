// Operating content for the chamber: checklist phases, reference cards, emergency procedures.
import { fmtTemp } from './ui.js';

export const UVC_MINUTES = 20;

export const PHASES = [
  {
    id: 'pre',
    short: 'Prep',
    title: 'Pre-session',
    subtitle: 'Start 5–10 minutes before getting in.',
    items: [
      { id: 'boxes', text: 'Turn on both electrical boxes' },
      {
        id: 'chiller',
        text: 'Start the water chiller',
        detail: (s) =>
          `Flip the back switch, wait for the clicking to stop, press Run/Stop and confirm the green light. Setpoint must be ${fmtTemp(
            s.chillerSetpoint,
          )}, never below ${fmtTemp(s.chillerMin)}.`,
      },
      { id: 'chillerLevel', text: 'Chiller water level is at H', detail: 'If not, top up with distilled water.' },
      { id: 'dryer', text: 'Air dryer on', detail: 'Green light on.' },
      { id: 'mainPower', text: 'Chamber main power on', detail: 'Big red switch. Wait for the tablet to boot.' },
      { id: 'compressor', text: 'Air compressor on', detail: 'Wait until it reaches ~7.5 bar and goes quiet.' },
      { id: 'o2', text: 'Oxygen concentrator on', detail: 'Wait until the gauge reads 5 bar.' },
      { id: 'abnormal', text: 'Dismiss the "abnormal shutdown" message', detail: 'Known tablet bug.' },
      { id: 'valveClosed', text: 'Manual release valve is closed' },
      { id: 'auto', text: 'Mode is Automatic' },
      {
        id: 'safety',
        text: 'Safety check',
        danger: true,
        detail: 'No batteries, no flammables, no shoes, jewelry or sharp objects, no blue jeans. Wearing socks.',
      },
      { id: 'protocol', text: 'Select protocol → Activate', detail: 'Confirm it shows as the Active protocol.' },
    ],
  },
  {
    id: 'enter',
    short: 'Enter',
    title: 'Entering & starting',
    items: [
      { id: 'door', text: 'Open the door to the stopper', detail: 'Hand on the left side. Keep the door off the seal.' },
      {
        id: 'close',
        text: 'Close the door and press Play',
        detail: 'Slide fully, then push/pull in. Press Play while holding the door. The session timer starts when you tick this.',
      },
      { id: 'mask', text: 'Put on the mask (only after Play)', detail: 'Neck strap, head strap, then tighten the side straps.' },
      { id: 'intercom', text: 'Intercom on if someone is outside', optional: true },
    ],
  },
  { id: 'during', short: 'During', title: 'During the session', reference: true },
  {
    id: 'ending',
    short: 'End',
    title: 'Ending',
    items: [
      { id: 'stop', text: 'Protocol finished, or press Stop → Yes' },
      { id: 'speedup', text: 'At ~15 kPa, open the manual valve gradually to speed up', optional: true },
      { id: 'intercomOff', text: 'Intercom off before opening the door' },
      { id: 'valveClose', text: 'Close the manual valve afterward', danger: true, detail: 'Important. Do not leave it open.' },
    ],
  },
  {
    id: 'post',
    short: 'After',
    title: 'Post-session',
    items: [
      { id: 'offEquip', text: 'Turn off oxygen concentrator, air compressor, air dryer and chiller' },
      {
        id: 'uvc',
        text: `Run UVC for ${UVC_MINUTES} min with the door closed`,
        detail: 'Leave the chamber and electrical boxes on while it runs.',
        optional: (s) => s.uvcEvery > 1,
      },
      { id: 'allOff', text: 'Turn off UVC, chamber and electrical boxes' },
      { id: 'dryerCheck', text: 'Check the air dryer water container' },
      {
        id: 'dryerEmptied',
        text: 'I emptied the air dryer container',
        optional: true,
        detail: 'Tick only if you emptied it. This resets its maintenance counter.',
      },
    ],
  },
];

export const isOptional = (item, s) => (typeof item.optional === 'function' ? item.optional(s) : !!item.optional);
export const detailText = (item, s) => (typeof item.detail === 'function' ? item.detail(s) : item.detail || '');

export const phaseComplete = (p, a, s) =>
  p.reference ? !!a.during : p.items.every((i) => isOptional(i, s) || a.checks[i.id]);

export function currentPhaseIndex(a, s) {
  const i = PHASES.findIndex((p) => !phaseComplete(p, a, s));
  return i === -1 ? PHASES.length : i;
}

export const DURING_REFERENCE = [
  { title: 'Ears', text: 'Ventilation level 3 → Pause → manual valve in half-turns.' },
  { title: 'Talking', text: 'Pull the mask away from your face to talk.' },
  { title: 'Air breaks', text: 'Automatic. Nothing to do.' },
  { title: 'Door hiss', text: 'Any hiss from the door: STOP the session and call the installer.', danger: true },
  { title: 'Oxygen', text: 'Chamber O₂ at 23% or higher: get out.', danger: true },
];

export const EMERGENCIES = [
  {
    id: 'door',
    title: 'Door hissing or leaking',
    lead: 'Stop the session and call the installer.',
    steps: ['Press Stop → Yes on the tablet.', 'Call the installer.'],
    call: true,
  },
  {
    id: 'o2',
    title: 'Chamber O₂ at 23% or higher',
    lead: 'Get out.',
    steps: ['End the session: Stop → Yes.', 'Leave the chamber once it has decompressed.', 'Call the installer.'],
    call: true,
  },
  {
    id: 'power',
    title: 'Power outage: manual decompression',
    lead: 'Decompress with the manual release valve.',
    steps: [
      'Open the manual release valve a half-turn.',
      'Wait for the hiss to fade.',
      'Repeat: half-turn, wait.',
      'Watch the pressure gauge until it reaches 0.',
      'From 140 kPa this takes about 20 minutes.',
    ],
  },
  {
    id: 'estop',
    title: 'Emergency stop reset',
    lead: 'After the emergency stop has been pressed:',
    steps: ['Twist the emergency stop button to release it.', 'Press Alarm Reset on the tablet.'],
  },
];

export const END_WAYS = [
  { title: 'Protocol finishes', text: 'The session ends on its own when the protocol reaches 0 kPa.' },
  { title: 'Stop → Yes', text: 'Press Stop on the tablet and confirm Yes. The chamber decompresses automatically.' },
  {
    title: 'Manual release valve',
    text: 'Half-turns, wait for the hiss to fade, repeat. Use it during a power outage, or at ~15 kPa to speed up the end.',
  },
  { title: 'Emergency stop', text: 'Red emergency stop button. Afterwards: twist to release, then Alarm Reset.' },
];

export const neverList = (s) => [
  'Bring batteries or anything battery-powered into the chamber.',
  'Bring anything flammable.',
  'Wear shoes or jewelry, or carry sharp objects.',
  'Wear blue jeans. Wear socks instead of shoes.',
  `Set the chiller below ${fmtTemp(s.chillerMin)}.`,
  'Put the mask on before pressing Play.',
  'Clean the acrylic windows with Windex. Use the supplied spray only.',
  'Open the door with the intercom on.',
  'Leave the manual release valve open after a session.',
  `Use the chamber within ${s.lysolHours} h of a Lysol wipe-down.`,
  'Ignore a hissing door. Stop and call.',
];

export const COMPRESSOR_STEPS = [
  'Leave the air compressor ON.',
  'Empty the collection container first.',
  'Pull the compressor out carefully.',
  'Put the tube into the container, holding it in place with a microfiber cloth.',
  'Open the drain valve about 45° for about 1 minute.',
  'Close the valve fully.',
  'Push the compressor back without rolling over the cords.',
];

export function wipeSteps(s) {
  const cloth = (c) => (c ? `the ${c} cloth` : 'its dedicated cloth (set the colour in Settings)');
  return [
    `Acrylic windows: supplied spray only, never Windex. Use ${cloth(s.clothAcrylic)}.`,
    `Metal: use ${cloth(s.clothMetal)}.`,
    'Leather: mild dish soap and water.',
    `Lysol wipes: the chamber is unusable for ${s.lysolHours} h afterwards. Zeugma locks Start session.`,
  ];
}
