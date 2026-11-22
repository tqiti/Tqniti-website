// أدوات واجهة مشتركة لصفحات الدخول والتسجيل ولوحة التحكم
export const ROLES = { student: 'طالب', teacher: 'معلم', school: 'مدرسة', admin: 'مدير النظام' };
export const STATUS = { active: 'مفعّل', pending: 'بانتظار الموافقة', suspended: 'موقوف' };
export const GRADES = { 3: 'الثالث الابتدائي', 6: 'السادس الابتدائي', 9: 'الثالث المتوسط' };
export const SUBJECTS = { math: 'الرياضيات', reading: 'القراءة', science: 'العلوم' };
export const STAGES = ['ابتدائي', 'متوسط', 'ابتدائي ومتوسط'];

const AR = '٠١٢٣٤٥٦٧٨٩';
export const fmt = s => String(s ?? '')
  .replace(/(\d)\.(\d)/g, '$1٫$2')
  .replace(/%/g, '٪')
  .replace(/\d/g, d => AR[d]);

// h('div', {class: 'x', onclick: fn}, 'نص', child)
export function h(tag, props, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(c => { if (c != null && c !== false) n.append(c instanceof Node ? c : String(c)); });
  return n;
}

export function toDate(ts) {
  if (!ts) return null;
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
}
export function dateText(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleDateString('ar-SA-u-ca-gregory-nu-arab', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

export function setMsg(el, text, type) {
  el.textContent = text || '';
  el.className = 'form__msg' + (type ? ' ' + type : '');
}

export function downloadCSV(filename, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: filename });
  document.body.append(a); a.click(); a.remove();
}

export function notConfiguredBox() {
  return h('div', { class: 'notice' },
    h('b', null, 'لم يُربط الموقع بقاعدة البيانات بعد.'),
    h('p', null, 'أضف إعدادات مشروع Firebase في الملف firebase-config.js لتفعيل التسجيل وتسجيل الدخول ولوحة التحكم. الخطوات مشروحة في ملف README.md.'));
}
