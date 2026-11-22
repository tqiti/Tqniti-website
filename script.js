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

// ---------- Practice quiz ----------
const PASSAGE = 'النحلة حشرة نافعة، تطير من زهرة إلى زهرة لتجمع الرحيق، ثم تصنع منه العسل الذي فيه شفاء للناس. وتعيش النحل في خلايا منظمة، لكل نحلة فيها عمل تقوم به بإتقان.';

const BANK = {
  math: [
    { q: 'ما ناتج ٣/٤ من العدد ٢٠؟', o: ['١٢', '١٥', '١٦', '٥'], a: 1, e: '٢٠ ÷ ٤ = ٥، ثم ٥ × ٣ = ١٥.' },
    { q: 'ما ناتج ٢٤٥ + ٣٧٨؟', o: ['٦١٣', '٥٢٣', '٦٢٣', '٦٣٣'], a: 2, e: 'نجمع الآحاد ثم العشرات ثم المئات مع مراعاة الحمل: ٦٢٣.' },
    { q: 'مستطيل طوله ٨ سم وعرضه ٥ سم، ما محيطه؟', o: ['١٣ سم', '٤٠ سم', '٣٠ سم', '٢٦ سم'], a: 3, e: 'المحيط = ٢ × (الطول + العرض) = ٢ × ١٣ = ٢٦ سم.' },
    { q: 'أيّ الأعداد التالية عدد أوّلي؟', o: ['٢١', '٢٩', '٢٧', '٣٣'], a: 1, e: '٢٩ لا يقبل القسمة إلا على ١ وعلى نفسه.' },
    { q: 'الكسر الذي يساوي ٠٫٥ هو:', o: ['١/٢', '١/٥', '٥/١', '٢/٥'], a: 0, e: '٠٫٥ = ٥/١٠ = ١/٢.' }
  ],
  reading: [
    { q: 'ماذا تصنع النحلة من الرحيق؟', o: ['الشمع', 'العسل', 'الخلايا', 'الأزهار'], a: 1, e: 'ورد في النص: «ثم تصنع منه العسل».' },
    { q: 'مرادف كلمة «نافعة» في النص:', o: ['ضارة', 'سريعة', 'مفيدة', 'صغيرة'], a: 2, e: 'النافع هو المفيد.' },
    { q: 'مفرد كلمة «خلايا»:', o: ['خليّة', 'خلاء', 'خال', 'خلوة'], a: 0, e: 'خلايا جمع خليّة.' },
    { q: 'الفكرة الرئيسة للنص هي:', o: ['ألوان الأزهار', 'فوائد النحلة ونظام حياتها', 'طريقة بيع العسل', 'أنواع الحشرات'], a: 1, e: 'يتحدث النص عن نفع النحلة وتنظيم حياتها في الخلية.' },
    { q: 'نوع الكلمة «تجمع» في النص:', o: ['اسم', 'حرف', 'فعل ماضٍ', 'فعل مضارع'], a: 3, e: '«تجمع» فعل يدل على حدث في الزمن الحاضر، فهو فعل مضارع.' }
  ],
  science: [
    { q: 'العضو المسؤول عن ضخ الدم في جسم الإنسان هو:', o: ['الرئتان', 'المعدة', 'القلب', 'الكبد'], a: 2, e: 'القلب عضلة تضخ الدم إلى جميع أجزاء الجسم.' },
    { q: 'تحوّل المادة من الحالة الصلبة إلى السائلة يسمى:', o: ['التبخر', 'الانصهار', 'التكثف', 'التجمد'], a: 1, e: 'الانصهار: تحوّل الصلب إلى سائل عند تسخينه، مثل ذوبان الجليد.' },
    { q: 'ما مصدر الطاقة الذي تستخدمه النباتات لصنع غذائها؟', o: ['ضوء الشمس', 'التربة', 'الرياح', 'القمر'], a: 0, e: 'تصنع النباتات غذاءها بعملية البناء الضوئي مستخدمة ضوء الشمس.' },
    { q: 'أيّ المواد التالية موصلة جيدة للكهرباء؟', o: ['الخشب', 'البلاستيك', 'الزجاج', 'النحاس'], a: 3, e: 'الفلزات مثل النحاس موصلة جيدة للكهرباء.' },
    { q: 'الكوكب الأقرب إلى الشمس هو:', o: ['الأرض', 'المريخ', 'عطارد', 'الزهرة'], a: 2, e: 'عطارد هو أقرب كواكب المجموعة الشمسية إلى الشمس.' }
  ]
};

const NAMES = { math: 'الرياضيات', reading: 'القراءة', science: 'العلوم' };
const toAr = n => n.toLocaleString('ar-EG');
const card = document.getElementById('quizCard');
const tabs = document.querySelectorAll('[data-subject]');
let subject = 'math', idx = 0, score = 0;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderQuestion() {
  const list = BANK[subject];
  const item = list[idx];
  card.replaceChildren();

  const head = el('div', 'quiz__head');
  head.append(el('span', null, `سؤال ${toAr(idx + 1)} من ${toAr(list.length)}`), el('span', null, NAMES[subject]));
  const bar = el('div', 'mock__progress');
  const fill = el('span'); fill.style.width = `${(idx / list.length) * 100}%`;
  bar.append(fill);
  card.append(head, bar);

  if (subject === 'reading') {
    const p = el('blockquote', 'quiz__passage');
    p.append(el('b', null, 'اقرأ النص ثم أجب: '), document.createTextNode(PASSAGE));
    card.append(p);
  }

  card.append(el('h3', 'quiz__q', item.q));
  const opts = el('div', 'quiz__opts');
  const feedback = el('p', 'quiz__fb');
  const next = el('button', 'btn btn--primary', idx === list.length - 1 ? 'عرض النتيجة' : 'السؤال التالي');
  next.hidden = true;

  item.o.forEach((text, i) => {
    const b = el('button', 'quiz__opt', text);
    b.type = 'button';
    b.addEventListener('click', () => {
      opts.querySelectorAll('button').forEach(x => (x.disabled = true));
      opts.children[item.a].classList.add('is-right');
      if (i === item.a) {
        score++;
        feedback.textContent = '✔ إجابة صحيحة! ' + item.e;
        feedback.className = 'quiz__fb ok';
      } else {
        b.classList.add('is-wrong');
        feedback.textContent = '✘ إجابة غير صحيحة. ' + item.e;
        feedback.className = 'quiz__fb err';
      }
      next.hidden = false;
      next.focus();
    });
    opts.append(b);
  });

  next.addEventListener('click', () => {
    idx++;
    idx < list.length ? renderQuestion() : renderResult();
  });

  card.append(opts, feedback, next);
}

function renderResult() {
  const total = BANK[subject].length;
  const pct = Math.round((score / total) * 100);
  const msg = pct >= 80 ? 'ممتاز! أنت مستعد بشكل رائع 🌟'
    : pct >= 60 ? 'جيد جداً! واصل التدريب لتصل إلى التميز 💪'
    : 'بداية جيدة! راجع الشرح وأعد المحاولة 📚';
  card.replaceChildren();
  const box = el('div', 'quiz__result');
  box.append(
    el('div', 'quiz__score', `${toAr(score)} / ${toAr(total)}`),
    el('h3', null, msg),
    el('p', null, `نسبة الإجابات الصحيحة في ${NAMES[subject]}: ${toAr(pct)}٪`)
  );
  const again = el('button', 'btn btn--primary', 'أعد المحاولة');
  again.addEventListener('click', start);
  const other = el('button', 'btn btn--ghost', 'جرّب مادة أخرى');
  other.addEventListener('click', () => {
    const keys = Object.keys(BANK);
    selectSubject(keys[(keys.indexOf(subject) + 1) % keys.length]);
  });
  const actions = el('div', 'hero__cta');
  actions.append(again, other);
  box.append(actions);
  card.append(box);
}

function start() { idx = 0; score = 0; renderQuestion(); }

function selectSubject(s) {
  subject = s;
  tabs.forEach(t => {
    const on = t.dataset.subject === s;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
  });
  start();
}

tabs.forEach(t => t.addEventListener('click', () => selectSubject(t.dataset.subject)));
start();

// ---------- Contact form ----------
// Client-side validation only; connect to a backend or form service to receive submissions.
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
  msg.textContent = 'شكراً لك! تم استلام طلبك وسنتواصل معك قريباً.';
  msg.className = 'form__msg ok';
  form.reset();
});

document.getElementById('year').textContent = new Date().getFullYear();
