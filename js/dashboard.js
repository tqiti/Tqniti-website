// لوحة التحكم: واجهة مختلفة لكل دور (طالب، معلم، مدرسة، مدير النظام)
import { configured, db, F, onUser, logout, errorText } from './fb.js';
import { h, fmt, ROLES, STATUS, GRADES, SUBJECTS, dateText, toDate, downloadCSV, notConfiguredBox } from './ui.js';

const BANK = window.NAFES_BANK || {};
const app = document.getElementById('app');
// replaceChildren() would print «null» for skipped sections, so drop them first.
const show = (...nodes) => app.replaceChildren(...nodes.filter(Boolean));
const who = document.getElementById('who');

// ---------- Data helpers ----------
const list = async q => (await F.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
const col = name => F.collection(db, name);
const byDateDesc = (a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0);
const avg = rs => rs.length ? Math.round(rs.reduce((s, r) => s + (r.pct || 0), 0) / rs.length) : null;
const pctText = p => p == null ? '—' : fmt(p + '%');
const durText = s => s == null ? '—' : fmt(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const domainName = (subj, d) => (BANK[subj] && BANK[subj].domains[d] && BANK[subj].domains[d].name) || d;
const gradeText = g => GRADES[g] || '—';

async function setStatus(user, status) {
  const batch = F.writeBatch(db);
  batch.update(F.doc(db, 'users', user.id), { status });
  if (user.role === 'school') batch.update(F.doc(db, 'schools', user.id), { status });
  await batch.commit();
  user.status = status;
}

// ---------- UI building blocks ----------
function statCards(items) {
  return h('div', { class: 'stat-cards' }, items.map(([icon, label, value]) =>
    h('div', { class: 'stat-card' },
      h('span', { class: 'stat-card__icon' }, icon),
      h('div', null, h('strong', null, typeof value === 'number' ? fmt(value) : value), h('span', null, label)))));
}

function panel(title, actions, ...content) {
  return h('section', { class: 'panel' },
    h('div', { class: 'panel__head' }, h('h2', null, title), actions ? h('div', { class: 'panel__actions' }, actions) : null),
    ...content);
}

function table(columns, rows, empty = 'لا توجد بيانات بعد.') {
  if (!rows.length) return h('p', { class: 'empty' }, empty);
  return h('div', { class: 'tbl-wrap' },
    h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, columns.map(c => h('th', null, c[0])))),
      h('tbody', null, rows.map(r => h('tr', null, columns.map(c => h('td', { 'data-label': c[0] }, c[1](r))))))));
}

const badge = s => h('span', { class: 'badge badge--' + s }, STATUS[s] || s);

function actionBtn(text, cls, fn, after) {
  const b = h('button', { type: 'button', class: 'btn btn--xs ' + cls }, text);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await fn(); after(); } catch (e) { console.error(e); alert(errorText(e)); b.disabled = false; }
  });
  return b;
}

function statusActions(user, after, me) {
  if (me && user.id === me.uid) return h('span', { class: 'muted' }, 'حسابك');
  const out = [];
  if (user.status !== 'active') out.push(actionBtn(user.status === 'pending' ? 'قبول' : 'تفعيل', 'btn--ok', () => setStatus(user, 'active'), after));
  if (user.status !== 'suspended') out.push(actionBtn(user.status === 'pending' ? 'رفض' : 'إيقاف', 'btn--danger', () => setStatus(user, 'suspended'), after));
  return h('div', { class: 'row-actions' }, out);
}

function bars(rows) {
  return h('div', { class: 'quiz__breakdown quiz__breakdown--flat' }, rows.map(([label, ok, n]) => {
    const pct = n ? Math.round((ok / n) * 100) : 0;
    return h('div', { class: 'bd' },
      h('div', { class: 'bd__label' }, h('span', null, label), h('span', { class: 'bd__val' }, fmt(`${ok} من ${n} (${pct}%)`))),
      h('div', { class: 'bd__track' }, h('span', {
        class: pct >= 80 ? 'is-high' : pct >= 50 ? 'is-mid' : 'is-low',
        style: `width:${Math.max(pct, 3)}%`
      })));
  }));
}

// تقرير لكل مادة: عدد الاختبارات ومتوسطها والأداء في كل معيار
function subjectReport(results) {
  const subjects = Object.keys(SUBJECTS).filter(s => results.some(r => r.subject === s));
  if (!subjects.length) return h('p', { class: 'empty' }, 'لا توجد نتائج اختبارات بعد.');
  return h('div', { class: 'subj-grid' }, subjects.map(s => {
    const rs = results.filter(r => r.subject === s);
    const dom = {};
    rs.forEach(r => Object.entries(r.byDomain || {}).forEach(([d, v]) => {
      dom[d] = dom[d] || { ok: 0, n: 0 };
      dom[d].ok += v.ok; dom[d].n += v.n;
    }));
    const order = Object.keys((BANK[s] && BANK[s].domains) || dom);
    return h('article', { class: 'subj' },
      h('header', { class: 'subj__head' },
        h('h3', null, `${(BANK[s] && BANK[s].icon) || ''} ${SUBJECTS[s]}`),
        h('span', { class: 'chip' }, 'المتوسط ' + pctText(avg(rs)))),
      h('p', { class: 'muted' }, fmt(`عدد الاختبارات: ${rs.length}`)),
      bars(order.filter(d => dom[d]).map(d => [domainName(s, d), dom[d].ok, dom[d].n])));
  }));
}

function resultsTable(results, { showStudent = true, showSchool = false, schools = {} } = {}) {
  const cols = [];
  if (showStudent) cols.push(['الطالب', r => r.studentName || '—'], ['الصف', r => gradeText(r.studentGrade)]);
  if (showSchool) cols.push(['المدرسة', r => (schools[r.schoolId] && schools[r.schoolId].name) || 'بدون مدرسة']);
  cols.push(
    ['المادة', r => SUBJECTS[r.subject] || r.subject],
    ['المعيار', r => r.domainFilter === 'all' ? 'جميع المعايير' : domainName(r.subject, r.domainFilter)],
    ['الدرجة', r => fmt(`${r.score} من ${r.total}`)],
    ['النسبة', r => h('b', { class: r.pct >= 80 ? 'ok' : r.pct >= 50 ? 'mid' : 'err' }, pctText(r.pct))],
    ['الزمن', r => durText(r.durationSec)],
    ['التاريخ', r => dateText(r.createdAt)]
  );
  return table(cols, results);
}

function studentRows(students, results) {
  return students.map(s => {
    const rs = results.filter(r => r.uid === s.id).sort(byDateDesc);
    return { ...s, tests: rs.length, avg: avg(rs), last: rs[0] && rs[0].createdAt };
  });
}

function resultsCSV(results, schools = {}) {
  downloadCSV('nafes-results.csv', [
    ['الطالب', 'الصف', 'المدرسة', 'المادة', 'الدرجة', 'عدد الأسئلة', 'النسبة', 'الزمن بالثواني', 'التاريخ'],
    ...results.map(r => [r.studentName, gradeText(r.studentGrade), (schools[r.schoolId] && schools[r.schoolId].name) || '',
      SUBJECTS[r.subject] || r.subject, r.score, r.total, r.pct, r.durationSec, dateText(r.createdAt)])
  ]);
}

function message(icon, title, text, ...extra) {
  return h('div', { class: 'notice notice--center' }, h('div', { class: 'notice__icon' }, icon), h('h2', null, title), h('p', null, text), ...extra);
}

// ---------- Views ----------
async function studentView(me) {
  const results = (await list(F.query(col('results'), F.where('uid', '==', me.uid)))).sort(byDateDesc);
  const best = results.length ? Math.max(...results.map(r => r.pct)) : null;
  show(
    h('div', { class: 'dash__head' },
      h('div', null, h('h1', null, `أهلاً ${me.name} 👋`), h('p', { class: 'muted' }, `الصف ${gradeText(me.grade)} · ${me.schoolName || 'حساب مستقل'}`)),
      h('a', { class: 'btn btn--primary', href: 'index.html#practice' }, 'ابدأ اختباراً جديداً')),
    statCards([['📝', 'اختبارات منجزة', results.length], ['📊', 'متوسط النسبة', pctText(avg(results))], ['🏆', 'أفضل نتيجة', pctText(best)]]),
    panel('مستواك في كل معيار', null, subjectReport(results)),
    panel('سجل الاختبارات', null, resultsTable(results, { showStudent: false })));
}

async function teacherView(me) {
  const [students, results] = await Promise.all([
    list(F.query(col('users'), F.where('schoolId', '==', me.schoolId), F.where('role', '==', 'student'))),
    list(F.query(col('results'), F.where('schoolId', '==', me.schoolId)))
  ]);
  results.sort(byDateDesc);
  const mine = me.subject ? results.filter(r => r.subject === me.subject) : results;
  show(
    h('div', { class: 'dash__head' },
      h('div', null, h('h1', null, `أهلاً ${me.name} 👋`), h('p', { class: 'muted' }, `معلم ${SUBJECTS[me.subject] || ''} · ${me.schoolName}`))),
    statCards([['🎒', 'طلاب المدرسة', students.length], ['📝', 'اختبارات الطلاب', results.length],
      ['📊', `متوسط ${SUBJECTS[me.subject] || 'النتائج'}`, pctText(avg(mine))]]),
    panel('أداء طلاب المدرسة حسب المعايير', null, subjectReport(results)),
    panel('الطلاب', null, table([
      ['الاسم', s => s.name], ['الصف', s => gradeText(s.grade)], ['الاختبارات', s => fmt(s.tests)],
      ['المتوسط', s => pctText(s.avg)], ['آخر اختبار', s => s.last ? dateText(s.last) : '—']
    ], studentRows(students, results), 'لم يسجّل طلاب في مدرستك بعد.')),
    panel('أحدث النتائج', h('button', { type: 'button', class: 'btn btn--xs btn--ghost', onclick: () => resultsCSV(results) }, 'تصدير CSV'),
      resultsTable(results.slice(0, 50))));
}

async function schoolView(me) {
  const [members, results] = await Promise.all([
    list(F.query(col('users'), F.where('schoolId', '==', me.uid))),
    list(F.query(col('results'), F.where('schoolId', '==', me.uid)))
  ]);
  results.sort(byDateDesc);
  const render = () => {
    const teachers = members.filter(m => m.role === 'teacher');
    const students = members.filter(m => m.role === 'student');
    const pending = members.filter(m => m.status === 'pending');
    show(
      h('div', { class: 'dash__head' },
        h('div', null, h('h1', null, me.schoolName), h('p', { class: 'muted' }, `${me.city || ''} · ${me.stage || ''} · المسؤول: ${me.name}`))),
      statCards([['👩‍🏫', 'المعلمون', teachers.length], ['🎒', 'الطلاب', students.length], ['📝', 'الاختبارات', results.length],
        ['📊', 'متوسط النتائج', pctText(avg(results))], ['⏳', 'طلبات معلّقة', pending.length]]),
      pending.length ? panel('طلبات الانضمام المعلّقة', null, table([
        ['الاسم', m => m.name], ['النوع', m => ROLES[m.role]], ['المادة', m => SUBJECTS[m.subject] || '—'],
        ['البريد', m => h('span', { dir: 'ltr' }, m.email)], ['التاريخ', m => dateText(m.createdAt)], ['الإجراء', m => statusActions(m, render)]
      ], pending)) : null,
      panel('أداء المدرسة حسب المعايير', null, subjectReport(results)),
      panel('المعلمون', null, table([
        ['الاسم', m => m.name], ['المادة', m => SUBJECTS[m.subject] || '—'], ['البريد', m => h('span', { dir: 'ltr' }, m.email)],
        ['الحالة', m => badge(m.status)], ['الإجراء', m => statusActions(m, render)]
      ], teachers, 'لم ينضم معلمون بعد.')),
      panel('الطلاب', null, table([
        ['الاسم', s => s.name], ['الصف', s => gradeText(s.grade)], ['الاختبارات', s => fmt(s.tests)], ['المتوسط', s => pctText(s.avg)],
        ['الحالة', s => badge(s.status)], ['الإجراء', s => statusActions(s, render)]
      ], studentRows(students, results), 'لم ينضم طلاب بعد.')),
      panel('أحدث النتائج', h('button', { type: 'button', class: 'btn btn--xs btn--ghost', onclick: () => resultsCSV(results) }, 'تصدير CSV'),
        resultsTable(results.slice(0, 100))));
  };
  render();
}

async function adminView(me) {
  const [users, schoolDocs, results] = await Promise.all([
    list(col('users')),
    list(col('schools')),
    list(F.query(col('results'), F.orderBy('createdAt', 'desc'), F.limit(1000)))
  ]);
  const schools = Object.fromEntries(schoolDocs.map(s => [s.id, s]));
  const usersById = Object.fromEntries(users.map(u => [u.id, u]));
  const TABS = { overview: 'نظرة عامة', pending: 'الطلبات المعلّقة', users: 'المستخدمون', schools: 'المدارس', results: 'النتائج' };
  let tab = (location.hash.slice(1) in TABS) ? location.hash.slice(1) : 'overview';
  const filters = { q: '', role: 'all', status: 'all', subject: 'all' };
  const body = h('div');

  const syncSchool = u => { if (u.role === 'school' && schools[u.id]) schools[u.id].status = u.status; };
  const rerender = () => { users.forEach(syncSchool); renderTab(); };

  const tabsBar = h('div', { class: 'quiz__tabs dash__tabs', role: 'tablist' });
  function renderTabs() {
    const pendingN = users.filter(u => u.status === 'pending').length;
    tabsBar.replaceChildren(...Object.entries(TABS).map(([k, label]) => h('button', {
      type: 'button', class: 'filter' + (k === tab ? ' is-active' : ''), role: 'tab',
      onclick: () => { tab = k; history.replaceState(null, '', '#' + k); renderTab(); }
    }, label, k === 'pending' && pendingN ? h('span', { class: 'count' }, fmt(pendingN)) : null)));
  }

  function roleSelect(u) {
    if (u.role === 'school' || u.id === me.uid) return ROLES[u.role];
    const sel = h('select', { class: 'mini-select', 'aria-label': 'تغيير الدور' },
      ['student', 'teacher', 'admin'].map(r => h('option', { value: r, selected: r === u.role }, ROLES[r])));
    sel.addEventListener('change', async () => {
      if (!confirm(`تغيير دور «${u.name}» إلى «${ROLES[sel.value]}»؟`)) { sel.value = u.role; return; }
      try { await F.updateDoc(F.doc(db, 'users', u.id), { role: sel.value }); u.role = sel.value; rerender(); }
      catch (e) { alert(errorText(e)); sel.value = u.role; }
    });
    return sel;
  }

  const schoolOf = u => u.role === 'school' ? (u.schoolName || '—') : ((schools[u.schoolId] && schools[u.schoolId].name) || u.schoolName || '—');

  const VIEWS = {
    overview() {
      const by = r => users.filter(u => u.role === r);
      const perSchool = schoolDocs.map(s => {
        const rs = results.filter(r => r.schoolId === s.id);
        return { ...s, students: users.filter(u => u.schoolId === s.id && u.role === 'student').length,
          teachers: users.filter(u => u.schoolId === s.id && u.role === 'teacher').length, tests: rs.length, avg: avg(rs) };
      }).sort((a, b) => b.tests - a.tests);
      return [
        statCards([['🎒', 'الطلاب', by('student').length], ['👩‍🏫', 'المعلمون', by('teacher').length], ['🏫', 'المدارس', by('school').length],
          ['📝', 'الاختبارات', results.length], ['📊', 'متوسط النتائج', pctText(avg(results))], ['⏳', 'طلبات معلّقة', users.filter(u => u.status === 'pending').length]]),
        panel('الأداء العام حسب المعايير', null, subjectReport(results)),
        panel('ترتيب المدارس', null, table([
          ['المدرسة', s => s.name], ['المدينة', s => s.city || '—'], ['المعلمون', s => fmt(s.teachers)], ['الطلاب', s => fmt(s.students)],
          ['الاختبارات', s => fmt(s.tests)], ['المتوسط', s => pctText(s.avg)], ['الحالة', s => badge(s.status)]
        ], perSchool, 'لا توجد مدارس مسجّلة بعد.'))
      ];
    },
    pending() {
      const rows = users.filter(u => u.status === 'pending').sort(byDateDesc);
      return [panel('الطلبات المعلّقة', null, table([
        ['الاسم', u => u.name], ['النوع', u => ROLES[u.role]], ['المدرسة', schoolOf], ['المدينة', u => u.city || '—'],
        ['البريد', u => h('span', { dir: 'ltr' }, u.email)], ['الجوال', u => h('span', { dir: 'ltr' }, u.phone || '—')],
        ['التاريخ', u => dateText(u.createdAt)], ['الإجراء', u => statusActions(u, rerender, me)]
      ], rows, 'لا توجد طلبات معلّقة. 🎉'))];
    },
    users() {
      const q = filters.q.trim().toLowerCase();
      const rows = users.filter(u =>
        (filters.role === 'all' || u.role === filters.role) &&
        (filters.status === 'all' || u.status === filters.status) &&
        (!q || [u.name, u.email, schoolOf(u)].some(x => String(x || '').toLowerCase().includes(q)))
      ).sort(byDateDesc);
      const search = h('input', { type: 'search', placeholder: 'بحث بالاسم أو البريد أو المدرسة', value: filters.q });
      search.addEventListener('input', () => { filters.q = search.value; const pos = search.selectionStart; renderTab(); const s = body.querySelector('input[type=search]'); s.focus(); s.setSelectionRange(pos, pos); });
      const roleF = h('select', { onchange: e => { filters.role = e.target.value; renderTab(); } },
        h('option', { value: 'all' }, 'كل الأدوار'), Object.entries(ROLES).map(([k, v]) => h('option', { value: k, selected: filters.role === k }, v)));
      const statusF = h('select', { onchange: e => { filters.status = e.target.value; renderTab(); } },
        h('option', { value: 'all' }, 'كل الحالات'), Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: filters.status === k }, v)));
      const exportBtn = h('button', { type: 'button', class: 'btn btn--xs btn--ghost', onclick: () => downloadCSV('nafes-users.csv', [
        ['الاسم', 'البريد', 'الجوال', 'الدور', 'الحالة', 'المدرسة', 'الصف', 'المادة', 'تاريخ التسجيل'],
        ...rows.map(u => [u.name, u.email, u.phone, ROLES[u.role], STATUS[u.status], schoolOf(u), u.grade ? gradeText(u.grade) : '', SUBJECTS[u.subject] || '', dateText(u.createdAt)])
      ]) }, 'تصدير CSV');
      return [panel(fmt(`المستخدمون (${rows.length})`), exportBtn,
        h('div', { class: 'toolbar' }, search, roleF, statusF),
        table([
          ['الاسم', u => u.name], ['البريد', u => h('span', { dir: 'ltr' }, u.email)], ['الدور', roleSelect],
          ['المدرسة', schoolOf], ['التفاصيل', u => u.role === 'student' ? gradeText(u.grade) : u.role === 'teacher' ? (SUBJECTS[u.subject] || '—') : '—'],
          ['الحالة', u => badge(u.status)], ['التسجيل', u => dateText(u.createdAt)], ['الإجراء', u => statusActions(u, rerender, me)]
        ], rows, 'لا يوجد مستخدمون مطابقون.'))];
    },
    schools() {
      const rows = schoolDocs.map(s => ({ ...s, user: usersById[s.id],
        teachers: users.filter(u => u.schoolId === s.id && u.role === 'teacher').length,
        students: users.filter(u => u.schoolId === s.id && u.role === 'student').length,
        rs: results.filter(r => r.schoolId === s.id) })).sort(byDateDesc);
      return [panel(fmt(`المدارس (${rows.length})`), null, table([
        ['المدرسة', s => s.name], ['المدينة', s => s.city || '—'], ['المرحلة', s => s.stage || '—'],
        ['المسؤول', s => s.user ? s.user.name : '—'], ['المعلمون', s => fmt(s.teachers)], ['الطلاب', s => fmt(s.students)],
        ['الاختبارات', s => fmt(s.rs.length)], ['المتوسط', s => pctText(avg(s.rs))], ['الحالة', s => badge(s.status)],
        ['الإجراء', s => s.user ? statusActions(s.user, rerender, me) : '—']
      ], rows, 'لا توجد مدارس مسجّلة بعد.'))];
    },
    results() {
      const rows = results.filter(r => filters.subject === 'all' || r.subject === filters.subject);
      const subjF = h('select', { onchange: e => { filters.subject = e.target.value; renderTab(); } },
        h('option', { value: 'all' }, 'كل المواد'), Object.entries(SUBJECTS).map(([k, v]) => h('option', { value: k, selected: filters.subject === k }, v)));
      return [panel(fmt(`النتائج (${rows.length})`), h('button', { type: 'button', class: 'btn btn--xs btn--ghost', onclick: () => resultsCSV(rows, schools) }, 'تصدير CSV'),
        h('div', { class: 'toolbar' }, subjF),
        rows.length >= 1000 ? h('p', { class: 'muted' }, 'تُعرض أحدث ١٠٠٠ نتيجة.') : null,
        resultsTable(rows, { showSchool: true, schools }))];
    }
  };

  function renderTab() {
    renderTabs();
    body.replaceChildren(...VIEWS[tab]());
  }

  show(
    h('div', { class: 'dash__head' },
      h('div', null, h('h1', null, 'لوحة تحكم الإدارة'), h('p', { class: 'muted' }, `مرحباً ${me.name} — إدارة المستخدمين والمدارس ومتابعة النتائج`))),
    tabsBar, body);
  renderTab();
}

const VIEWS = { student: studentView, teacher: teacherView, school: schoolView, admin: adminView };

// ---------- Boot ----------
if (!configured) {
  show(notConfiguredBox());
} else {
  onUser(async me => {
    if (!me) return location.replace('login.html');
    who.replaceChildren(
      h('span', { class: 'who__name' }, me.name || me.email, me.role ? h('small', null, ROLES[me.role]) : null),
      h('button', { type: 'button', class: 'btn btn--xs btn--ghost', onclick: logout }, 'خروج'));

    if (!me.hasProfile) {
      return show(message('⚠️', 'لم يكتمل إنشاء حسابك',
        'تم إنشاء حساب الدخول لكن تعذّر حفظ بياناتك. تواصل مع إدارة المنصة لإكمال التسجيل.'));
    }
    if (me.status === 'pending') {
      return show(message('⏳', 'حسابك بانتظار الموافقة',
        me.role === 'school' ? 'ستراجع إدارة المنصة بيانات مدرستك وتفعّل الحساب قريباً.'
          : 'ستفعّل مدرستك أو إدارة المنصة حسابك قريباً. يمكنك في الأثناء التدرّب على الاختبارات المحاكية.',
        h('a', { class: 'btn btn--primary', href: 'index.html#practice' }, 'تدرّب الآن')));
    }
    if (me.status !== 'active') {
      return show(message('⛔', 'الحساب موقوف', 'تم إيقاف هذا الحساب. تواصل مع مدرستك أو إدارة المنصة.'));
    }
    try {
      await VIEWS[me.role](me);
    } catch (e) {
      console.error(e);
      show(message('⚠️', 'تعذّر تحميل البيانات', errorText(e)));
    }
  });
}
