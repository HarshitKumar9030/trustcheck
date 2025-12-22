import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? "trustcheck";

declare global {
  var __trustcheckMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!MONGODB_URI) return null;

  if (!global.__trustcheckMongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    global.__trustcheckMongoClientPromise = client.connect();
  }

  return global.__trustcheckMongoClientPromise;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db(MONGODB_DB);
}
