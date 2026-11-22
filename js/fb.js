// تهيئة Firebase ودوال مشتركة للمصادقة وقاعدة البيانات
import { firebaseConfig } from '../firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null, db = null, A = null, F = null;
if (configured) {
  const { initializeApp } = await import(SDK + 'firebase-app.js');
  A = await import(SDK + 'firebase-auth.js');
  F = await import(SDK + 'firebase-firestore.js');
  const app = initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
}
export { auth, db, A, F };

// يستدعي cb بالمستخدم الحالي مع ملفه من مجموعة users، أو null عند عدم تسجيل الدخول.
export function onUser(cb) {
  if (!configured) { cb(null); return; }
  A.onAuthStateChanged(auth, async u => {
    if (!u) return cb(null);
    try {
      const snap = await F.getDoc(F.doc(db, 'users', u.uid));
      cb({ uid: u.uid, email: u.email, hasProfile: snap.exists(), ...(snap.exists() ? snap.data() : {}) });
    } catch (e) {
      cb({ uid: u.uid, email: u.email, hasProfile: false, error: e });
    }
  });
}

export function logout() {
  return A.signOut(auth).then(() => { location.href = 'index.html'; });
}

const AUTH_ERRORS = {
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح.',
  'auth/missing-password': 'أدخل كلمة المرور.',
  'auth/weak-password': 'كلمة المرور ضعيفة؛ استخدم ٦ أحرف على الأقل.',
  'auth/email-already-in-use': 'هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول.',
  'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/user-not-found': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.',
  'auth/network-request-failed': 'تعذّر الاتصال. تحقق من الإنترنت.',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد غير مفعّل في مشروع Firebase.',
  'permission-denied': 'ليست لديك صلاحية لهذا الإجراء.'
};
export const errorText = e => AUTH_ERRORS[e && e.code] || 'حدث خطأ غير متوقع. حاول مرة أخرى.';
