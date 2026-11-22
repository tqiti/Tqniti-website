// الصفحة الرئيسية: تحديث أزرار الدخول، وحفظ نتائج الطالب المسجّل
import { configured, onUser, db, F } from './fb.js';

if (configured) {
  onUser(user => {
    const signedIn = Boolean(user && user.hasProfile);
    document.querySelectorAll('[data-auth=guest]').forEach(e => { e.hidden = signedIn; });
    document.querySelectorAll('[data-auth=user]').forEach(e => { e.hidden = !signedIn; });

    if (signedIn && user.role === 'student' && user.status === 'active') {
      window.NAFES_saveResult = payload => F.addDoc(F.collection(db, 'results'), {
        ...payload,
        uid: user.uid,
        schoolId: user.schoolId || '',
        studentName: user.name || '',
        studentGrade: user.grade || 0,
        createdAt: F.serverTimestamp()
      });
    } else {
      delete window.NAFES_saveResult;
    }
  });
}
