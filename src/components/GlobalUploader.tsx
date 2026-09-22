"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadDocumentFile, addDocumentRecord, addTenant, addRentPeriod, addExpense, addProperty } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function GlobalUploader() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [step, setStep] = useState<"IDLE" | "ANALYZING" | "REVIEW" | "SAVING">("IDLE");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setOriginalFile(file);
    setStep("ANALYZING");
    
    try {
      const reader = new FileReader();
      
      reader.onerror = () => {
        alert("לא ניתן לקרוא את הקובץ. ייתכן שהוא פגום או לא זמין (למשל בענן).");
        setStep("IDLE");
      };

      reader.onload = async () => {
        try {
          if (!reader.result) {
             throw new Error("File read resulted in null");
          }
          const base64Data = (reader.result as string).split(',')[1];
          const payload = {
            fileName: file.name,
            mimeType: file.type || "application/pdf",
            fileData: base64Data
          };

          const res = await fetch("/api/smart-parse", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) throw new Error("Failed to parse");

          const json = await res.json();
          setParsedData(json);
          setStep("REVIEW");
        } catch (err) {
          console.error(err);
          alert("שגיאה בפענוח המסמך. אנא נסה שנית או הוסף ידנית.");
          setStep("IDLE");
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert("שגיאה בפענוח המסמך. אנא נסה שנית או הוסף ידנית.");
      setStep("IDLE");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!user || !parsedData || !originalFile) return;
    setStep("SAVING");
    
    try {
      // 1. Upload file to Storage
      const fileUrl = await uploadDocumentFile(user.uid, originalFile);
      
      // 2. Identify or Create Property
      let targetPropertyId = "UNKNOWN"; // In a real app, query DB to match address
      // For now, we'll auto-create the property if we have an address
      if (parsedData.propertyInfo?.address) {
        targetPropertyId = await addProperty({
          userId: user.uid,
          ownerName: parsedData.propertyInfo.ownerName || (user as any).displayName || "אני",
          address: parsedData.propertyInfo.address,
          city: parsedData.propertyInfo.city || "",
          createdAt: new Date().toISOString()
        });
      }

      // 3. Save Specific Entity
      let targetTenantId = undefined;
      let targetRentPeriodId = undefined;

      if (parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") {
        targetTenantId = await addTenant({
          propertyId: targetPropertyId,
          name: parsedData.tenantInfo?.name || "שוכר לא ידוע",
          createdAt: new Date().toISOString()
        });

        targetRentPeriodId = await addRentPeriod({
          tenantId: targetTenantId,
          startDate: parsedData.rentPeriodInfo?.startDate || "",
          endDate: parsedData.rentPeriodInfo?.endDate || "",
          monthlyRent: parsedData.rentPeriodInfo?.monthlyRent || 0,
          paymentDueDay: parsedData.rentPeriodInfo?.paymentDueDay || 1,
          guaranteeType: parsedData.rentPeriodInfo?.guarantees || "",
          documentUrl: fileUrl,
          createdAt: new Date().toISOString()
        });
      } else if (parsedData.documentType === "EXPENSE") {
        await addExpense({
          propertyId: targetPropertyId,
          amount: parsedData.expenseInfo?.amount || 0,
          date: parsedData.expenseInfo?.date || new Date().toISOString(),
          category: "כללי",
          description: parsedData.expenseInfo?.description || "",
          receiptUrl: fileUrl,
          createdAt: new Date().toISOString()
        });
      }

      // 4. Save Document Record
      await addDocumentRecord({
        userId: user.uid,
        propertyId: targetPropertyId !== "UNKNOWN" ? targetPropertyId : undefined,
        tenantId: targetTenantId,
        rentPeriodId: targetRentPeriodId,
        name: originalFile.name,
        url: fileUrl,
        type: (parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") ? "LEASE" : parsedData.documentType === "EXPENSE" ? "EXPENSE" : "OTHER",
        createdAt: new Date().toISOString()
      });

      setStep("IDLE");
      setParsedData(null);
      setOriginalFile(null);
      
      if (targetPropertyId !== "UNKNOWN") {
        router.push(`/dashboard/properties/${targetPropertyId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת הנתונים.");
      setStep("REVIEW");
    }
  };

  return (
    <>
      <div className="fixed bottom-8 left-8 z-50">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".pdf,image/*" 
          onChange={handleFileSelect} 
        />
        <button 
          type="button"
          onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
          disabled={step !== "IDLE"}
          className="bg-blue-600 text-white p-4 rounded-full shadow-xl hover:bg-blue-700 transition flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          <span className="font-bold text-lg">תיבה חכמה (העלה מסמך)</span>
        </button>
      </div>

      {step === "ANALYZING" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 text-center py-8">
            <CardTitle className="text-xl text-blue-600 animate-pulse">הבינה המלאכותית קוראת את המסמך...</CardTitle>
          </Card>
        </div>
      )}

      {step === "SAVING" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 text-center py-8">
            <CardTitle className="text-xl">שומר נתונים וקובץ...</CardTitle>
          </Card>
        </div>
      )}

      {step === "REVIEW" && parsedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b bg-blue-50">
              <CardTitle>אישור נתונים שחולצו ({parsedData.documentType})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>כתובת (נכס)</Label>
                  <Input value={parsedData.propertyInfo?.address || ""} onChange={(e) => setParsedData({...parsedData, propertyInfo: {...parsedData.propertyInfo, address: e.target.value}})} />
                </div>
                <div className="space-y-2">
                  <Label>בעלים רשום (משכיר)</Label>
                  <Input value={parsedData.propertyInfo?.ownerName || ""} onChange={(e) => setParsedData({...parsedData, propertyInfo: {...parsedData.propertyInfo, ownerName: e.target.value}})} />
                </div>
              </div>
              
              {(parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") && (
                <>
                  <div className="space-y-2">
                    <Label>שוכרים</Label>
                    <Input value={parsedData.tenantInfo?.name || ""} onChange={(e) => setParsedData({...parsedData, tenantInfo: {...parsedData.tenantInfo, name: e.target.value}})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>שכירות (₪)</Label>
                      <Input type="number" value={parsedData.rentPeriodInfo?.monthlyRent || 0} onChange={(e) => setParsedData({...parsedData, rentPeriodInfo: {...parsedData.rentPeriodInfo, monthlyRent: parseFloat(e.target.value)}})} />
                    </div>
                    <div className="space-y-2">
                      <Label>יום תשלום בחודש</Label>
                      <Input type="number" value={parsedData.rentPeriodInfo?.paymentDueDay || 1} onChange={(e) => setParsedData({...parsedData, rentPeriodInfo: {...parsedData.rentPeriodInfo, paymentDueDay: parseInt(e.target.value)}})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>תאריך התחלה</Label>
                      <Input type="date" value={parsedData.rentPeriodInfo?.startDate || ""} onChange={(e) => setParsedData({...parsedData, rentPeriodInfo: {...parsedData.rentPeriodInfo, startDate: e.target.value}})} />
                    </div>
                    <div className="space-y-2">
                      <Label>תאריך סיום</Label>
                      <Input type="date" value={parsedData.rentPeriodInfo?.endDate || ""} onChange={(e) => setParsedData({...parsedData, rentPeriodInfo: {...parsedData.rentPeriodInfo, endDate: e.target.value}})} />
                    </div>
                  </div>
                </>
              )}

              {parsedData.documentType === "EXPENSE" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>סכום (₪)</Label>
                      <Input type="number" value={parsedData.expenseInfo?.amount || 0} onChange={(e) => setParsedData({...parsedData, expenseInfo: {...parsedData.expenseInfo, amount: parseFloat(e.target.value)}})} />
                    </div>
                    <div className="space-y-2">
                      <Label>תאריך</Label>
                      <Input type="date" value={parsedData.expenseInfo?.date || ""} onChange={(e) => setParsedData({...parsedData, expenseInfo: {...parsedData.expenseInfo, date: e.target.value}})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>תיאור</Label>
                    <Input value={parsedData.expenseInfo?.description || ""} onChange={(e) => setParsedData({...parsedData, expenseInfo: {...parsedData.expenseInfo, description: e.target.value}})} />
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t p-4">
              <button onClick={() => setStep("IDLE")} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded">ביטול</button>
              <button onClick={handleConfirm} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">שמור ומיין מסמך</button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
