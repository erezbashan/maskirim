"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTenantById, getRentPeriodsByTenant } from "@/lib/db";
import { Tenant, RentPeriod } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function TenantDetailsPage() {
  const { id: propertyId, tenantId } = useParams() as { id: string, tenantId: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [rentPeriods, setRentPeriods] = useState<RentPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !tenantId) return;
    
    const fetchData = async () => {
      try {
        const t = await getTenantById(tenantId);
        if (t) setTenant(t);

        const periods = await getRentPeriodsByTenant(tenantId);
        // Sort periods by start date descending
        periods.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        setRentPeriods(periods);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, tenantId]);

  if (loading) return <div>טוען נתונים...</div>;
  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">שוכר: {tenant.name}</h2>
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:underline"
        >
          חזור לנכס
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>פרטי השוכר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>שם:</strong> {tenant.name}</p>
            {tenant.phone && <p><strong>טלפון:</strong> {tenant.phone}</p>}
            {tenant.email && <p><strong>אימייל:</strong> {tenant.email}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>תקופות שכירות (Rent Periods)</CardTitle>
            <Link 
              href={`/dashboard/properties/${propertyId}/tenants/${tenantId}/rent-periods/new`}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
            >
              הוסף תקופה (הארכה)
            </Link>
          </CardHeader>
          <CardContent>
            {rentPeriods.length === 0 ? (
              <p className="text-gray-500">אין תקופות שכירות רשומות.</p>
            ) : (
              <div className="space-y-4">
                {rentPeriods.map(period => (
                  <div key={period.id} className="border p-4 rounded shadow-sm relative">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <p><strong>תאריך התחלה:</strong> {new Date(period.startDate).toLocaleDateString()}</p>
                      <p><strong>תאריך סיום:</strong> {new Date(period.endDate).toLocaleDateString()}</p>
                      <p><strong>שכר דירה:</strong> ₪{period.monthlyRent}</p>
                      <p><strong>יום תשלום:</strong> ה-{period.paymentDueDay} בחודש</p>
                    </div>
                    {period.guaranteeType && <p className="text-sm mt-2"><strong>ערבויות:</strong> {period.guaranteeType}</p>}
                    {period.documentUrl && (
                      <a href={period.documentUrl} target="_blank" rel="noreferrer" className="text-blue-500 underline text-sm mt-2 inline-block">
                        צפה בחוזה / מסמך
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
