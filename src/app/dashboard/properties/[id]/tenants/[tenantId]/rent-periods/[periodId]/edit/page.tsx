"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { updateRentPeriod, getRentPeriodById } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditRentPeriodPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id, periodId } = useParams() as { id: string; periodId: string };
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    monthlyRent: "",
    guaranteeType: "",
    renewalDeadline: "",
    renewalTerms: "",
  });

  useEffect(() => {
    if (!user || !periodId) return;
    
    getRentPeriodById(periodId).then(period => {
      if (period) {
        setFormData({
          startDate: period.startDate || "",
          endDate: period.endDate || "",
          monthlyRent: period.monthlyRent ? period.monthlyRent.toString() : "0",
          guaranteeType: period.guaranteeType || "",
          renewalDeadline: period.renewalDeadline || "",
          renewalTerms: period.renewalTerms || "",
        });
      }
      setFetching(false);
    });
  }, [user, periodId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      await updateRentPeriod(periodId, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        monthlyRent: parseFloat(formData.monthlyRent) || 0,
        guaranteeType: formData.guaranteeType,
        renewalDeadline: formData.renewalDeadline,
        renewalTerms: formData.renewalTerms,
      });
      router.push(`/dashboard/properties/${id}`);
    } catch (err) {
      console.error("Error updating rent period", err);
      alert("שגיאה בעדכון התקופה");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8">טוען נתונים...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">עריכת תקופת שכירות</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">פרטי תקופת שכירות</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">שכר דירה חודשי (₪)</Label>
                <Input id="monthlyRent" name="monthlyRent" type="number" required value={formData.monthlyRent} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guaranteeType">סוג ערבות</Label>
                <Input id="guaranteeType" name="guaranteeType" placeholder="לדוגמה: צ'ק בנקאי..." value={formData.guaranteeType} onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewalDeadline">תאריך אחרון להודעת חידוש (אופציונלי)</Label>
                <Input id="renewalDeadline" name="renewalDeadline" type="date" value={formData.renewalDeadline} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewalTerms">תנאי חידוש (אופציונלי)</Label>
                <Input id="renewalTerms" name="renewalTerms" placeholder="לדוגמה: עליית מדד..." value={formData.renewalTerms} onChange={handleChange} />
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
              {loading ? "שומר..." : "שמור תקופה"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
