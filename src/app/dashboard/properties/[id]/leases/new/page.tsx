"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addLease } from "@/lib/db";
import { Lease } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewLeasePage() {
  const { id: propertyId } = useParams() as { id: string };
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    tenantName: "",
    tenantPhone: "",
    tenantEmail: "",
    startDate: "",
    endDate: "",
    monthlyRent: "",
    guaranteeType: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const newLease: Lease = {
      propertyId,
      tenantName: formData.tenantName,
      tenantPhone: formData.tenantPhone,
      tenantEmail: formData.tenantEmail,
      startDate: formData.startDate,
      endDate: formData.endDate,
      monthlyRent: parseFloat(formData.monthlyRent) || 0,
      guaranteeType: formData.guaranteeType,
      createdAt: new Date().toISOString(),
    };

    try {
      await addLease(newLease);
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (err) {
      console.error("Error adding lease", err);
      alert("שגיאה בהוספת החוזה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">הוספת חוזה שכירות חדש</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName">שם השוכר (מלא)</Label>
              <Input id="tenantName" name="tenantName" required value={formData.tenantName} onChange={handleChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenantPhone">טלפון השוכר</Label>
                <Input id="tenantPhone" name="tenantPhone" type="tel" value={formData.tenantPhone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenantEmail">אימייל השוכר</Label>
                <Input id="tenantEmail" name="tenantEmail" type="email" value={formData.tenantEmail} onChange={handleChange} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">תאריך התחלה</Label>
                <Input id="startDate" name="startDate" type="date" required value={formData.startDate} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">תאריך סיום</Label>
                <Input id="endDate" name="endDate" type="date" required value={formData.endDate} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">שכר דירה חודשי (₪)</Label>
                <Input id="monthlyRent" name="monthlyRent" type="number" required value={formData.monthlyRent} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guaranteeType">סוג ערבות (אופציונלי)</Label>
                <Input id="guaranteeType" name="guaranteeType" placeholder="לדוגמה: צ'ק בנקאי, ערבות אוואל..." value={formData.guaranteeType} onChange={handleChange} />
              </div>
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
              {loading ? "שומר..." : "שמור חוזה"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
