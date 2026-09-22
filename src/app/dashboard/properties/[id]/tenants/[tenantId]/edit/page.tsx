"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { updateTenant, getTenantById } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditTenantPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id, tenantId } = useParams() as { id: string; tenantId: string };
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    paymentDueDay: "",
  });

  useEffect(() => {
    if (!user || !tenantId) return;
    
    getTenantById(tenantId).then(tenant => {
      if (tenant) {
        setFormData({
          name: tenant.name || "",
          phone: tenant.phone || "",
          email: tenant.email || "",
          paymentDueDay: tenant.paymentDueDay ? tenant.paymentDueDay.toString() : "",
        });
      }
      setFetching(false);
    });
  }, [user, tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      await updateTenant(tenantId, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay) : null,
      });
      router.push(`/dashboard/properties/${id}`);
    } catch (err) {
      console.error("Error updating tenant", err);
      alert("שגיאה בעדכון השוכר");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8">טוען נתונים...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">עריכת שוכר</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">פרטי שוכר</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם השוכר/ים</Label>
              <Input id="name" name="name" required value={formData.name} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">טלפון (אופציונלי)</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">אימייל (אופציונלי)</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDueDay">יום תשלום בחודש (1-31)</Label>
              <Input id="paymentDueDay" name="paymentDueDay" type="number" min="1" max="31" placeholder="לדוגמה 1 או 10" value={formData.paymentDueDay} onChange={handleChange} />
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
              {loading ? "שומר..." : "שמור שוכר"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
