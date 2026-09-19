"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getPropertiesByUser } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getPropertiesByUser(user.uid)
        .then(data => setProperties(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [user]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map(property => (
            <Link href={`/dashboard/properties/${property.id}`} key={property.id} className="block transition-transform hover:-translate-y-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{property.address}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>עיר:</strong> {property.city}</p>
                  <p><strong>חדרים:</strong> {property.rooms}</p>
                  <p><strong>בעלים רשום:</strong> {property.ownerName}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
