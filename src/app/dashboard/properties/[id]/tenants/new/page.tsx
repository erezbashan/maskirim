"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { addTenant } from "@/lib/db";
import { Tenant } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewTenantPage() {
  const { id: propertyId } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
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
      const newTenant: Tenant = {
        propertyId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        createdAt: new Date().toISOString(),
      };
      await addTenant(newTenant);
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
        <h2 className="text-3xl font-bold">הוספת שוכר חדש</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>פרטי השוכר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם השוכר</Label>
              <Input id="name" name="name" required value={formData.name} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">טלפון (אופציונלי)</Label>
                <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">אימייל (אופציונלי)</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "שומר..." : "שמור שוכר"}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
