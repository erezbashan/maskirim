"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { updateProperty, getPropertiesByUser } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditPropertyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    ownerName: "",
    address: "",
    city: "",
    notes: "",
  });

  useEffect(() => {
    if (!user || !id) return;
    // We fetch properties by user and find the one matching ID (as getPropertyById doesn't exist yet)
    getPropertiesByUser(user.uid).then(props => {
      const prop = props.find(p => p.id === id);
      if (prop) {
        setFormData({
          ownerName: prop.ownerName || "",
          address: prop.address || "",
          city: prop.city || "",
          notes: prop.notes || "",
        });
      }
      setFetching(false);
    });
  }, [user, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      await updateProperty(id, {
        ownerName: formData.ownerName || "לא מוגדר",
        address: formData.address,
        city: formData.city,
        notes: formData.notes,
      });
      router.push("/dashboard/properties");
    } catch (err) {
      console.error("Error updating property", err);
      alert("שגיאה בעדכון הנכס");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8">טוען נתונים...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">עריכת נכס</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור
        </button>
      </div>

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
    </div>
  );
}
