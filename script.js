// Mobile menu
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
toggle.addEventListener('click', () => {
  const open = links.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  links.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Reveal on scroll
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Animated counters
const counterIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = Number(el.dataset.count);
    const start = performance.now();
    const dur = 1400;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ar-EG');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    counterIO.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => counterIO.observe(el));

// Portfolio filters
const filters = document.querySelectorAll('.filter');
const items = document.querySelectorAll('.work__item');
filters.forEach(btn => btn.addEventListener('click', () => {
  filters.forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  const f = btn.dataset.filter;
  items.forEach(it => it.classList.toggle('is-hidden', f !== 'all' && it.dataset.cat !== f));
}));

// Contact form (client-side validation; connect to a backend or form service to receive submissions)
const form = document.getElementById('contactForm');
const msg = document.getElementById('formMsg');
form.addEventListener('submit', e => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll('[required]').forEach(f => {
    const ok = f.value.trim() !== '' && f.checkValidity();
    f.classList.toggle('invalid', !ok);
    if (!ok) valid = false;
  });
  if (!valid) {
    msg.textContent = 'يرجى تعبئة الحقول المطلوبة بشكل صحيح.';
    msg.className = 'form__msg err';
    return;
  }
  msg.textContent = 'شكراً لك! تم استلام طلبك وسنتواصل معك خلال 24 ساعة.';
  msg.className = 'form__msg ok';
  form.reset();
});

document.getElementById('year').textContent = new Date().getFullYear();
