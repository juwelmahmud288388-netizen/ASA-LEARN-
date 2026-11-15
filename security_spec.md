# ASA,LEARN Firestore Security Specification

## 1. Core Data Invariants
1. **Strict Ownership Isolation**: Student private records (`studentProgress`, `bookmarks`, `studentNotes`, `quizAttempts`, `feedback`, `aiConversations`, `users/{uid}/private/{docId}`) can ONLY be read, created, updated, or deleted when `request.auth.uid == studentId` (or `uid`) or by a verified `isAdmin()`.
2. **PII Isolation**: Phone numbers and contact details reside in `users/{uid}/private/info` (never exposed to other students). Password hashes and login lockout counters reside in `authSecrets/{uid}`, `phoneIndex/*`, and `studentIdIndex/*`, which deny ALL client reads and writes (`allow read, write: if false`).
3. **Zero Self-Promotion**: A user document in `users/{uid}` CANNOT be created with `role != 'student'`, and a student CANNOT modify `role`, `accountStatus`, `uid`, or `studentId` on update. Only `isAdmin()` or trusted backend Admin SDK can modify roles or suspend accounts.
4. **Admin Bootstrapping**: `isAdmin()` verifies either `request.auth.token.email == 'juwelmahmud288388@gmail.com' && request.auth.token.email_verified == true` OR `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
5. **Curriculum Integrity**: `classes`, `subjects`, `chapters`, `topics`, `lessons`, `resources`, `quizzes`, `announcements`, and `appSettings` allow public/student reads ONLY for published records (or all records for `isAdmin()`), and allow writes EXCLUSIVELY by `isAdmin()`.
6. **Temporal Integrity & Path Guards**: Document IDs must match `^[a-zA-Z0-9_\-]+$` (<= 128 chars). Timestamps (`createdAt`, `updatedAt`, `completedAt`, `lastViewedAt`) must match `request.time` on client writes. All strings and arrays have strict upper bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Privilege Escalation on Create**: Student creates `/users/uid_1` with `{ role: "admin", ... }` -> DENIED (`incoming().role == 'student'`).
2. **Privilege Escalation on Update**: Student updates `/users/uid_1` modifying `{ role: "owner" }` or `{ accountStatus: "active" }` -> DENIED (`affectedKeys().hasOnly(...)` blocks RBAC fields).
3. **Ghost Field Shadow Write**: Student updates `/studentNotes/note_1` with `{ title: "A", content: "B", isVerified: true }` -> DENIED (`keys().hasOnly(...)` rejects unknown fields).
4. **Cross-Student Data Scraping (Get)**: Student A calls `getDoc` on `/studentNotes/note_belonging_to_B` -> DENIED (`existing().studentId == request.auth.uid`).
5. **Cross-Student List Scraping**: Student A lists `/studentProgress` without `where('studentId', '==', auth.uid)` -> DENIED (`allow list` checks `resource.data.studentId == request.auth.uid`).
6. **PII Leak Attempt**: Student A reads `/users/uid_B/private/info` -> DENIED (`uid == request.auth.uid || isAdmin()`).
7. **Credential Hash Read/Write**: Any client attempts to read/write `/authSecrets/uid_1` -> DENIED (`allow read, write: if false`).
8. **Spoofed Unverified Admin Email**: User signs in with `email == 'juwelmahmud288388@gmail.com'` and `email_verified == false` -> DENIED (`email_verified == true` enforced).
9. **ID Poisoning**: Client writes `/studentNotes/<1500-char-junk-id>` or `/studentNotes/bad$id` -> DENIED (`isValidId()` rejects >128 chars and non-alphanumeric chars).
10. **Resource Exhaustion (1MB String)**: Student writes a 50,000-char `content` in `studentNotes` or 500-char `title` -> DENIED (`size() <= 10000` / `<= 200`).
11. **Timestamp Forgery**: Student creates `studentNotes` with `createdAt: Timestamp(2020-01-01)` -> DENIED (`incoming().createdAt == request.time`).
12. **Unauthorized Curriculum Tampering**: Non-admin student attempts to create/update `/lessons/l1` or `/appSettings/global` -> DENIED (`isAdmin()` required).
