"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPropertiesByUser, getTenantsByProperty, getRentPeriodsByTenant, getRentPaymentsByUser, addRentPayment } from "@/lib/db";
import Link from "next/link";
import { Check, Bell, FileText, AlertTriangle } from "lucide-react";

export type ReminderType = 'PAYMENT_DUE' | 'LEASE_EXPIRATION' | 'OPTION_DEADLINE';
export interface ActiveReminder {
  id: string; 
  type: ReminderType;
  title: string;
  description: string;
  date: string;
  propertyId: string;
  tenantId: string;
  periodId?: string;
  amount?: number;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [reminders, setReminders] = useState<ActiveReminder[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // to force refresh after marking paid

  useEffect(() => {
    if (user) {
      getPropertiesByUser(user.uid).then(async (props) => {
        if (props.length === 0) {
          router.push("/dashboard/properties/new");
        } else {
          setPropertiesCount(props.length);
          
          let totalMonthlyIncome = 0;
          const generatedReminders: ActiveReminder[] = [];
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();

          const allPayments = await getRentPaymentsByUser(user.uid);

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

                // 1. Check Rent Payment Collection
                if (tenant.paymentDueDay && p.id) {
                  const expectedDate = new Date(currentYear, currentMonth, tenant.paymentDueDay);
                  expectedDate.setHours(0, 0, 0, 0);

                  // If today is on or past the due date for THIS month
                  if (now >= expectedDate) {
                    const expectedDateStr = expectedDate.toISOString().split('T')[0];
                    const hasPaid = allPayments.some(pay => 
                      pay.tenantId === tenant.id && 
                      pay.rentPeriodId === p.id && 
                      pay.expectedDate === expectedDateStr
                    );

                    if (!hasPaid) {
                      generatedReminders.push({
                        id: `payment-${tenant.id}-${expectedDateStr}`,
                        type: 'PAYMENT_DUE',
                        title: 'גביית שכר דירה',
                        description: `שכר דירה מאת ${tenant.name} (${prop.address}) לחודש זה (₪${p.monthlyRent}) ממתין לגבייה.`,
                        date: expectedDateStr,
                        propertyId: prop.id,
                        tenantId: tenant.id,
                        periodId: p.id,
                        amount: Number(p.monthlyRent)
                      });
                    }
                  }
                }

                // 2. Check Lease Expiration
                const endDate = new Date(p.endDate);
                const diffTime = endDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays >= 0 && diffDays <= 60) {
                  generatedReminders.push({
                    id: `expire-${p.id}`,
                    type: 'LEASE_EXPIRATION',
                    title: 'סיום חוזה מתקרב',
                    description: `חוזה השכירות של ${tenant.name} (${prop.address}) מסתיים בעוד ${diffDays} ימים.`,
                    date: p.endDate,
                    propertyId: prop.id,
                    tenantId: tenant.id,
                    periodId: p.id
                  });
                }

                // 3. Check Option Deadline
                if (p.renewalDeadline && !(p as any).renewalDeadlineDismissed) {
                  const deadlineDate = new Date(p.renewalDeadline);
                  const deadlineDiffTime = deadlineDate.getTime() - now.getTime();
                  const deadlineDiffDays = Math.ceil(deadlineDiffTime / (1000 * 60 * 60 * 24));
                  
                  // Make sure no newer rent period exists for this tenant
                  const hasNewerPeriod = periods.some(otherP => new Date(otherP.startDate) > new Date(p.startDate));
                  
                  if (!hasNewerPeriod && deadlineDiffDays >= 0 && deadlineDiffDays <= 30) {
                    generatedReminders.push({
                      id: `option-${p.id}`,
                      type: 'OPTION_DEADLINE',
                      title: 'חלון מימוש אופציה',
                      description: `המועד האחרון להודעה על אופציה של ${tenant.name} (${prop.address}) בעוד ${deadlineDiffDays} ימים.`,
                      date: p.renewalDeadline,
                      propertyId: prop.id,
                      tenantId: tenant.id,
                      periodId: p.id
                    });
                  }
                }
              }
            }
          }
          setMonthlyIncome(totalMonthlyIncome);
          setReminders(generatedReminders);
        }
      });
    }
  }, [user, router, refreshTrigger]);

  const handleMarkPaid = async (reminder: ActiveReminder) => {
    if (!user) return;
    try {
      await addRentPayment({
        userId: user.uid,
        propertyId: reminder.propertyId,
        tenantId: reminder.tenantId,
        rentPeriodId: reminder.periodId!,
        expectedDate: reminder.date,
        paidDate: new Date().toISOString(),
        amount: reminder.amount!,
        status: 'PAID'
      });
      // Navigate to payment history
      router.push(`/dashboard/properties/${reminder.propertyId}/tenants/${reminder.tenantId}/payments`);
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון התשלום");
    }
  };

  const handleDismissOption = async (reminder: ActiveReminder) => {
    if (!user || !reminder.periodId) return;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/config");
      await updateDoc(doc(db, "rentPeriods", reminder.periodId), {
        renewalDeadlineDismissed: true
      });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || propertiesCount === null) {
    return <div className="flex items-center justify-center h-full">טוען...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-6">ברוך הבא למערכת ניהול הנכסים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/dashboard/properties" className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition block cursor-pointer">
            <h3 className="text-xl font-semibold mb-2">נכסים פעילים</h3>
            <p className="text-3xl font-bold text-blue-600">{propertiesCount}</p>
          </Link>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold mb-2">הכנסה חודשית (צפי)</h3>
            <p className="text-3xl font-bold text-green-600">₪{monthlyIncome.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {reminders.length > 0 && (
        <div>
          <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Bell className="w-6 h-6 text-orange-500" />
            משימות ותזכורות
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y">
            {reminders.map(reminder => (
              <div key={reminder.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${
                    reminder.type === 'PAYMENT_DUE' ? 'bg-green-100 text-green-600' :
                    reminder.type === 'LEASE_EXPIRATION' ? 'bg-red-100 text-red-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {reminder.type === 'PAYMENT_DUE' && <span className="text-lg font-bold">₪</span>}
                    {reminder.type === 'LEASE_EXPIRATION' && <FileText className="w-5 h-5" />}
                    {reminder.type === 'OPTION_DEADLINE' && <AlertTriangle className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{reminder.title}</h4>
                    <p className="text-sm text-gray-600">{reminder.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {reminder.type === 'PAYMENT_DUE' && (
                    <button 
                      onClick={() => handleMarkPaid(reminder)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition"
                    >
                      סמן כשולם
                    </button>
                  )}
                  {reminder.type === 'LEASE_EXPIRATION' && (
                    <Link 
                      href={`/dashboard/properties/${reminder.propertyId}/tenants/${reminder.tenantId}/rent-periods/new`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition inline-block"
                    >
                      צור הארכה
                    </Link>
                  )}
                  {reminder.type === 'OPTION_DEADLINE' && (
                    <>
                      <button 
                        onClick={() => handleDismissOption(reminder)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium transition"
                      >
                        הסתר
                      </button>
                      <Link 
                        href={`/dashboard/properties/${reminder.propertyId}/tenants/${reminder.tenantId}/edit`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition inline-block"
                      >
                        צפה בשוכר
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
