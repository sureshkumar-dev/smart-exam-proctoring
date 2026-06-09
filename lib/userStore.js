const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function ensureInitialized() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, "[]", "utf8");
  }
}

async function readUsers() {
  await ensureInitialized();
  const raw = await fs.readFile(USERS_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeUsers(users) {
  await ensureInitialized();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  return users;
}

async function getAllUsers() {
  return readUsers();
}

async function findUserById(id) {
  const users = await readUsers();
  return users.find((user) => user.id === id) || null;
}

async function findUserByEmail(email) {
  const users = await readUsers();
  const normalizedEmail = String(email || "").toLowerCase();
  return (
    users.find((user) => String(user.email || "").toLowerCase() === normalizedEmail) || null
  );
}

async function findUserByGoogleId(googleId) {
  const users = await readUsers();
  return users.find((user) => user.googleId === googleId) || null;
}

async function createUser(userData) {
  const users = await readUsers();

  if (userData.email) {
    const existing = await findUserByEmail(userData.email);
    if (existing) {
      throw new Error("User already exists.");
    }
  }

  const newUser = {
    id: userData.id || randomUUID(),
    email: userData.email ? String(userData.email).toLowerCase() : null,
    password: userData.password || null,
    displayName: userData.displayName || userData.email || "User",
    provider: userData.provider || "local",
    googleId: userData.googleId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  users.push(newUser);
  await writeUsers(users);
  return newUser;
}

async function updateUser(id, updates) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === id);

  if (index === -1) {
    return null;
  }

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await writeUsers(users);
  return users[index];
}

module.exports = {
  ensureInitialized,
  readUsers,
  writeUsers,
  getAllUsers,
  findUserById,
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  updateUser
};