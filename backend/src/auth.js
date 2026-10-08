const crypto = require("node:crypto");
const { promisify } = require("node:util");
const jwt = require("jsonwebtoken");
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt, 64);
  const digest = Buffer.from(expected, "hex");
  return (
    digest.length === actual.length && crypto.timingSafeEqual(digest, actual)
  );
}
function authMiddleware(secret) {
  return (req, res, next) => {
    try {
      const bearer = req.get("authorization") || "";
      if (!bearer.startsWith("Bearer ")) throw new Error("Missing token");
      const claims = jwt.verify(bearer.slice(7), secret, {
        algorithms: ["HS256"],
        issuer: "ops-incident-dashboard",
        audience: "ops-dashboard",
      });
      if (!/^\d+$/.test(claims.sub)) throw new Error("Invalid subject");
      req.actorId = Number(claims.sub);
      next();
    } catch {
      res.status(401).json({ message: "Sign in to access the dashboard." });
    }
  };
}
function signToken(id, secret) {
  return jwt.sign({}, secret, {
    algorithm: "HS256",
    subject: String(id),
    issuer: "ops-incident-dashboard",
    audience: "ops-dashboard",
    expiresIn: "2h",
  });
}
module.exports = { hashPassword, verifyPassword, authMiddleware, signToken };
