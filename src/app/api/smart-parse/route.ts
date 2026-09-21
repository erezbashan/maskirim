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
      console.error("No Gemini API key found");
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Reverting to gemini-3.5-flash as requested
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const prompt = `
      You are an expert real estate property manager AI fluent in Hebrew.
      Analyze this document (which may be a formal lease, an extension, a handwritten note, a receipt, an ID card, or an expense invoice).
      Pay special attention to Hebrew handwriting (e.g. names, dates, amounts).
      Extract the relevant information and return it strictly in this JSON format.
      Do NOT include any markdown formatting, just the raw JSON string.
      
      {
        "documentType": "LEASE" | "EXTENSION" | "EXPENSE" | "ID_CARD" | "OTHER",
        "propertyInfo": {
          "address": "Extracted street address (or empty string)",
          "city": "Extracted city (or empty string)",
          "ownerName": "Extracted landlord/owner name (המשכיר)"
        },
        "tenantInfo": {
          "name": "Extracted tenant name (השוכר)"
        },
        "rentPeriodInfo": {
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "monthlyRent": 0,
          "paymentDueDay": 1,
          "guarantees": "Extracted guarantee details"
        },
        "expenseInfo": {
          "amount": 0,
          "date": "YYYY-MM-DD",
          "description": "Short description of expense"
        }
      }
      
      If the document is a LEASE or EXTENSION, fill tenantInfo and rentPeriodInfo. If it's a receipt/invoice, fill expenseInfo.
      If a field is missing or not applicable, leave it empty or 0.
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

    let responseText = result.response.text().trim();
    // Clean up any markdown blocks if the model ignored instructions
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");
    }
    
    const parsedData = JSON.parse(responseText);
    
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error parsing document:", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
