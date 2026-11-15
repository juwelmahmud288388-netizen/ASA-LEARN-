import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

admin.initializeApp();
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const DATABASE_ID = 'ai-studio-a6bf6876-17db-4911-a214-842c9ec10b57';
const db = getFirestore(admin.app(), DATABASE_ID);

function normalizePhone(raw: string): string {
  const cleaned = String(raw || '').replace(/[\s()-]/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) return `+88${cleaned}`;
  if (cleaned.startsWith('8801') && cleaned.length === 13) return `+${cleaned}`;
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function hashPhoneKey(phone: string): string {
  return crypto.createHash('sha256').update(normalizePhone(phone)).digest('hex').slice(0, 40);
}

export const authRegister = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { idToken, fullName, classId, password, preferredLanguage } = req.body || {};
    const decoded = await admin.auth().verifyIdToken(String(idToken));
    if (!decoded.phone_number) {
      res.status(400).json({ error: 'Verified phone number required.' });
      return;
    }
    const phone = normalizePhone(decoded.phone_number);
    const phoneKey = hashPhoneKey(phone);
    const existing = await db.collection('phoneIndex').doc(phoneKey).get();
    if (existing.exists) {
      res.status(409).json({ error: 'Mobile number already registered.' });
      return;
    }
    const uid = decoded.uid;
    const studentId = `ASA-26-${crypto.randomInt(1000, 9999)}`;
    const passwordHash = await bcrypt.hash(String(password), 12);
    const batch = db.batch();
    batch.set(db.collection('users').doc(uid), {
      uid,
      studentId,
      fullName: String(fullName).trim(),
      classId,
      preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
      preferredTheme: 'light',
      role: 'student',
      accountStatus: 'active',
      dailyGoalMinutes: 45,
      streakDays: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('users').doc(uid).collection('private').doc('info'), {
      uid,
      phoneNumber: phone,
      studentId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('authSecrets').doc(uid), {
      uid,
      passwordHash,
      phoneNumber: phone,
      studentId,
      failedAttempts: 0,
      lockedUntil: null,
    });
    batch.set(db.collection('phoneIndex').doc(phoneKey), { uid, studentId });
    batch.set(db.collection('studentIdIndex').doc(studentId), { uid, phoneNumber: phone });
    await batch.commit();

    const customToken = await admin.auth().createCustomToken(uid, { role: 'student' });
    res.status(201).json({ uid, studentId, customToken });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Registration error' });
  }
});

export const authLogin = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { identifier, password } = req.body || {};
    const clean = String(identifier || '').trim();
    let uid: string | null = null;
    if (/^ASA-\d{2}-\d{4,}$/i.test(clean)) {
      const idx = await db.collection('studentIdIndex').doc(clean.toUpperCase()).get();
      if (idx.exists) uid = idx.data()?.uid as string;
    } else {
      const idx = await db.collection('phoneIndex').doc(hashPhoneKey(clean)).get();
      if (idx.exists) uid = idx.data()?.uid as string;
    }
    if (!uid) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    const secretRef = db.collection('authSecrets').doc(uid);
    const secret = (await secretRef.get()).data();
    if (!secret) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    if (secret.lockedUntil && new Date(secret.lockedUntil).getTime() > Date.now()) {
      res.status(423).json({ error: 'Account temporarily locked due to failed attempts.' });
      return;
    }
    const valid = await bcrypt.compare(String(password), String(secret.passwordHash));
    if (!valid) {
      const next = Number(secret.failedAttempts || 0) + 1;
      await secretRef.update(
        next >= 5
          ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() }
          : { failedAttempts: next }
      );
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    await secretRef.update({ failedAttempts: 0, lockedUntil: null });
    const profile = (await db.collection('users').doc(uid).get()).data();
    if (!profile || profile.accountStatus === 'suspended') {
      res.status(403).json({ error: 'Account suspended.' });
      return;
    }
    const customToken = await admin.auth().createCustomToken(uid, { role: profile.role || 'student' });
    res.json({ user: profile, customToken });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Login error' });
  }
});

export const aiTutor = onRequest({ cors: true, secrets: [geminiApiKey] }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const { message, language = 'en', classContext = 'Class 9', subjectContext = 'General' } = req.body || {};
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: String(message || ''),
      config: {
        systemInstruction: `You are the ASA,LEARN AI Tutor for ${classContext} (${subjectContext}). Respond in ${
          language === 'bn' ? 'Bangla' : 'English'
        }.`,
      },
    });
    res.json({ reply: response.text || '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI Tutor failed' });
  }
});
