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

// ---------- Mock tests ----------
const BANK = window.NAFES_BANK;
const LEVELS = { k: 'معرفة', a: 'تطبيق', r: 'استدلال' };
const GRADES = { 3: 'الثالث الابتدائي', 6: 'السادس الابتدائي', 9: 'الثالث المتوسط' };
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

// Display numbers with Arabic-Indic digits, Arabic decimal separator and percent sign.
const fmt = s => String(s)
  .replace(/(\d)\.(\d)/g, '$1٫$2')
  .replace(/%/g, '٪')
  .replace(/\d/g, d => AR_DIGITS[d]);

// Arabic counted noun: ٣–١٠ أسئلة، ١١–٩٩ سؤالاً، ١٠٠ سؤال
function qCount(n) {
  const r = n % 100;
  if (n === 1) return 'سؤال واحد';
  if (n === 2) return 'سؤالان';
  if (r >= 3 && r <= 10) return fmt(n) + ' أسئلة';
  if (r >= 11) return fmt(n) + ' سؤالاً';
  return fmt(n) + ' سؤال';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const gradesOf = subj => [...new Set(BANK[subj].items.map(q => q.g))].sort((x, y) => x - y);

const card = document.getElementById('quizCard');
const tabsWrap = document.getElementById('subjectTabs');
let subject = 'math';
let setup = { grade: 'all', domain: 'all', count: '10' };
let run = null;
let timer = null;

function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function elapsed() { return Math.floor((Date.now() - run.start) / 1000); }
function clock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return fmt(`${m}:${String(s).padStart(2, '0')}`);
}

function pool() {
  return BANK[subject].items.filter(q =>
    (setup.grade === 'all' || q.g === Number(setup.grade)) &&
    (setup.domain === 'all' || q.d === setup.domain));
}

// Tabs
Object.entries(BANK).forEach(([key, s]) => {
  const b = el('button', 'filter', `${s.icon} ${s.name}`);
  b.dataset.subject = key;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => {
    subject = key;
    setup = { grade: 'all', domain: 'all', count: setup.count };
    renderSetup();
  });
  tabsWrap.append(b);
});

function syncTabs() {
  tabsWrap.querySelectorAll('[data-subject]').forEach(t => {
    const on = t.dataset.subject === subject;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
}

function selectField(label, name, options, value) {
  const wrap = el('label', 'quiz__field');
  wrap.append(el('span', null, label));
  const sel = el('select');
  sel.name = name;
  options.forEach(([v, t]) => {
    const o = el('option', null, t);
    o.value = v;
    if (String(v) === String(value)) o.selected = true;
    sel.append(o);
  });
  wrap.append(sel);
  return [wrap, sel];
}

function renderSetup() {
  stopTimer();
  run = null;
  syncTabs();
  const S = BANK[subject];
  card.replaceChildren();

  card.append(el('h3', 'quiz__title', `إعدادات اختبار ${S.name}`));
  const grid = el('div', 'quiz__setup');
  const [gWrap, gSel] = selectField('الصف', 'grade',
    [['all', 'جميع الصفوف'], ...gradesOf(subject).map(g => [g, 'الصف ' + GRADES[g]])], setup.grade);
  const [dWrap, dSel] = selectField('المعيار', 'domain',
    [['all', 'جميع المعايير'], ...Object.entries(S.domains).map(([k, d]) => [k, d.name])], setup.domain);
  const [cWrap, cSel] = selectField('عدد الأسئلة', 'count',
    [['10', qCount(10)], ['20', qCount(20)], ['30', qCount(30)], ['all', 'جميع الأسئلة المتاحة']], setup.count);
  grid.append(gWrap, dWrap, cWrap);

  const info = el('p', 'quiz__info');
  const desc = el('p', 'quiz__desc');
  const startBtn = el('button', 'btn btn--primary', 'ابدأ الاختبار');
  startBtn.type = 'button';

  const update = () => {
    setup = { grade: gSel.value, domain: dSel.value, count: cSel.value };
    const n = pool().length;
    const take = setup.count === 'all' ? n : Math.min(n, Number(setup.count));
    info.textContent = n
      ? 'الأسئلة المتاحة: ' + fmt(n) + ' — سيتضمن الاختبار ' + qCount(take)
      : 'لا توجد أسئلة بهذه الإعدادات.';
    desc.textContent = setup.domain === 'all' ? '' : S.domains[setup.domain].desc;
    startBtn.disabled = n === 0;
  };
  [gSel, dSel, cSel].forEach(x => x.addEventListener('change', update));
  startBtn.addEventListener('click', startRun);
  update();

  card.append(grid, desc, info, startBtn);
}

function startRun() {
  let list = shuffle(pool());
  if (setup.count !== 'all') list = list.slice(0, Number(setup.count));
  // Keep questions about the same reading passage together.
  const first = new Map();
  list.forEach((q, i) => { const k = q.p || q; if (!first.has(k)) first.set(k, i); });
  list.sort((x, y) => first.get(x.p || x) - first.get(y.p || y));

  run = { list, idx: 0, answers: [], start: Date.now() };
  stopTimer();
  timer = setInterval(() => {
    const t = document.getElementById('quizClock');
    if (t) t.textContent = '⏱ ' + clock(elapsed());
  }, 1000);
  renderQuestion();
  document.getElementById('practice').scrollIntoView({ block: 'start' });
}

function renderQuestion() {
  const S = BANK[subject];
  const { list, idx } = run;
  const item = list[idx];
  card.replaceChildren();

  const head = el('div', 'quiz__head');
  const clockEl = el('span', null, '⏱ ' + clock(elapsed()));
  clockEl.id = 'quizClock';
  head.append(el('span', null, fmt(`سؤال ${idx + 1} من ${list.length}`)), clockEl);
  const bar = el('div', 'mock__progress');
  const fill = el('span');
  fill.style.width = `${(idx / list.length) * 100}%`;
  bar.append(fill);

  const chips = el('div', 'quiz__chips');
  chips.append(
    el('span', 'chip', S.domains[item.d].name),
    el('span', 'chip chip--soft', LEVELS[item.l]),
    el('span', 'chip chip--soft', 'الصف ' + GRADES[item.g])
  );
  card.append(head, bar, chips);

  if (item.p) {
    const P = S.passages[item.p];
    const box = el('blockquote', 'quiz__passage');
    box.append(el('b', null, `اقرأ النص ثم أجب — «${P.title}»`), el('p', null, fmt(P.text)));
    card.append(box);
  }

  card.append(el('h3', 'quiz__q', fmt(item.q)));
  const opts = el('div', 'quiz__opts');
  const feedback = el('p', 'quiz__fb');
  const next = el('button', 'btn btn--primary', idx === list.length - 1 ? 'عرض النتيجة' : 'السؤال التالي');
  next.type = 'button';
  next.hidden = true;

  const order = shuffle(item.o.map((t, i) => i)); // index 0 is the correct answer
  order.forEach(i => {
    const b = el('button', 'quiz__opt', fmt(item.o[i]));
    b.type = 'button';
    b.dataset.i = i;
    b.addEventListener('click', () => {
      opts.querySelectorAll('button').forEach(x => {
        x.disabled = true;
        if (x.dataset.i === '0') x.classList.add('is-right');
      });
      const ok = i === 0;
      if (!ok) b.classList.add('is-wrong');
      run.answers.push({ item, ok, chosen: item.o[i] });
      const why = item.e ? ' ' + fmt(item.e) : '';
      feedback.textContent = ok
        ? '✔ إجابة صحيحة!' + why
        : '✘ إجابة غير صحيحة. الإجابة الصحيحة: ' + fmt(item.o[0]) + '.' + why;
      feedback.className = 'quiz__fb ' + (ok ? 'ok' : 'err');
      next.hidden = false;
      next.focus({ preventScroll: true });
    });
    opts.append(b);
  });

  next.addEventListener('click', () => {
    run.idx++;
    run.idx < list.length ? renderQuestion() : renderResult();
  });

  card.append(opts, feedback, next);
}

function breakdown(title, keyFn, nameFn) {
  const groups = new Map();
  run.answers.forEach(a => {
    const k = keyFn(a.item);
    const g = groups.get(k) || { ok: 0, n: 0 };
    g.n++; if (a.ok) g.ok++;
    groups.set(k, g);
  });
  const box = el('div', 'quiz__breakdown');
  box.append(el('h4', null, title));
  groups.forEach((g, k) => {
    const pct = Math.round((g.ok / g.n) * 100);
    const row = el('div', 'bd');
    const label = el('div', 'bd__label');
    label.append(el('span', null, nameFn(k)), el('span', 'bd__val', fmt(`${g.ok} من ${g.n} (${pct}%)`)));
    const track = el('div', 'bd__track');
    const fill = el('span', pct >= 80 ? 'is-high' : pct >= 50 ? 'is-mid' : 'is-low');
    fill.style.width = Math.max(pct, 3) + '%';
    track.append(fill);
    row.append(label, track);
    box.append(row);
  });
  return box;
}

function tally(keyFn) {
  const out = {};
  run.answers.forEach(a => {
    const k = keyFn(a);
    out[k] = out[k] || { ok: 0, n: 0 };
    out[k].n++; if (a.ok) out[k].ok++;
  });
  return out;
}

function renderResult() {
  stopTimer();
  const S = BANK[subject];
  const total = run.answers.length;
  const score = run.answers.filter(a => a.ok).length;
  const pct = Math.round((score / total) * 100);
  const msg = pct >= 80 ? 'ممتاز! مستواك متقدم 🌟'
    : pct >= 60 ? 'جيد جداً! واصل التدريب لتصل إلى التميز 💪'
    : 'بداية جيدة! راجع المعايير التي تحتاج إلى تحسين ثم أعد المحاولة 📚';

  card.replaceChildren();
  const top = el('div', 'quiz__result');
  top.append(
    el('div', 'quiz__score', fmt(`${score} / ${total}`)),
    el('h3', null, msg),
    el('p', null, fmt(`نسبة الإجابات الصحيحة في ${S.name}: ${pct}% — الزمن: `) + clock(elapsed()))
  );
  card.append(top);

  // Save the result for signed-in students (handled by js/site-auth.js).
  const save = el('p', 'quiz__save');
  const payload = {
    subject, gradeFilter: String(setup.grade), domainFilter: setup.domain,
    score, total, pct, durationSec: elapsed(),
    byDomain: tally(a => a.item.d), byLevel: tally(a => a.item.l)
  };
  if (window.NAFES_saveResult) {
    save.textContent = 'جارٍ حفظ النتيجة في لوحتك…';
    window.NAFES_saveResult(payload)
      .then(() => { save.textContent = '✔ حُفظت النتيجة في لوحة التحكم.'; save.classList.add('ok'); })
      .catch(() => { save.textContent = 'تعذّر حفظ النتيجة. تحقق من اتصالك.'; save.classList.add('err'); });
  } else {
    save.append('لحفظ نتائجك ومتابعة تقدمك ', Object.assign(el('a', null, 'سجّل الدخول كطالب'), { href: 'login.html' }), '.');
  }
  top.append(save);

  card.append(
    breakdown('الأداء حسب المعيار', q => q.d, k => S.domains[k].name),
    breakdown('الأداء حسب المستوى المعرفي', q => q.l, k => LEVELS[k])
  );

  const wrong = run.answers.filter(a => !a.ok);
  if (wrong.length) {
    const det = el('details', 'quiz__review');
    det.append(el('summary', null, fmt(`مراجعة الأخطاء (${wrong.length})`)));
    const ol = el('ol');
    wrong.forEach(a => {
      const li = el('li');
      li.append(
        el('p', 'quiz__review-q', fmt(a.item.q)),
        el('p', 'err', 'إجابتك: ' + fmt(a.chosen)),
        el('p', 'ok', 'الصحيحة: ' + fmt(a.item.o[0]))
      );
      if (a.item.e) li.append(el('p', 'quiz__review-e', fmt(a.item.e)));
      ol.append(li);
    });
    det.append(ol);
    card.append(det);
  }

  const actions = el('div', 'hero__cta quiz__actions');
  const again = el('button', 'btn btn--primary', 'اختبار جديد بنفس الإعدادات');
  again.type = 'button';
  again.addEventListener('click', startRun);
  const change = el('button', 'btn btn--ghost', 'تغيير الإعدادات');
  change.type = 'button';
  change.addEventListener('click', renderSetup);
  actions.append(again, change);
  card.append(actions);
}

renderSetup();

// ---------- Standards map ----------
const map = document.getElementById('stdMap');
Object.values(BANK).forEach(S => {
  const box = el('article', 'std reveal is-visible');
  const h = el('header', 'std__head');
  h.append(el('h3', null, `${S.icon} ${S.name}`), el('span', 'chip', qCount(S.items.length)));
  box.append(h);
  const grades = [...new Set(S.items.map(q => q.g))].sort((x, y) => x - y);
  box.append(el('p', 'std__grades', 'الصفوف: ' + grades.map(g => GRADES[g]).join('، ')));
  const ul = el('ul', 'std__list');
  Object.entries(S.domains).forEach(([k, d]) => {
    const n = S.items.filter(q => q.d === k).length;
    const li = el('li');
    const t = el('div', 'std__row');
    t.append(el('b', null, d.name), el('span', 'std__n', fmt(String(n))));
    li.append(t, el('p', null, d.desc));
    ul.append(li);
  });
  box.append(ul);
  const lv = Object.entries(LEVELS).map(([k, name]) => `${name} ${S.items.filter(q => q.l === k).length}`).join(' · ');
  box.append(el('p', 'std__levels', fmt('المستويات المعرفية: ' + lv)));
  map.append(box);
});

document.getElementById('year').textContent = new Date().getFullYear();
