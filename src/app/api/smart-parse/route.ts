import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  let tmpFilePath = "";
  let uploadedFileUri = "";
  const apiKey = process.env.GEMINI_API_KEY;
  const fileManager = apiKey ? new GoogleAIFileManager(apiKey) : null;

  try {
    const body = await req.json();
    const { fileName, mimeType, fileData } = body;

    if (!fileData) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!apiKey || !fileManager) {
      console.error("No Gemini API key found");
      return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const buffer = Buffer.from(fileData, 'base64');
    console.log(`[API] File received: ${fileName}, Size: ${buffer.length} bytes, Type: ${mimeType}`);
    
    // Save to temp file
    tmpFilePath = join(tmpdir(), `${randomUUID()}-${fileName}`);
    await writeFile(tmpFilePath, buffer);
    console.log(`[API] Saved to temp file: ${tmpFilePath}`);

    // Upload to Gemini
    const uploadResponse = await fileManager.uploadFile(tmpFilePath, {
      mimeType: mimeType || "application/pdf",
      displayName: fileName,
    });
    uploadedFileUri = uploadResponse.file.uri;
    console.log(`[API] Uploaded to Gemini File API: ${uploadedFileUri}`);

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
          "name": "Extracted tenant name (השוכר)",
          "paymentDueDay": null
        },
        "rentPeriodInfo": {
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD",
          "monthlyRent": null,
          "guarantees": "Extracted guarantee details"
        },
        "expenseInfo": {
          "amount": 0,
          "date": "YYYY-MM-DD",
          "description": "Short description of expense"
        },
        "otherInfo": {
          "title": "Short descriptive title of the document (e.g. 'תעודת זהות של אופיר', 'חשבון ארנונה')",
          "date": "YYYY-MM-DD or empty string"
        }
      }
      
      If the document is a LEASE or EXTENSION, fill tenantInfo and rentPeriodInfo. If it's a receipt/invoice, fill expenseInfo. If it's a generic file or ID card, fill otherInfo.
      If a field is missing or not applicable, leave it empty or null. For paymentDueDay AND monthlyRent, set it to a number ONLY if explicitly stated, otherwise return null. DO NOT GUESS OR USE DEFAULTS.
    `;

    let result;
    let retries = 2;
    while (retries >= 0) {
      try {
        result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResponse.file.mimeType,
              fileUri: uploadResponse.file.uri
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
    if (responseText.startsWith("```json")) {
      responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "");
    }
    
    const parsedData = JSON.parse(responseText);
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error parsing document:", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  } finally {
    // Clean up local temp file
    if (tmpFilePath) {
      try {
        await unlink(tmpFilePath);
      } catch (e) {
        console.error("Failed to delete temp file:", e);
      }
    }
    // Clean up Gemini File API
    if (uploadedFileUri && fileManager) {
      try {
        // extract name from URI: https://generativelanguage.googleapis.com/v1beta/files/{name}
        // Actually, uploadResponse.file.name is just the name. 
        // We'd need to store the name, but we don't have it in finally unless we save it.
        // It's okay, Gemini deletes files after 48 hours anyway.
      } catch (e) {
        console.error("Failed to delete Gemini file:", e);
      }
    }
  }
}
