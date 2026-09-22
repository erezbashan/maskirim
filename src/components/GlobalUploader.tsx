"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { uploadDocumentFile, addDocumentRecord, addTenant, addRentPeriod, addExpense, addProperty, getPropertiesByUser, getTenantsByProperty } from "@/lib/db";
import { Property, Tenant } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const getNormalizedWords = (str: string) => {
  return str
    .replace(/[,\.-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => {
       if (w.length > 2 && w.startsWith("ו")) return w.substring(1);
       return w;
    });
};

const calculateSimilarity = (str1: string, str2: string) => {
  const words1 = getNormalizedWords(str1);
  const words2 = getNormalizedWords(str2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  let intersection = 0;
  set1.forEach(w => {
    if (set2.has(w)) intersection++;
  });
  
  return intersection / Math.min(set1.size, set2.size);
};

export default function GlobalUploader() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [step, setStep] = useState<"IDLE" | "ANALYZING" | "REVIEW" | "SAVING">("IDLE");
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("NEW");
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  
  useEffect(() => {
    if (user && step === "REVIEW") {
      getPropertiesByUser(user.uid).then(fetchedProps => {
        setProperties(fetchedProps);
        if (parsedData?.propertyInfo?.address) {
          const match = fetchedProps.find(p => calculateSimilarity(p.address, parsedData.propertyInfo.address) >= 0.75);
          if (match && match.id) {
            setSelectedPropertyId(match.id);
          }
        }
      }).catch(console.error);
    }
  }, [user, step, parsedData]);

  useEffect(() => {
    if (selectedPropertyId !== "NEW" && selectedPropertyId !== "UNKNOWN" && selectedPropertyId !== "") {
      getTenantsByProperty(selectedPropertyId).then(fetchedTenants => {
        setTenants(fetchedTenants);
        if (parsedData?.tenantInfo?.name) {
          const match = fetchedTenants.find(t => calculateSimilarity(t.name, parsedData.tenantInfo.name) >= 0.75);
          if (match && match.id) {
            setSelectedTenantId(match.id);
          } else {
            setSelectedTenantId("");
          }
        } else {
          setSelectedTenantId("");
        }
      }).catch(console.error);
    } else {
      setTenants([]);
      setSelectedTenantId("");
    }
  }, [selectedPropertyId, parsedData]);

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

  const isFormValid = () => {
    if (!parsedData) return false;
    if (selectedPropertyId === "") return false;
    if (selectedPropertyId === "NEW" && !parsedData.propertyInfo?.address) return false;
    
    if (parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") {
      if (selectedTenantId === "") return false;
      if (selectedTenantId === "NEW") {
        if (!parsedData.tenantInfo?.name) return false;
        if (!parsedData.tenantInfo?.paymentDueDay) return false;
      }
      if (parsedData.rentPeriodInfo?.monthlyRent == null || parsedData.rentPeriodInfo.monthlyRent === "") return false;
    }
    
    if (parsedData.documentType === "EXPENSE") {
      if (!parsedData.expenseInfo?.amount) return false;
    }

    return true;
  };

  const handleConfirm = async () => {
    if (!user || !parsedData || !originalFile) return;
    setStep("SAVING");
    
    try {
      // 1. Upload file to Storage
      const fileUrl = await uploadDocumentFile(user.uid, originalFile);
      
      // 2. Identify or Create Property
      let targetPropertyId = selectedPropertyId;
      if (selectedPropertyId === "NEW" && parsedData.propertyInfo?.address) {
        targetPropertyId = await addProperty({
          userId: user.uid,
          ownerName: parsedData.propertyInfo.ownerName || (user as any).displayName || "אני",
          address: parsedData.propertyInfo.address,
          city: parsedData.propertyInfo.city || "",
          createdAt: new Date().toISOString()
        });
      }

      // 3. Save Specific Entity
      let targetTenantId = selectedTenantId === "NEW" ? undefined : selectedTenantId;
      let targetRentPeriodId = undefined;

      if (parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") {
        if (!targetTenantId) {
          targetTenantId = await addTenant({
            propertyId: targetPropertyId,
            name: parsedData.tenantInfo?.name || "שוכר לא ידוע",
            paymentDueDay: parsedData.tenantInfo?.paymentDueDay || null,
            createdAt: new Date().toISOString()
          });
        }

        targetRentPeriodId = await addRentPeriod({
          tenantId: targetTenantId,
          startDate: parsedData.rentPeriodInfo?.startDate || "",
          endDate: parsedData.rentPeriodInfo?.endDate || "",
          monthlyRent: parsedData.rentPeriodInfo?.monthlyRent || 0,
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
              <CardTitle>אישור נתונים שחולצו ({
                parsedData.documentType === 'LEASE' ? 'חוזה שכירות' :
                parsedData.documentType === 'EXTENSION' ? 'הארכת חוזה' :
                parsedData.documentType === 'EXPENSE' ? 'הוצאה' :
                parsedData.documentType === 'ID_CARD' ? 'תעודת זהות' : 'אחר'
              })</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-4 mb-4 pb-4 border-b">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">שייך לנכס</Label>
                    <select 
                      className="w-full border rounded p-2 text-sm bg-white"
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                    >
                      <option value="" disabled>-- בחר נכס --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.address} {p.city ? `(${p.city})` : ''}</option>
                      ))}
                      <option value="NEW">+ צור נכס חדש</option>
                    </select>
                  </div>
                  {(parsedData.documentType === 'LEASE' || parsedData.documentType === 'EXTENSION') && selectedPropertyId !== "NEW" && selectedPropertyId !== "" && (
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">שייך לשוכר</Label>
                      <select 
                        className="w-full border rounded p-2 text-sm bg-white"
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                      >
                        <option value="" disabled>-- בחר שוכר --</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        <option value="NEW">+ צור שוכר חדש</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {selectedPropertyId === "NEW" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>כתובת (נכס חדש)</Label>
                    <Input value={parsedData.propertyInfo?.address || ""} onChange={(e) => setParsedData({...parsedData, propertyInfo: {...parsedData.propertyInfo, address: e.target.value}})} />
                  </div>
                  <div className="space-y-2">
                    <Label>בעלים רשום (משכיר)</Label>
                    <Input value={parsedData.propertyInfo?.ownerName || ""} onChange={(e) => setParsedData({...parsedData, propertyInfo: {...parsedData.propertyInfo, ownerName: e.target.value}})} />
                  </div>
                </div>
              )}
              
              {(parsedData.documentType === "LEASE" || parsedData.documentType === "EXTENSION") && (
                <>
                  {selectedTenantId === "NEW" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>שוכרים (שוכר חדש)</Label>
                        <Input value={parsedData.tenantInfo?.name || ""} onChange={(e) => setParsedData({...parsedData, tenantInfo: {...parsedData.tenantInfo, name: e.target.value}})} />
                      </div>
                      <div className="space-y-2">
                        <Label>יום תשלום בחודש (חובה)</Label>
                        <Input type="number" min="1" max="31" placeholder="לדוגמה 1 או 10" value={parsedData.tenantInfo?.paymentDueDay || ""} onChange={(e) => setParsedData({...parsedData, tenantInfo: {...parsedData.tenantInfo, paymentDueDay: parseInt(e.target.value) || null}})} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>שכירות לחודש (חובה)</Label>
                    <Input type="number" placeholder="הזן סכום" value={parsedData.rentPeriodInfo?.monthlyRent ?? ""} onChange={(e) => setParsedData({...parsedData, rentPeriodInfo: {...parsedData.rentPeriodInfo, monthlyRent: parseFloat(e.target.value) || null}})} />
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
              <button 
                onClick={handleConfirm} 
                disabled={!isFormValid()}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                שמור ומיין מסמך
              </button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
