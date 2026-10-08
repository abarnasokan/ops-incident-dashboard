const { HttpError } = require("../http");
const { hashPassword, verifyPassword, signToken } = require("../auth");
const safeFields = "id,name,email,role,created_at";
async function getUsers(req, res) {
  res.json(
    (
      await req.app.locals.pool.query(
        `SELECT ${safeFields} FROM users ORDER BY name`,
      )
    ).rows,
  );
}
async function getUserById(req, res) {
  const row = (
    await req.app.locals.pool.query(
      `SELECT ${safeFields} FROM users WHERE id=$1`,
      [req.params.id],
    )
  ).rows[0];
  if (!row) throw new HttpError(404, "User not found");
  res.json(row);
}
async function createUser(req, res) {
  const { name, email, password } = req.body;
  const passwordHash = await hashPassword(password);
  const row = (
    await req.app.locals.pool.query(
      `INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING ${safeFields}`,
      [name, email, passwordHash],
    )
  ).rows[0];
  res
    .status(201)
    .json({ user: row, token: signToken(row.id, req.app.locals.jwtSecret) });
}
async function login(req, res) {
  const row = (
    await req.app.locals.pool.query("SELECT * FROM users WHERE email=$1", [
      req.body.email,
    ])
  ).rows[0];
  if (!row || !(await verifyPassword(req.body.password, row.password_hash)))
    throw new HttpError(401, "Email or password is incorrect.");
  delete row.password_hash;
  res.json({ user: row, token: signToken(row.id, req.app.locals.jwtSecret) });
}
module.exports = { getUsers, getUserById, createUser, login };
