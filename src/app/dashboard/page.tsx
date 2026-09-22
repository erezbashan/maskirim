"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPropertiesByUser, getTenantsByProperty, getRentPeriodsByTenant } from "@/lib/db";
import Link from "next/link";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);

  useEffect(() => {
    if (user) {
      getPropertiesByUser(user.uid).then(async (props) => {
        if (props.length === 0) {
          router.push("/dashboard/properties/new");
        } else {
          setPropertiesCount(props.length);
          
          let totalMonthlyIncome = 0;
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          // Fetch all tenants and their rent periods to calculate current active income
          for (const prop of props) {
            if (!prop.id) continue;
            const propTenants = await getTenantsByProperty(prop.id);
            for (const tenant of propTenants) {
              if (!tenant.id) continue;
              const periods = await getRentPeriodsByTenant(tenant.id);
              
              // Find active periods
              const activePeriods = periods.filter(p => {
                const start = new Date(p.startDate);
                const end = new Date(p.endDate);
                return now >= start && now <= end;
              });

              for (const p of activePeriods) {
                if (p.monthlyRent) {
                  totalMonthlyIncome += Number(p.monthlyRent);
                }
              }
            }
          }
          setMonthlyIncome(totalMonthlyIncome);
        }
      });
    }
  }, [user, router]);

  if (loading || propertiesCount === null) {
    return <div className="flex items-center justify-center h-full">טוען...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">ברוך הבא למערכת ניהול הנכסים</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/properties" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition block cursor-pointer">
          <h3 className="text-xl font-semibold mb-2">נכסים פעילים</h3>
          <p className="text-3xl font-bold text-blue-600">{propertiesCount}</p>
        </Link>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold mb-2">תזכורות</h3>
          <p className="text-3xl font-bold text-orange-500">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold mb-2">הכנסה חודשית (צפי)</h3>
          <p className="text-3xl font-bold text-green-600">₪{monthlyIncome.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
