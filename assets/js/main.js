(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // glow follows the mouse
  const spot = document.querySelector('.spotlight');
  window.addEventListener('pointermove', e => {
    spot.style.setProperty('--mx', e.clientX + 'px');
    spot.style.setProperty('--my', e.clientY + 'px');
  });

  // nav hides on scroll down, comes back on scroll up
  const nav = document.getElementById('nav');
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('shadow', y > 10);
    nav.classList.toggle('hide', y > lastY && y > 200 && !menu.classList.contains('open'));
    lastY = y;
    updateTimeline();
  }, { passive: true });

  // mobile menu
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', false);
  }));

  // reveal on scroll, with a small stagger inside card grids
  document.querySelectorAll('.cards .card').forEach((c, i) => { c.style.transitionDelay = (i % 3) * 90 + 'ms'; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        en.target.querySelectorAll('rect[data-w]').forEach((r, i) => {
          setTimeout(() => { r.style.width = r.dataset.w + 'px'; }, reduce ? 0 : 150 + i * 120);
          setTimeout(() => r.setAttribute('width', r.dataset.w), reduce ? 0 : 1500 + i * 120);
        });
        if (en.target.querySelector('.num') || en.target.classList.contains('num')) countUp();
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  // once revealed, drop the stagger so hover feels instant
  document.querySelectorAll('.cards .card').forEach(c => c.addEventListener('transitionend', () => { c.style.transitionDelay = '0ms'; }, { once: true }));

  // numbers count up
  let counted = false;
  function countUp() {
    if (counted) return; counted = true;
    document.querySelectorAll('.num').forEach(el => {
      const to = +el.dataset.to, plus = el.dataset.plus ? '+' : '';
      if (reduce) { el.textContent = to.toLocaleString('en') + plus; return; }
      const t0 = performance.now(), dur = 1400;
      (function step(t) {
        const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(to * e).toLocaleString('en') + (p === 1 ? plus : '');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  // active section in the nav
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href')));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => s && spy.observe(s));

  // timeline line fills as you scroll through it
  const tl = document.querySelector('.timeline');
  function updateTimeline() {
    if (!tl) return;
    const r = tl.getBoundingClientRect(), vh = window.innerHeight;
    const p = Math.max(0, Math.min(1, (vh * 0.7 - r.top) / r.height));
    tl.style.setProperty('--progress', (p * 100).toFixed(1) + '%');
  }
  updateTimeline();

  // hero: sources -> ingest -> validate -> warehouse -> serve; bad rows are held back at the gate
  const cv = document.getElementById('graph');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const C = {};
  function readColours() {
    const css = getComputedStyle(document.documentElement);
    const v = n => css.getPropertyValue(n).trim();
    Object.assign(C, { accent: v('--accent'), warn: v('--warn'), line: v('--edge-box'), ink: v('--ink'), muted: v('--muted'), surface: v('--surface'), soft: v('--accent-soft') });
    const h = C.accent.replace('#', '');
    C.rgb = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)).join(',');
  }
  readColours();
  const sources = ['APIs', 'Files', 'Feeds', 'Events'];
  let W, H, N, rows = [], loaded = 0, held = 0, glow = { ingest: 0, gate: 0, wh: 0, serve: 0 };

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mid = H * 0.44;
    N = {
      src: sources.map((s, i) => ({ x: Math.max(W * 0.16, 64), y: H * (0.14 + i * 0.2) })),
      ingest: { x: W * 0.36, y: mid },
      gate: { x: W * 0.56, y: mid },
      wh: { x: W * 0.76, y: mid },
      serve: { x: W * 0.93, y: mid },
      quarantine: { x: W * 0.56, y: H * 0.86 }
    };
  }

  function path(r) {
    const s = N.src[r.src];
    return r.bad
      ? [s, N.ingest, N.gate, N.quarantine]
      : [s, N.ingest, N.gate, N.wh, N.serve];
  }

  function spawn() {
    if (Math.random() < 0.07) rows.push({ src: Math.floor(Math.random() * sources.length), seg: 0, p: 0, v: 0.011 + Math.random() * 0.006, bad: Math.random() < 0.12 });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.line;
    N.src.forEach(s => line(s, N.ingest));
    line(N.ingest, N.gate); line(N.gate, N.wh); line(N.wh, N.serve);
    ctx.setLineDash([3, 5]); ctx.strokeStyle = C.warn; ctx.globalAlpha = 0.5; line(N.gate, N.quarantine); ctx.setLineDash([]); ctx.globalAlpha = 1;

    if (!reduce) spawn();
    rows = rows.filter(r => {
      const P = path(r);
      r.p += r.v;
      if (r.p >= 1) {
        r.seg++; r.p = 0;
        const at = P[r.seg];
        if (at === N.ingest) glow.ingest = 1;
        if (at === N.gate) glow.gate = 1;
        if (at === N.wh) { glow.wh = 1; loaded++; }
        if (r.seg >= P.length - 1) { if (r.bad) held++; else glow.serve = 1; return false; }
      }
      const a = P[r.seg], b = P[r.seg + 1];
      const x = a.x + (b.x - a.x) * r.p, y = a.y + (b.y - a.y) * r.p;
      const red = r.bad && r.seg >= 2;
      ctx.fillStyle = red ? C.warn : C.accent;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      return true;
    });
    for (const k in glow) glow[k] *= 0.93;

    ctx.font = '12px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    N.src.forEach((s, i) => {
      box(s.x, s.y, 14, 14, 0, false);
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(sources[i], s.x - 14, s.y);
    });
    box(N.ingest.x, N.ingest.y, 22, 22, glow.ingest, false);
    label('ingest', N.ingest, 32);
    gate(N.gate.x, N.gate.y, glow.gate);
    label('validate', N.gate, 32);
    cylinder(N.wh.x, N.wh.y, glow.wh);
    label('warehouse', N.wh, 36);
    box(N.serve.x, N.serve.y, 18, 18, glow.serve, true);
    ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText('serve', N.serve.x, N.serve.y + 30);
    ctx.fillStyle = C.warn; ctx.fillText('held for review: ' + held, N.quarantine.x, N.quarantine.y + 18);
    ctx.fillStyle = C.accent; ctx.fillText('rows loaded: ' + loaded, N.wh.x, N.wh.y - 40);

    if (!reduce) requestAnimationFrame(draw);
  }

  function line(a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function label(t, n, dy) { ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.fillText(t, n.x, n.y + dy); }
  function halo(x, y, r, g) {
    if (g > 0.02) { ctx.beginPath(); ctx.fillStyle = `rgba(${C.rgb},${0.22 * g})`; ctx.arc(x, y, r + 12 * g, 0, Math.PI * 2); ctx.fill(); }
  }
  function box(x, y, w, h, g, filled) {
    halo(x, y, Math.max(w, h) * 0.75, g);
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 4);
    ctx.fillStyle = filled ? C.accent : C.surface; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.accent; ctx.stroke();
  }
  function gate(x, y, g) {
    halo(x, y, 16, g);
    ctx.beginPath(); ctx.moveTo(x, y - 18); ctx.lineTo(x + 18, y); ctx.lineTo(x, y + 18); ctx.lineTo(x - 18, y); ctx.closePath();
    ctx.fillStyle = C.surface; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.accent; ctx.stroke();
  }
  function cylinder(x, y, g) {
    const w = 34, h = 36, ry = 6;
    halo(x, y, 22, g);
    ctx.fillStyle = C.soft; ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x - w / 2, y + h / 2);
    ctx.ellipse(x, y + h / 2, w / 2, ry, 0, Math.PI, 0, true); ctx.lineTo(x + w / 2, y - h / 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - h / 2, w / 2, ry, 0, 0, Math.PI * 2); ctx.fillStyle = C.surface; ctx.fill(); ctx.stroke();
  }

  window.addEventListener('resize', layout);
  layout();
  requestAnimationFrame(draw);
})();
