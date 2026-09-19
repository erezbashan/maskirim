"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addProperty } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewPropertyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: "",
    address: "",
    city: "",
    rooms: "",
    sizeSqm: "",
    notes: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    
    const newProperty: Property = {
      userId: user.uid,
      ownerName: formData.ownerName || "לא מוגדר",
      address: formData.address,
      city: formData.city,
      rooms: parseFloat(formData.rooms) || 0,
      sizeSqm: formData.sizeSqm ? parseFloat(formData.sizeSqm) : undefined,
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
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">הוספת נכס חדש</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rooms">מספר חדרים</Label>
                <Input id="rooms" name="rooms" type="number" step="0.5" required value={formData.rooms} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sizeSqm">גודל (מ"ר)</Label>
                <Input id="sizeSqm" name="sizeSqm" type="number" value={formData.sizeSqm} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerName">בעלים רשום (אופציונלי - למי מיועד הנכס?)</Label>
              <Input id="ownerName" name="ownerName" placeholder="לדוגמה: אני, הבן שלי..." value={formData.ownerName} onChange={handleChange} />
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
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור נכס"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
