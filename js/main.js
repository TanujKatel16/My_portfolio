/* main.js — Portfolio interactions */

(function () {

  // ── Custom cursor ─────────────────────────────────────────
  const cursor = document.getElementById('cursor');
  let cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
  });

  const hoverEls = 'a, button, .project-item, .stack-pill, #cat-canvas';
  document.querySelectorAll(hoverEls).forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('big'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('big'));
  });

  // ── SHIFT → light/dark toggle ─────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Shift') document.body.classList.toggle('light');
  });

  // ── Live clock (IST / Guwahati) ───────────────────────────
  function updateClock() {
    const now  = new Date();
    const time = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
    const el = document.getElementById('clock');
    if (el) el.textContent = time;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Smooth scroll for nav links ───────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ── Scroll reveal ─────────────────────────────────────────
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('section, #cat-section').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // Immediately reveal hero (above fold)
  const hero = document.getElementById('hero');
  if (hero) {
    hero.style.opacity = '1';
    hero.style.transform = 'none';
  }

})();
