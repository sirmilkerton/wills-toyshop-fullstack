import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export function signToken(payload, secret) {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret);
}

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function requireAuth(secret) {
  return (req, res, next) => {
    const token = req.cookies?.auth;
    if (!token) return res.status(401).json({ error: "Not signed in" });
    try {
      const decoded = verifyToken(token, secret);
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
  };
}
