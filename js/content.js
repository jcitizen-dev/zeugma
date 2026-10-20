// Operating content for the chamber (HPOTECH, "HPO Soft" tablet): checklist phases,
// reference cards, emergency procedures. Edit wording here.
import { fmtTemp } from './ui.js';
import { userName } from './state.js';

export const UVC_MINUTES = 20;
export const PAUSE_WARN_MIN = 8;
export const PAUSE_MAX_MIN = 10;
export const EAR_MAX_ATTEMPTS = 3;
export const TABLET_SLOTS = 25;

export const PHASES = [
  {
    id: 'power',
    short: 'Power',
    title: 'Power-up',
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
    ],
  },
  {
    id: 'tablet',
    short: 'Tablet',
    title: 'Tablet setup',
    subtitle: "The manufacturer's start sequence in HPO Soft.",
    items: [
      {
        id: 'tabUser',
        text: 'Tap the red icon (top left) and enter the name',
        detail: (s, a) => `Enter ${userName(s, a.userId)} so the session is saved under that profile in Saved Data.`,
      },
      { id: 'tabIntercom', text: 'Test the intercom both ways' },
      {
        id: 'protocol',
        text: 'Protocols → choose one → Activate → Yes',
        detail: 'Confirm it shows as the Active protocol, then go back to the Session page.',
      },
      { id: 'coolerLight', text: 'Turn on Cooler and Lighting' },
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
      { id: 'intercomOff', text: 'Intercom off before opening the door', detail: 'The door unlocks automatically at 0 kPa.' },
      { id: 'valveClose', text: 'Close the manual valve afterward', danger: true, detail: 'Important. Do not leave it open.' },
    ],
  },
  {
    id: 'post',
    short: 'Down',
    title: 'Power-down',
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
export const detailText = (item, s, a) => (typeof item.detail === 'function' ? item.detail(s, a) : item.detail || '');

export const phaseComplete = (p, a, s) =>
  p.reference ? !!a.during : p.items.every((i) => isOptional(i, s) || a.checks[i.id]);

export function currentPhaseIndex(a, s) {
  const i = PHASES.findIndex((p) => !phaseComplete(p, a, s));
  return i === -1 ? PHASES.length : i;
}

export const EAR_STEPS = [
  'Set ventilation to level 3.',
  'Still blocked: Pause → open the manual valve to drop ~5 kPa → close it snug → check in → resume.',
];

export const DURING_REMINDERS = [
  { title: 'Talking', text: 'Pull the mask away from your face to talk.' },
  { title: 'Air breaks', text: 'Automatic. Nothing to do.' },
  { title: 'Door hiss', text: 'Any hiss from the door: STOP the session and call Nick.', danger: true },
  { title: 'Oxygen', text: 'Chamber O₂ at 23% or higher: get out.', danger: true },
];

// Reference version for the Safety screen (includes the ear and pause rules).
export const DURING_REFERENCE = [
  { title: 'Ears', text: 'Ventilation level 3. Still blocked: Pause → valve down ~5 kPa → close snug → check in → resume. After 3 tries, end the session.' },
  { title: 'Pausing', text: `Never stay paused more than ${PAUSE_MAX_MIN} minutes under pressure. End the session instead.`, danger: true },
  ...DURING_REMINDERS,
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
    id: 'true',
    title: 'True emergency',
    lead: 'Stop, then open the valve as needed.',
    steps: ['Press Stop → Yes on the tablet.', 'Open the manual release valve as needed to bring the pressure down.'],
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

export const UNITS = [
  { title: 'Pressure', text: '100 kPa = 1 bar. For example, 140 kPa = 1.4 bar.' },
  { title: 'Chamber readings', text: 'O₂, temperature and humidity on the tablet measure the chamber air, not the gas in your mask.' },
];

export const neverList = (s) => [
  'Bring batteries or anything battery-powered into the chamber.',
  'Bring anything flammable.',
  'Wear shoes or jewelry, or carry sharp objects. No blue jeans; wear socks.',
  'Skip air breaks.',
  `Stay paused more than ${PAUSE_MAX_MIN} minutes under pressure. End the session instead.`,
  'Decompress fast. Open the manual valve gradually, in half-turns.',
  'Touch the oxygen demand regulator.',
  `Set the chiller below ${fmtTemp(s.chillerMin)}.`,
  'Change tablet Settings, except sensor calibration.',
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

export const TABLET_BACKUP_STEPS = [
  'Plug a USB drive into the tablet.',
  'Open Saved Data.',
  'Tap "Copy CSV Files to USB".',
  'Import the files into Zeugma: Log → Import tablet CSV.',
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
