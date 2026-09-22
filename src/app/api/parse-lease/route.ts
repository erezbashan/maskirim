import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const prompt = `
      You are an expert at parsing Israeli rental agreements.
      Extract the following information from this document and return it purely as a JSON object (no markdown, no backticks).
      If a field is not found, leave it as an empty string.

      Required JSON format:
      {
        "address": "Street and number",
        "city": "City name",
        "ownerName": "Name of the property owner (משכיר)",
        "tenantName": "Name of the tenant (שוכר)",
        "monthlyRent": 5000,
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "notes": "Any other important notes or guarantee types"
      }
    `;

    let result;
    let retries = 2;
    while (retries >= 0) {
      try {
        result = await model.generateContent([
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: file.type || "application/pdf"
            }
          },
          prompt
        ]);
        break;
      } catch (err: any) {
        if (retries === 0) throw err;
        console.warn(`generateContent failed (${err.message}). Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
    }

    let responseText = result?.response.text().trim() || "";
    // Clean up potential markdown formatting
    if (responseText.startsWith("\`\`\`json")) {
      responseText = responseText.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
    }

    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error parsing document:", error);
    return NextResponse.json({ error: error.message || "Failed to parse document" }, { status: 500 });
  }
}
