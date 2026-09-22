"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addProperty } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SmartUploadHeader } from "@/components/SmartUploadHeader";

export default function NewPropertyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    ownerName: "",
    address: "",
    city: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
      
      <SmartUploadHeader title="הוספת נכס חדש" />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">פרטי נכס</CardTitle>
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
                <Label htmlFor="notes">הערות ופרטי חוזה (אופציונלי)</Label>
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
    </div>
  );
}
