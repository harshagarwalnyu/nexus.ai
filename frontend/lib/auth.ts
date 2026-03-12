import { betterAuth } from "better-auth";
import { Database } from "bun:sqlite";
import path from "path";

const db = new Database(path.resolve(process.cwd(), "nexus-auth.db"));

const authSecret = process.env.BETTER_AUTH_SECRET;

if (!authSecret) {
    if (process.env.NODE_ENV === "production") {
        throw new Error("CRITICAL: BETTER_AUTH_SECRET environment variable is missing in production. Authentication cannot start.");
    } else {
        console.warn("WARNING: BETTER_AUTH_SECRET is not set. Using insecure development default. This MUST NOT be used in production.");
    }
}

export const auth = betterAuth({
    database: db,
    emailAndPassword: {
        enabled: true,
    },
    secret: authSecret,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3004",
});

export type Session = typeof auth.$Infer.Session;