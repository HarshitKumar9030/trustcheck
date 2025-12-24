import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongo";

export async function POST(req: Request) {
  try {
    const { url, category, description, evidence } = await req.json();

    if (!url || !category) {
      return NextResponse.json(
        { error: "URL and Category are required." },
        { status: 400 }
      );
    }

    const db = await getMongoDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection failed." },
        { status: 500 }
      );
    }

    const report = {
      url,
      category,
      description: description || "",
      evidence: evidence || "",
      createdAt: new Date(),
      status: "pending",
    };

    await db.collection("scam_reports").insertOne(report);

    return NextResponse.json({ success: true, message: "Report submitted successfully." });
  } catch (error) {
    console.error("Error submitting scam report:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
