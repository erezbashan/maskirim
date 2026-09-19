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
    // Use stable gemini-3.5-flash as per previous fixes
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const prompt = `
      You are an expert real estate property manager AI.
      Analyze this document (which may be a lease, an extension, a receipt, an ID card, or an expense invoice).
      Extract the relevant information and return it strictly in this JSON format.
      Do NOT include any markdown formatting, just the raw JSON string.
      
      {
        "documentType": "LEASE" | "EXPENSE" | "ID_CARD" | "OTHER",
        "propertyInfo": {
          "address": "Extracted street address (or empty string)",
          "city": "Extracted city (or empty string)"
        },
        "leaseInfo": {
          "tenantNames": ["Array of tenant names"],
          "monthlyRent": 0,
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "paymentDueDay": 0, // e.g., 10 if due on the 10th of every month
          "guarantees": "Description of guarantees or deposits"
        },
        "expenseInfo": {
          "amount": 0,
          "description": "What was the expense for?",
          "date": "YYYY-MM-DD"
        }
      }
      
      If the document is a LEASE or extension, fill leaseInfo. If it's a receipt/invoice, fill expenseInfo.
      If a field is missing or not applicable, leave it empty or 0.
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: file.type || "application/pdf"
        }
      },
      prompt
    ]);

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
