"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getPropertiesByUser, deleteProperty, getTenantsByProperty, getRentPeriodsByTenant } from "@/lib/db";
import { Property } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

export default function PropertiesPage() {
  const { user } = useAuth();
  const [enrichedProperties, setEnrichedProperties] = useState<(Property & { status: string, tenantName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProps = async () => {
    if (!user) return;
    try {
      const data = await getPropertiesByUser(user.uid);
      const enriched = await Promise.all(data.map(async (prop) => {
        let status = "פנוי";
        let tenantName = "";
        
        if (prop.id) {
          const tenants = await getTenantsByProperty(prop.id);
          const now = new Date();
          now.setHours(0,0,0,0);
          
          for (const t of tenants) {
            if (t.id) {
              const periods = await getRentPeriodsByTenant(t.id);
              const active = periods.find(p => {
                const s = new Date(p.startDate);
                const e = new Date(p.endDate);
                return now >= s && now <= e;
              });
              if (active) {
                status = "מושכר";
                tenantName = t.name;
                break;
              }
            }
          }
        }
        
        return { ...prop, status, tenantName };
      }));
      setEnrichedProperties(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

      {enrichedProperties.length === 0 ? (
        <div className="bg-white p-8 text-center rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500 mb-4">עדיין לא הוספת נכסים למערכת.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {enrichedProperties.map(property => (
            <Card key={property.id} className="w-full">
              <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Link href={`/dashboard/properties/${property.id}`}>
                      <h3 className="text-2xl font-bold text-blue-600 hover:underline">{property.address}</h3>
                    </Link>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${property.status === 'מושכר' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {property.status}
                    </span>
                  </div>
                  <div className="text-gray-600 mt-1 flex flex-wrap gap-2 text-sm">
                    <span><strong>עיר:</strong> {property.city}</span>
                    <span className="text-gray-300">|</span>
                    <span><strong>בעלים:</strong> {property.ownerName}</span>
                    {property.status === 'מושכר' && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span><strong>שוכר נוכחי:</strong> {property.tenantName}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/properties/${property.id}/edit`} className="text-gray-400 hover:text-blue-600 transition p-2" title="ערוך">
                    <Pencil className="w-5 h-5" />
                  </Link>
                  <button onClick={() => handleDelete(property.id as string)} className="text-gray-400 hover:text-red-600 transition p-2" title="מחק">
                    <Trash2 className="w-5 h-5" />
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
