import { db } from '../db.js';
import { EMERGENCIES, END_WAYS, DURING_REFERENCE, UNITS, neverList } from '../content.js';
import { primaryContact } from '../state.js';
import { esc, uid, callButton, refList, modal, confirmBox, toast } from '../ui.js';

export async function render(root, app) {
  const s = app.settings;
  const nick = primaryContact(s);
  const videos = (await db.all('videos')).sort((a, b) => a.title.localeCompare(b.title));

  root.innerHTML = `
    ${callButton(nick, { label: `Call installer · ${nick.name}`, big: true })}
    <button class="btn btn-block" data-act="contacts">All contacts</button>

    <h2 class="section-title">Emergencies</h2>
    ${EMERGENCIES.map(
      (em) => `<article class="card emergency">
        <h3>${esc(em.title)}</h3>
        <p class="em-lead">${esc(em.lead)}</p>
        <ol class="steps">${em.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        ${em.call ? `<div class="row">${callButton(nick)}<button class="btn btn-ghost" data-act="contacts">Other contacts</button></div>` : ''}
      </article>`,
    ).join('')}

    <h2 class="section-title">Four ways to end a session</h2>
    <ol class="card ways">${END_WAYS.map((w) => `<li><strong>${esc(w.title)}</strong><div class="muted small">${esc(w.text)}</div></li>`).join('')}</ol>

    <h2 class="section-title">During a session</h2>
    <div class="card">${refList(DURING_REFERENCE)}</div>

    <h2 class="section-title">Units & readings</h2>
    <div class="card">${refList(UNITS)}</div>

    <h2 class="section-title">Never</h2>
    <ul class="card never">${neverList(s).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

    <h2 class="section-title">Training videos</h2>
    <div class="stack">${videos.length ? videos.map(videoCard).join('') : '<div class="card muted">No videos yet. Add a link or attach a file.</div>'}</div>
    <button class="btn btn-block" data-act="add-video">+ Add training video</button>`;

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const v = videos.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'add-video' && (await editVideo(null))) app.rerender();
    if (b.dataset.act === 'edit-video' && (await editVideo(v))) app.rerender();
    if (b.dataset.act === 'play') playVideo(v, Number(b.dataset.t) || 0);
  };
}

export function parseStamps(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.match(/^\s*((?:\d+:)?\d{1,2}:\d{2})\s*[-–—:]?\s*(.*)$/))
    .filter(Boolean)
    .map((m) => ({ label: m[1], text: m[2].trim(), sec: m[1].split(':').reduce((a, n) => a * 60 + Number(n), 0) }));
}

const isDirectMedia = (url) => /\.(mp4|m4v|mov|webm)(\?|#|$)/i.test(url || '');

function linkAt(url, sec) {
  if (!sec) return url;
  try {
    const u = new URL(url);
    if (/youtu\.?be/.test(u.hostname)) u.searchParams.set('t', `${sec}s`);
    else u.hash = /vimeo\.com/.test(u.hostname) ? `t=${sec}s` : `t=${sec}`;
    return u.href;
  } catch {
    return url;
  }
}

function videoCard(v) {
  const stamps = parseStamps(v.timestamps);
  let source = 'Link';
  try {
    source = v.blob ? `Attached file · ${v.fileName || 'video'}` : new URL(v.url).hostname;
  } catch {
    /* keep default */
  }
  return `<article class="card stack video">
    <div class="task-head"><h3>${esc(v.title)}</h3><button class="btn btn-sm btn-ghost" data-act="edit-video" data-id="${v.id}">Edit</button></div>
    <div class="muted small">${esc(source)}</div>
    <div class="chips">
      <button class="chip-btn" data-act="play" data-id="${v.id}" data-t="0">▶ Play</button>
      ${stamps.map((st) => `<button class="chip-btn" data-act="play" data-id="${v.id}" data-t="${st.sec}"><span class="mono">${esc(st.label)}</span> ${esc(st.text)}</button>`).join('')}
    </div>
  </article>`;
}

function playVideo(v, sec) {
  if (!v.blob && !isDirectMedia(v.url)) {
    window.open(linkAt(v.url, sec), '_blank', 'noopener');
    return;
  }
  const src = v.blob ? URL.createObjectURL(v.blob) : v.url;
  const stamps = parseStamps(v.timestamps);
  const m = modal(
    `<h2>${esc(v.title)}</h2>
     <video controls playsinline preload="metadata" src="${esc(src)}${sec ? `#t=${sec}` : ''}"></video>
     ${stamps.length ? `<div class="chips">${stamps.map((st) => `<button class="chip-btn" data-t="${st.sec}"><span class="mono">${esc(st.label)}</span> ${esc(st.text)}</button>`).join('')}</div>` : ''}
     <button class="btn" data-close>Close</button>`,
    { onClose: () => v.blob && URL.revokeObjectURL(src) },
  );
  const video = m.el.querySelector('video');
  m.el.querySelector('.chips')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    video.currentTime = Number(b.dataset.t);
    video.play().catch(() => {});
  });
}

function editVideo(existing) {
  const v = existing ? { ...existing } : { id: uid(), title: '', url: '', timestamps: '' };
  return new Promise((resolve) => {
    let changed = false;
    const m = modal(
      `<h2>${existing ? 'Edit' : 'Add'} training video</h2>
      <form class="stack" id="vf">
        <label class="field"><span>Title</span><input name="title" required value="${esc(v.title)}"></label>
        <label class="field"><span>Link (YouTube, Vimeo, Drive, or a video file URL)</span>
          <input name="url" type="url" inputmode="url" placeholder="https://" value="${esc(v.url || '')}"></label>
        <div class="field"><span>…or attach a video file (kept on this phone only)</span>
          ${v.blob ? `<label class="checkline small"><input type="checkbox" name="removeFile"> Remove attached file (${esc(v.fileName || 'video')})</label>` : ''}
          <input type="file" name="file" accept="video/*"></div>
        <label class="field"><span>Timestamps, one per line, e.g. "2:15 Closing the door"</span>
          <textarea name="timestamps" rows="5">${esc(v.timestamps || '')}</textarea></label>
        <div class="row"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
        ${existing ? '<button type="button" class="btn btn-ghost btn-danger-text" data-act="del">Delete video</button>' : ''}
      </form>`,
      { onClose: () => resolve(changed) },
    );
    const form = m.el.querySelector('#vf');
    const f = form.elements;
    form.onsubmit = async (e) => {
      e.preventDefault();
      v.title = f.title.value.trim();
      v.url = f.url.value.trim();
      v.timestamps = f.timestamps.value;
      if (f.removeFile?.checked) {
        delete v.blob;
        delete v.fileName;
      }
      const file = f.file.files[0];
      if (file) {
        v.blob = file;
        v.fileName = file.name;
      }
      if (!v.url && !v.blob) {
        toast('Add a link or attach a file');
        return;
      }
      await db.put('videos', v);
      changed = true;
      m.close();
    };
    form.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
      if (await confirmBox(`Delete "${v.title}"?`, { ok: 'Delete', danger: true })) {
        await db.del('videos', v.id);
        changed = true;
        m.close();
      }
    });
  });
}
