import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? "trustcheck";

declare global {
  var __trustcheckMongoClientPromise: Promise<MongoClient | null> | undefined;
}

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!MONGODB_URI) return null;

  if (!global.__trustcheckMongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
    });
    global.__trustcheckMongoClientPromise = client.connect()
      .catch(err => {
        console.warn("Internal MongoDB connection failed (running in fallback mode):", err.message);
        return null;
      });
  }

  const client = await global.__trustcheckMongoClientPromise;
  if (!client) {
    // If it failed previously, we might want to retry next time, so clear the cached promise.
    // However, in a lambda, we might keep it cached as null to avoid spamming connection attempts if it's down.
    // But for local dev (hot reload), clearing it allows recovery.
    // Let's clear it so next request tries again.
    global.__trustcheckMongoClientPromise = undefined;
    return null;
  }
  return client;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(MONGODB_DB);
}
