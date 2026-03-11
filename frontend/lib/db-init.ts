import { Database } from "bun:sqlite";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "nexus-auth.db");

console.log(`Initializing database at: ${DB_PATH}`);
const db = new Database(DB_PATH);

const schema = `
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified BOOLEAN NOT NULL,
    image TEXT,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt DATETIME NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL,
    FOREIGN KEY(userId) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt DATETIME,
    refreshTokenExpiresAt DATETIME,
    scope TEXT,
    password TEXT,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    FOREIGN KEY(userId) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt DATETIME NOT NULL,
    createdAt DATETIME,
    updatedAt DATETIME
);
`;

try {
    db.run(schema);
    console.log("✅ Database schema initialized successfully.");
} catch (err) {
    console.error("❌ Database initialization failed:", err instanceof Error ? err.message : String(err));
} finally {
    db.close();
}