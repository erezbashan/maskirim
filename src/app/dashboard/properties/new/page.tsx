"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addProperty } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewPropertyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [fileSelected, setFileSelected] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    ownerName: "",
    address: "",
    city: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileSelected(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!fileSelected) return;
    alert("עיבוד מסמך יתווסף בשלב הבא (AI Parsing). בינתיים, אנא הזן ידנית.");
    setShowManualForm(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    
    const newProperty: Property = {
      userId: user.uid,
      ownerName: formData.ownerName || "לא מוגדר",
      address: formData.address,
      city: formData.city,
      notes: formData.notes,
      createdAt: new Date().toISOString(),
    };

    try {
      await addProperty(newProperty);
      router.push("/dashboard/properties");
    } catch (err) {
      console.error("Error adding property", err);
      alert("שגיאה בהוספת הנכס");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Upload Section - Primary */}
      <Card className="border-blue-200 shadow-md">
        <CardHeader className="bg-blue-50/50 border-b">
          <CardTitle className="text-2xl text-blue-800">הוספת נכס חדש</CardTitle>
          <CardDescription>
            הדרך המהירה ביותר להוסיף נכס היא להעלות את חוזה השכירות. המערכת תפענח אותו אוטומטית.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:bg-gray-50 transition">
            <Label htmlFor="lease-upload" className="cursor-pointer flex flex-col items-center">
              <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <span className="text-blue-600 font-medium">בחר קובץ חוזה (PDF או תמונה)</span>
              <span className="text-sm text-gray-500 mt-1">{fileSelected ? fileSelected.name : "לחץ להעלאה"}</span>
            </Label>
            <input id="lease-upload" type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <button 
              type="button"
              onClick={() => setShowManualForm(true)}
              className="text-gray-500 text-sm hover:underline"
            >
              הזנה ידנית (אופציה משנית)
            </button>
            <button 
              type="button"
              onClick={handleUploadSubmit}
              disabled={!fileSelected}
              className="bg-blue-600 text-white px-6 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
              העלה ופענח חוזה
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Manual Entry Section - Secondary */}
      {showManualForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">הזנת פרטי נכס ידנית</CardTitle>
          </CardHeader>
          <form onSubmit={handleManualSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">כתובת</Label>
                  <Input id="address" name="address" required value={formData.address} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">עיר</Label>
                  <Input id="city" name="city" required value={formData.city} onChange={handleChange} />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ownerName">שם הבעלים</Label>
                <Input id="ownerName" name="ownerName" placeholder="הכנס את שם הבעלים של הנכס" value={formData.ownerName} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">הערות (אופציונלי)</Label>
                <textarea 
                  id="notes" 
                  name="notes" 
                  className="w-full border rounded-md p-2 min-h-[100px]"
                  value={formData.notes} 
                  onChange={handleChange} 
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2 space-x-reverse">
              <button 
                type="button" 
                onClick={() => router.back()}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                ביטול
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50"
              >
                {loading ? "שומר..." : "שמור נכס"}
              </button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
