import { getDb } from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

// ONE-TIME USE: Delete and re-create admin. Remove this file after first login.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-reset-secret'] || req.query.secret;
  const validSecret = process.env.JWT_SECRET || 'cadcam-reset-2026';
  if (secret !== validSecret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const db = getDb();
    db.prepare('DELETE FROM users').run();

    const passwordHash = await hashPassword(password);
    const result = db
      .prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)')
      .run(email.toLowerCase(), passwordHash, name || 'Admin');

    const user = { id: result.lastInsertRowid, email: email.toLowerCase(), name };
    const token = generateToken(user);
    setAuthCookie(res, token);

    res.status(201).json({ success: true, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
