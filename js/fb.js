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

// Accounts created by a school sign in with a username; Firebase needs an email, so the
// username maps to an address on a reserved domain (.invalid never receives mail).
export const USER_DOMAIN = 'accounts.enjaz.invalid';
export const toLoginEmail = id => {
  const v = String(id || '').trim();
  return v.includes('@') ? v : `${v.toLowerCase()}@${USER_DOMAIN}`;
};
export const usernameOf = email => String(email || '').endsWith('@' + USER_DOMAIN) ? email.split('@')[0] : '';

// Creates a sign-in account without touching the current session: a second Firebase app
// with in-memory auth does the sign-up, then signs out. Returns the new user's uid.
let creator = null;
export async function createAccount(email, password) {
  if (!creator) {
    const { initializeApp } = await import(SDK + 'firebase-app.js');
    const app2 = initializeApp(firebaseConfig, 'account-creator');
    creator = A.initializeAuth(app2, { persistence: A.inMemoryPersistence });
  }
  const cred = await A.createUserWithEmailAndPassword(creator, email, password);
  const uid = cred.user.uid;
  await A.signOut(creator);
  return uid;
}

// Lets the signed-in user change their password (re-authenticates first).
export async function changePassword(current, next) {
  const u = auth.currentUser;
  await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, current));
  await A.updatePassword(u, next);
  // The initial password the school saved is no longer valid; remove it.
  await F.deleteDoc(F.doc(db, 'credentials', u.uid)).catch(() => {});
}

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
  'auth/too-many-requests': 'محاولات كثيرة أو تجاوزت حد إنشاء الحسابات. انتظر قليلاً ثم حاول مجدداً.',
  'auth/network-request-failed': 'تعذّر الاتصال. تحقق من الإنترنت.',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد غير مفعّل في مشروع Firebase.',
  'auth/quota-exceeded': 'تجاوزت حد إنشاء الحسابات المسموح في الساعة. انتظر قليلاً أو ارفع الحد من إعدادات Firebase.',
  'auth/requires-recent-login': 'لأمان حسابك، سجّل الخروج ثم الدخول مرة أخرى وأعد المحاولة.',
  'auth/configuration-not-found': 'خدمة تسجيل الدخول غير مفعّلة بعد في مشروع Firebase.',
  'permission-denied': 'ليست لديك صلاحية لهذا الإجراء.'
};
export const errorText = e => AUTH_ERRORS[e && e.code] || 'حدث خطأ غير متوقع. حاول مرة أخرى.';
