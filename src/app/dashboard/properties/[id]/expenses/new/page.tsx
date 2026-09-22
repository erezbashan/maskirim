"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addExpense } from "@/lib/db";
import { Expense } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SmartUploadHeader } from "@/components/SmartUploadHeader";
import { HebrewDatePicker } from "@/components/ui/date-picker";

export default function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: "",
    description: "",
    category: "OTHER",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const newExpense: Expense = {
        propertyId,
        date: formData.date,
        amount: parseFloat(formData.amount) || 0,
        description: formData.description,
        category: formData.category,
        createdAt: new Date().toISOString(),
      };
      await addExpense(newExpense);
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (err) {
      console.error(err);
      alert("שגיאה בשמירת הנתונים");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">הוספת הוצאה חדשה</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

      <SmartUploadHeader title="רוצה לחסוך זמן?" description="הזן ידנית או לחץ כאן להעלאת חשבונית והמערכת תשלוף את הנתונים אוטומטית!" />

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>פרטי ההוצאה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">תאריך</Label>
              <HebrewDatePicker 
                id="date"
                name="date"
                required
                selected={formData.date ? new Date(formData.date) : null}
                onChange={(d) => setFormData({...formData, date: d ? d.toISOString().split('T')[0] : ''})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">סכום (₪)</Label>
              <Input id="amount" name="amount" type="number" required value={formData.amount} onChange={handleChange} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">סוג הוצאה</Label>
              <select 
                id="category" 
                name="category" 
                className="w-full border rounded-md p-2 h-10"
                value={formData.category} 
                onChange={handleChange}
              >
                <option value="MAINTENANCE">תחזוקה (Maintenance)</option>
                <option value="TAX">מס (Tax)</option>
                <option value="INSURANCE">ביטוח (Insurance)</option>
                <option value="LEGAL">משפטי (Legal)</option>
                <option value="OTHER">אחר (Other)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור ההוצאה</Label>
              <Input id="description" name="description" required value={formData.description} onChange={handleChange} />
            </div>

          </CardContent>
          <CardFooter>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור הוצאה"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
