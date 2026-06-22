const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const BCRYPT_ROUNDS = 12;

if (!JWT_SECRET) {
  console.error("JWT_SECRET não definido — abortando");
  process.exit(1);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  checkPassword
};
