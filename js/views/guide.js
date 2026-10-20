import { GUIDE_META, GUIDE_SECTIONS } from '../guide.js';
import { esc } from '../ui.js';

// Remember where you were reading while the app stays open.
let savedScroll = 0;

export function render(root) {
  root.innerHTML = `
    <article class="guide">
      <header class="g-header">
        <div class="hero-kicker">Hyperbaric chamber</div>
        <h1>${esc(GUIDE_META.title)}</h1>
        <div class="muted small">${esc(GUIDE_META.date)} · ${esc(GUIDE_META.author)}</div>
      </header>
      <nav class="card g-toc" aria-label="Contents">
        <div class="muted small">Contents</div>
        <ol>${GUIDE_SECTIONS.map((s) => `<li><button type="button" data-goto="${s.id}">${esc(s.title)}</button></li>`).join('')}</ol>
      </nav>
      ${GUIDE_SECTIONS.map((s) => `<section class="g-section" id="g-${s.id}"><h2>${esc(s.title)}</h2>${s.html}</section>`).join('')}
    </article>
    <button type="button" class="g-top" data-goto="top" aria-label="Back to contents">↑ Contents</button>`;

  const topBtn = root.querySelector('.g-top');
  const onScroll = () => topBtn.classList.toggle('show', window.scrollY > 600);
  window.addEventListener('scroll', onScroll, { passive: true });

  root.onclick = (e) => {
    const b = e.target.closest('[data-goto]');
    if (!b) return;
    const target = b.dataset.goto === 'top' ? root.querySelector('.g-toc') : root.querySelector(`#g-${b.dataset.goto}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // The router scrolls to the top after rendering a new page; restore the reading position after that.
  if (savedScroll) setTimeout(() => window.scrollTo(0, savedScroll), 0);
  onScroll();
  return () => {
    savedScroll = window.scrollY;
    window.removeEventListener('scroll', onScroll);
  };
}
