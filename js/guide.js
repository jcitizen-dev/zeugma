// "Hyperbaric Chamber — Operation & Maintenance Guide" (Oct 19, 2026, @J.), as readable sections.
// Source: Desktop/Chamber/Zeugma— Operation & Maintenance Guide.pdf. Update both together.

export const GUIDE_META = {
  title: 'Operation & Maintenance Guide',
  date: 'Oct 19, 2026',
  author: '@J.',
};

const rows = (pairs) => `<dl class="g-rows">${pairs.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`;

export const GUIDE_SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    html: `
      <p>This guide turns the installer’s 8 walkthrough videos into steps you can follow. It is built from automatic transcripts, so the manufacturer’s manual, the installer’s PDF notes and the installer’s direct advice always take precedence.</p>
      <h3>Machines in the equipment area (power-up order)</h3>
      <ol class="g-machines">
        <li><strong>Electrical boxes (2)</strong><span>Power everything else.</span><em>Ready when: both switches on</em></li>
        <li><strong>Water chiller</strong><span>Cold water for the in-chamber AC.</span><em>Ready when: green Run light; set to 13 °C</em></li>
        <li><strong>Air dryer</strong><span>Removes moisture from the compressed air.</span><em>Ready when: green light (silent)</em></li>
        <li><strong>Chamber (PLC + tablets)</strong><span>Controls the session.</span><em>Ready when: green light, tablet booted</em></li>
        <li><strong>Air compressor</strong><span>Pressurizes the chamber.</span><em>Ready when: climbs to 7.5 bar, settles around 6.5 bar, then goes quiet</em></li>
        <li><strong>Oxygen concentrator</strong><span>Supplies oxygen to the mask.</span><em>Ready when: gauge reads 5 bar</em></li>
      </ol>
      <p><strong>Inside the chamber:</strong> tablet (mirrors the outside tablet), always-on microphone (small white dome), UVC motion sensor, emergency stop, call button, pressure gauge (MPa), two-way manual release valve, seat-back lever, footrest button, and the oxygen demand regulator (do not touch).</p>
      <p><strong>Units on screen:</strong> chamber pressure is in kPa (the highest preset, Wound, goes to 140 kPa). Temperature is in °C only.</p>
      <p>Full walkthrough videos and transcripts are in the <strong>Clean Audio</strong> folder; see the Video index at the end.</p>`,
  },
  {
    id: 'startup',
    title: 'Startup',
    html: `
      <p>Power up 5–10 minutes before every session so the chamber’s controller has time to boot and the oxygen can reach 5 bar.</p>
      <ol>
        <li><strong>Electrical boxes:</strong> flip both switches on.</li>
        <li><strong>Water chiller:</strong> flip the switch on the back. Wait for the clicking to stop (the motor booting up), then press <strong>Run/Stop</strong>. The green light means it’s running.
          <ul><li>Setpoint is 13 °C. You can adjust it, but <strong>never set it below 11.5 °C</strong>.</li></ul></li>
        <li><strong>Air dryer:</strong> press the on switch. The green light comes on; it makes no noise.</li>
        <li><strong>Chamber:</strong> flip the big red power switch. Green light on; the tablet starts booting.</li>
        <li><strong>Air compressor:</strong> flip its red switch. It runs up to 7.5 bar, drops back toward 6.5 bar and fluctuates. It’s ready about 20 seconds after it stops running.</li>
        <li><strong>Oxygen concentrator:</strong> flip the big red switch. <strong>Don’t start a session until its pressure gauge reads 5 bar.</strong></li>
        <li><strong>Tablet:</strong> an “abnormal shutdown” message will pop up. Tap <strong>OK</strong>. It’s a known software bug and doesn’t affect the chamber. Then tap anywhere to reach the main session page.</li>
      </ol>
      <h3>Tablet basics</h3>
      <p>Everything mirrors between the outside and inside tablets.</p>
      <ul>
        <li><strong>AC:</strong> on/off only. Cold air comes out at the bottom of the seat; the temperature is set on the chiller.</li>
        <li><strong>Lighting:</strong> pick a color, or turn it off to relax.</li>
        <li><strong>Oxygen % in the chamber air:</strong> normally 20–21%. The system vents automatically if it climbs. If it ever reads <strong>23% or higher, get out and call the installer.</strong></li>
        <li><strong>Automatic / Manual:</strong> always leave it on <strong>Automatic</strong> so the protocol switches between oxygen and air breaks for you.</li>
      </ul>`,
  },
  {
    id: 'session',
    title: 'Running a session',
    html: `
      <p>Pick a protocol, seal the door while pressing play, and let the protocol run on Automatic; use the vent, pause or manual valve only for ear trouble.</p>
      <h3>1. Choose a protocol</h3>
      <ol>
        <li>Tap <strong>Protocols</strong> and pick one (Brain Performance, Anti-Aging, TBI, Wound, etc.). Wound is the deepest, at 140 kPa.</li>
        <li>Tap <strong>Activate protocol → Yes</strong>.</li>
        <li>Check that the protocol name shows next to <strong>Active protocol</strong> at the top of the screen.</li>
        <li>Tap back to the <strong>Session</strong> page yourself; it won’t take you there.</li>
      </ol>
      <h3>2. Get in and seal the door</h3>
      <ul>
        <li><strong>Opening:</strong> slide the door out until it hits the door stopper, keeping it clear of the seal. Never drag the door along the seal; it tears easily.</li>
        <li><strong>Pinch hazard:</strong> from outside, open with your hand on the <strong>left side</strong> of the door, never on the hinge side.</li>
        <li><strong>Closing:</strong> slide the door all the way across until it stops, then push it in (pull it in from inside).</li>
        <li><strong>Mask:</strong> bottom strap behind your neck, top part behind your head, tighten with the two side straps. Only put it on once the session starts; it’s hard to breathe before oxygen is flowing.</li>
        <li><strong>Start:</strong> press <strong>Play</strong> while pulling the door closed from outside (about two fingers of pull), or pushing it from inside. Once a little pressure builds, the door seals itself.</li>
      </ul>
      <h3>3. Read the screen</h3>
      ${rows([
        ['kPa', 'Current chamber pressure'],
        ['Time', 'Top = total session length; bottom = elapsed'],
        ['Graph', 'Pressure over time. <strong>Green = oxygen</strong>, <strong>red = air break</strong> (normal air, keep the mask on)'],
        ['Oxygen / air-break time', 'Time on each so far and in total'],
        ['Step', 'Current protocol step, its target pressure and duration. The timer runs even while still pressurizing'],
        ['Compression / decompression speed', 'Shows 0 when holding pressure'],
      ])}
      <p>Pressure slowly drifts down about 2.5 kPa, then the compressor kicks back on to top it up. That’s normal.</p>
      <h3>4. Ear trouble (equalizing)</h3>
      <ol>
        <li>Tap <strong>Ventilation</strong> and use <strong>level 3</strong>. It vents air for about 30 seconds (like ascending slightly), and you can toggle it off once your ears clear.</li>
        <li>Still stuck? Tap <strong>Pause</strong>. Pressure holds and it switches to air. Ventilation doesn’t work while paused.</li>
        <li>Open the <strong>manual valve</strong> in small half turns to let a little air out, then close it until it’s just snug. Don’t overtighten.</li>
        <li>Tap <strong>Play</strong> to resume. It re-pressurizes and oxygen restarts.</li>
      </ol>
      <p>To equalize with the mask on, pull it down slightly. Try all of the above before stopping, because a stopped session can’t be resumed.</p>
      <h3>5. Talking</h3>
      <ul>
        <li>Turn on the <strong>intercom</strong>. The inside mic is always on; outside, <strong>hold the button</strong> to talk.</li>
        <li>Inside, <strong>pull the mask away from your mouth before talking</strong>. Talking into it disrupts the oxygen demand valve.</li>
        <li>Inside, the <strong>call button</strong> sounds an alarm outside to get someone’s attention without stopping the session.</li>
        <li><strong>Turn the intercom off before opening the door</strong>, or it screeches with feedback.</li>
      </ul>
      <h3>6. Air breaks</h3>
      <p>Never breathe oxygen continuously. Most protocols give the first air break after 25–35 minutes, then one every ~20 minutes. On Automatic this happens for you.</p>
      <h3>7. Ending a session</h3>
      <ol>
        <li>When the protocol finishes, it decompresses on its own. To end early, tap the red <strong>Stop</strong> button → <strong>Yes</strong>. It then decompresses slowly and safely, and can’t be paused or resumed.</li>
        <li><strong>Speed up the last stretch (optional):</strong> at about <strong>15 kPa</strong>, open the manual valve gradually. Turn until you hear a hiss, wait for it to fade, then turn a bit more. A thumb over the vent hole inside will feel suction. This saves about 8–10 minutes.</li>
        <li>The door won’t open until pressure is near zero. Push it back to the door stopper, keep your hand on the left side, and slide it open.</li>
        <li><strong>Close the manual valve afterward.</strong> It’s two-way, so inside and outside are the same valve. If left open, the next session won’t hold pressure.</li>
      </ol>`,
  },
  {
    id: 'protocols',
    title: 'Custom protocols',
    html: `
      <ol>
        <li><strong>Protocols → Create custom protocol</strong> → enter a name → <strong>Create</strong>.</li>
        <li>Add steps. For each, set the <strong>time</strong>, <strong>set pressure</strong>, <strong>compression level</strong> (easy / medium / hard: how fast it compresses) and <strong>oxygen</strong> (blue = on).</li>
        <li>Example from the training (140 kPa):
          <table class="g-table"><thead><tr><th>Step</th><th>Time</th><th>Pressure</th><th>O₂</th></tr></thead><tbody>
            <tr><td>1 (compress)</td><td>15 min</td><td>140 kPa</td><td>On</td></tr>
            <tr><td>2</td><td>20 min</td><td>140 kPa</td><td>On</td></tr>
            <tr><td>3 (air break)</td><td>5 min</td><td>140 kPa</td><td>Off</td></tr>
            <tr><td>4</td><td>20 min</td><td>140 kPa</td><td>On</td></tr>
            <tr><td>5 (air break)</td><td>5 min</td><td>140 kPa</td><td>Off</td></tr>
            <tr><td>6 (decompress)</td><td>15 min</td><td>0</td><td>Your choice</td></tr>
          </tbody></table></li>
        <li>Tap <strong>Update protocol → Yes</strong>. <strong>If you skip this, everything is lost.</strong></li>
      </ol>
      <p><strong>Tips:</strong> reaching 140 kPa takes 10–15 minutes, so give step 1 15 minutes. The last step must always be 0 kPa. Pressure adjusts in increments of 5, so slow down near 130 to avoid overshooting to 143. Compression level matters mostly on the first and last steps. Pre-built protocols can be opened from the dropdown arrow, edited, and saved the same way.</p>`,
  },
  {
    id: 'shutdown',
    title: 'Shutdown',
    html: `
      <p>After every session (or every other session), run the UVC light for 20 minutes with only the chamber and electrical boxes on, then power everything down.</p>
      <ol>
        <li>Confirm the session has ended and the <strong>manual valve is closed</strong>.</li>
        <li>Turn off the big machines: <strong>oxygen concentrator, air compressor, air dryer, water chiller</strong>.</li>
        <li>Leave the <strong>chamber</strong> and <strong>both electrical boxes</strong> on.</li>
        <li>On the tablet, turn on <strong>UVC</strong> and let it run <strong>20 minutes</strong> to kill bacteria. Close the door and don’t look at the light; it isn’t safe for skin or eyes. The motion sensor inside (the golf-ball dome) shuts it off automatically if someone gets in.</li>
        <li>Turn UVC off, then switch off the <strong>chamber</strong> and the <strong>electrical boxes</strong>.</li>
      </ol>
      <p class="g-note">The videos don’t show a full power-down order; steps 2 and 5 are the reverse of startup.</p>`,
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    html: `
      <p>Your only regular jobs are draining the compressor, emptying the dryer’s water, keeping the chiller topped up, and cleaning. Draining the compressor is the one people forget, and the installer can tell when it’s been skipped.</p>
      ${rows([
        ['Drain the air compressor', 'Every 5–6 sessions (about twice a week if two people use it daily)'],
        ['Empty the air dryer’s water container', 'Check after sessions; empty every 3–4 sessions or when it has an inch or so'],
        ['Check the water chiller level', 'Every session; keep at H'],
        ['Run UVC clean cycle', 'After every session or every other session (see Shutdown)'],
        ['Wipe down chamber and masks', 'As needed'],
        ['Filters, oxygen membrane, regulator', 'Yearly, done by the installer'],
      ])}
      <h3>Drain the air compressor</h3>
      <ol>
        <li>The compressor must be <strong>on</strong>. Its air pressure is what pushes the water out.</li>
        <li>Empty your container first, so the drained water doesn’t splash out of it.</li>
        <li>Pull the compressor out gently, watching that no cords get yanked.</li>
        <li>Put the drain tube into the container. Hold the tube and the cap together with a microfiber cloth so it doesn’t spray.</li>
        <li>Open the drain valve about <strong>45 degrees</strong> (a tool helps the first few times). It spits water and air alternately.</li>
        <li>Let it run about <strong>1 minute</strong>, then close the valve fully.</li>
        <li>Dry the tube, store it above the door, and push the compressor back toward the wall. Lift the cords and hoses so it doesn’t roll over them.</li>
      </ol>
      <p class="g-note">Tip: put a “Drain me” label on the compressor. Undrained tanks are a main cause of compressor failure.</p>
      <h3>Air dryer water</h3>
      <p>It drips water all the time into a container. Pull the container out, dump it outside, and put it back without pushing it in too far. A larger container (a cut-down bottle) works fine.</p>
      <h3>Water chiller</h3>
      <p>Keep the level at <strong>H</strong>; never let it drop below <strong>L</strong>. Top up with <strong>distilled water</strong> only (spare gallons are stored by the chamber).</p>
      <h3>Cleaning</h3>
      <ul>
        <li><strong>Two colors of microfiber cloth:</strong> one for the metal outside only, one for the acrylic windows only. The metal can carry tiny shavings from the bolts that will scratch the acrylic.</li>
        <li><strong>Acrylic:</strong> use only the supplied spray from the manufacturer. <strong>No Windex.</strong></li>
        <li><strong>Leather/seat:</strong> microfiber with mild dish soap and water. No harsh chemicals.</li>
        <li><strong>Lysol wipes:</strong> wait <strong>24 hours</strong> before using the chamber again so you’re not breathing fumes.</li>
        <li><strong>Masks:</strong> 6 in total (5 spares). Assign one per person.</li>
        <li>No blue jeans or indigo inside; the dye can stain the leather.</li>
      </ul>
      <h3>Tubing and spares</h3>
      <p>If water gets into the tubing, disconnect it, drain it and let it dry, or cut a new piece from the spares. <strong>Keep everything in the spares box</strong>, including the fuses for the back of the unit. Nothing in it should be thrown away.</p>`,
  },
  {
    id: 'safety',
    title: 'Safety and troubleshooting',
    html: `
      <p>The main rules: nothing flammable or battery-powered inside, always take air breaks, decompress slowly, and never touch the oxygen regulator or set the chiller below 11.5 °C.</p>
      <h3>Never</h3>
      <ul class="g-never">
        <li>Bring <strong>batteries</strong> or anything <strong>flammable</strong> inside.</li>
        <li>Wear <strong>shoes</strong>, <strong>jewelry</strong> or anything sharp. They tear the leather and scratch the acrylic. Wear socks.</li>
        <li>Skip <strong>air breaks</strong> or breathe oxygen continuously.</li>
        <li><strong>Decompress fast</strong>, except in a true emergency.</li>
        <li>Touch the <strong>oxygen demand regulator</strong> (the silver fitting overhead). Opening it makes oxygen free-flow and the system can run out. The installer adjusts it at the yearly service.</li>
        <li>Set the <strong>water chiller below 11.5 °C</strong>. Condensation builds on the fan inside and can ruin the floor and leather; one team set it to 8.5 °C and the chamber had to be taken apart. Keep 13 °C even on hot days, and keep a blanket inside instead.</li>
      </ul>
      <h3>If something goes wrong</h3>
      ${rows([
        ['Hiss or leak from the door during a session', 'Seal is damaged. <strong>Stop the session immediately and call the installer.</strong> Don’t use the chamber until it’s repaired.'],
        ['Chamber oxygen reads 23% or higher', 'Get out and call the installer.'],
        ['Power outage during a session', 'The system won’t remember the session. Decompress manually with the valve: a half turn until it hisses, wait for the hiss to fade, repeat, watching the pressure gauge. From 140 kPa this takes about 20 minutes. Don’t open it wide.'],
        ['True emergency (fire, medical episode)', 'Hit Stop or the emergency button, then open the manual valve as much as needed to get out.'],
        ['Emergency stop was pressed inside', 'It decompresses automatically. Before the next session, twist the button to release it, then tap <strong>Alarm Reset</strong> on the tablet.'],
        ['“Abnormal shutdown” message at startup', 'Tap OK. Known software bug; the installer is waiting on a fix from the manufacturer.'],
        ['Pressure drops a couple of kPa, then the compressor restarts', 'Normal.'],
        ['Hard to breathe through the mask before starting', 'Normal; oxygen isn’t flowing yet. Put the mask on after pressing Play.'],
        ['Intercom screeches', 'Turn the intercom off before opening the door.'],
      ])}
      <p><strong>Four ways to end a session:</strong> Stop on the outside tablet, Stop on the inside tablet, the inside emergency button, or the manual valve (power outage or emergency only).</p>`,
  },
  {
    id: 'videos',
    title: 'Video index',
    html: `
      <p>The cleaned videos (IMG_xxxx_clean.MOV) and transcripts are in <strong>Desktop → Chamber → Instructions and Maintanance → Clean Audio</strong>.</p>
      ${[
        ['IMG_2457', '4:04', 'Startup sequence', ['00:04 electrical boxes', '00:28 chiller', '01:34 dryer', '01:41 chamber', '01:48 compressor', '01:56 oxygen', '03:21 abnormal-shutdown message']],
        ['IMG_2458', '3:59', 'Tablet controls', ['00:10 AC', '00:58 UVC', '01:59 lighting', '02:25 oxygen %', '03:23 automatic vs manual']],
        ['IMG_2459', '13:56', 'Running a session', ['00:00 choosing a protocol', '02:02 door and seal', '03:45 starting', '04:26 reading the screen', '07:41 ventilation', '08:36 pause + manual valve', '10:29 intercom', '12:01 stopping']],
        ['IMG_2460', '9:29', 'Custom protocols, finishing at 15 kPa', ['00:04 create protocol', '04:29 air breaks', '06:29 update protocol (save)', '07:15 opening valve at 15 kPa', '08:27 close the valve']],
        ['IMG_2461', '19:26', 'Inside the chamber, live session', ['00:07 UVC sensor', '00:20 emergency stop + alarm reset', '01:23 call button', '02:10 pressure gauge + power outage', '03:40 seat and footrest', '04:47 oxygen regulator', '07:08 putting on the mask', '11:59 talking with the mask', '17:02 air breaks']],
        ['IMG_2462', '5:25', 'Safety rules, manual decompression', ['00:00 don’ts', '01:30 stop vs emergency', '02:27 venting from 15 kPa']],
        ['IMG_2463', '15:06', 'Maintenance', ['00:02 air dryer', '01:23 draining the compressor', '06:37 water chiller', '08:22 cleaning', '11:24 tubing and spares', '12:20 yearly service', '12:42 never below 11.5 °C']],
        ['IMG_2466', '0:18', 'Door seal leak', ['00:00 what to do']],
      ]
        .map(
          ([id, len, covers, stamps]) => `<div class="g-video">
            <div class="g-video-head"><strong>${id}</strong><span class="muted">${len}</span></div>
            <div>${covers}</div>
            <ul class="g-stamps">${stamps.map((st) => `<li><span class="mono">${st.slice(0, 5)}</span>${st.slice(5)}</li>`).join('')}</ul>
          </div>`,
        )
        .join('')}
      <p class="g-note">To play them from Zeugma, add each video under Safety → Training videos and paste these timestamps.</p>`,
  },
];
