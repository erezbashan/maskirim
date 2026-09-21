"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addRentPeriod } from "@/lib/db";
import { RentPeriod } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewRentPeriodPage() {
  const { id: propertyId, tenantId } = useParams() as { id: string, tenantId: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    monthlyRent: "",
    paymentDueDay: "1",
    guaranteeType: "",
    renewalDeadline: "",
    renewalTerms: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const newPeriod: RentPeriod = {
        tenantId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        monthlyRent: parseFloat(formData.monthlyRent) || 0,
        paymentDueDay: parseInt(formData.paymentDueDay) || 1,
        guaranteeType: formData.guaranteeType,
        renewalDeadline: formData.renewalDeadline,
        renewalTerms: formData.renewalTerms,
        createdAt: new Date().toISOString(),
      };
      await addRentPeriod(newPeriod);
      router.push(`/dashboard/properties/${propertyId}/tenants/${tenantId}`);
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">הוספת תקופת שכירות</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>פרטי השכירות</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">שכר דירה חודשי (₪)</Label>
                <Input id="monthlyRent" name="monthlyRent" type="number" required value={formData.monthlyRent} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDueDay">יום תשלום בחודש (1-31)</Label>
                <Input id="paymentDueDay" name="paymentDueDay" type="number" min="1" max="31" required value={formData.paymentDueDay} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guaranteeType">סוג ערבות</Label>
                <Input id="guaranteeType" name="guaranteeType" placeholder="לדוגמה: צ'ק בנקאי..." value={formData.guaranteeType} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewalDeadline">תאריך יעד לחידוש אופציה (אופציונלי)</Label>
                <Input id="renewalDeadline" name="renewalDeadline" type="date" value={formData.renewalDeadline} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewalTerms">תנאי חידוש / הודעה מראש (אופציונלי)</Label>
                <Input id="renewalTerms" name="renewalTerms" placeholder="לדוגמה: הודעה מראש של 60 יום" value={formData.renewalTerms} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור תקופת שכירות"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
