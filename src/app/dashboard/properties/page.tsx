"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getPropertiesByUser, deleteProperty } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProps = () => {
    if (user) {
      getPropertiesByUser(user.uid)
        .then(data => setProperties(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchProps();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (window.confirm("האם אתה בטוח שברצונך למחוק נכס זה? הפעולה בלתי הפיכה.")) {
      try {
        await deleteProperty(id);
        fetchProps();
      } catch (err) {
        console.error(err);
        alert("שגיאה במחיקת הנכס");
      }
    }
  };

  if (loading) return <div>טוען נכסים...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">הנכסים שלי</h2>
        <Link 
          href="/dashboard/properties/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
        >
          + הוסף נכס
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500 mb-4">עדיין לא הוספת נכסים למערכת.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {properties.map(property => (
            <Card key={property.id} className="w-full">
              <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <Link href={`/dashboard/properties/${property.id}`}>
                    <h3 className="text-2xl font-bold text-blue-600 hover:underline">{property.address}</h3>
                  </Link>
                  <div className="text-gray-600 mt-1">
                    <span><strong>עיר:</strong> {property.city}</span> | <span><strong>בעלים רשום:</strong> {property.ownerName}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/properties/${property.id}/edit`} className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition">
                    ערוך
                  </Link>
                  <button onClick={() => handleDelete(property.id as string)} className="bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100 transition">
                    מחק
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
