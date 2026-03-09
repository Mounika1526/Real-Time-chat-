/**
 * seed.js — Creates demo users (Alice, Bob, Charlie) with proper E2EE keys.
 * Run once: node seed.js
 *
 * These users use password "demo123!" and can be logged in with VITE_DEMO_MODE=true
 * or manually via the Sign-in form.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const nacl = require("tweetnacl");
const { encodeBase64 } = require("tweetnacl-util");
const webcrypto = require("node:crypto").webcrypto;
const { subtle } = webcrypto;
const getRandomValues = (arr) => webcrypto.getRandomValues(arr);
const UserModel = require("./Models/UserModel");

const DEMO_PASSWORD = "demo123!";

const DEMO_USERS = [
  { name: "alice", email: "alice@demo.com" },
  { name: "bob",   email: "bob@demo.com"   },
  { name: "charlie", email: "charlie@demo.com" },
];

async function encryptPrivateKey(secretKey, password) {
  const salt = getRandomValues(new Uint8Array(16));
  const iv   = getRandomValues(new Uint8Array(12));

  const passwordKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const derivedKey = await subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const encryptedBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv },
    derivedKey,
    secretKey
  );

  return {
    encryptedPrivateKey: encodeBase64(new Uint8Array(encryptedBuffer)),
    salt: encodeBase64(salt),
    iv:   encodeBase64(iv),
  };
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB\n");

  let created = 0;
  let skipped = 0;

  for (const u of DEMO_USERS) {
    const exists = await UserModel.findOne({ $or: [{ name: u.name }, { email: u.email }] });
    if (exists) {
      console.log(`⚠  Skipped  "${u.name}" — already exists`);
      skipped++;
      continue;
    }

    // Generate NaCl keypair
    const keyPair = nacl.box.keyPair();
    const publicKey = encodeBase64(keyPair.publicKey);

    // Encrypt private key with demo password
    const { encryptedPrivateKey, salt, iv } = await encryptPrivateKey(keyPair.secretKey, DEMO_PASSWORD);

    await UserModel.create({
      name:               u.name,
      email:              u.email,
      password:           DEMO_PASSWORD,   // hashed by pre-save hook
      publicKey,
      encryptedPrivateKey,
      salt,
      iv,
      avatar:             "uploads/avatars/default.png",
    });

    console.log(`✅ Created  "${u.name}" (${u.email})  password: ${DEMO_PASSWORD}`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
