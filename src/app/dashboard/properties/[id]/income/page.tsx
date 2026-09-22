"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRentPaymentsByProperty, getTenantsByProperty } from "@/lib/db";
import { RentPayment, Tenant } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PropertyIncomePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [payments, setPayments] = useState<(RentPayment & { tenantName?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      try {
        const propPayments = await getRentPaymentsByProperty(id);
        const tenants = await getTenantsByProperty(id);
        
        const tenantMap = new Map(tenants.map(t => [t.id, t.name]));
        
        const enrichedPayments = propPayments.map(p => ({
          ...p,
          tenantName: tenantMap.get(p.tenantId) || "שוכר לא ידוע"
        }));

        setPayments(enrichedPayments.sort((a, b) => new Date(b.paidDate || b.expectedDate).getTime() - new Date(a.paidDate || a.expectedDate).getTime()));
      } catch (err) {
        console.error("Error fetching income", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, id]);

  if (loading) return <div className="p-8 text-center text-gray-500">טוען הכנסות...</div>;

  const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center space-x-4 space-x-reverse mb-6">
        <button onClick={() => router.push(`/dashboard/properties/${id}`)} className="text-gray-500 hover:text-gray-900 transition">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">הכנסות הנכס</h1>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-green-800 mb-1">סך הכנסות (שולמו) בנכס</h2>
        <p className="text-3xl font-bold text-green-900">₪{totalPaid.toLocaleString()}</p>
        <p className="text-sm text-green-700 mt-2">
          הערה: כדי להוסיף, לערוך או למחוק תשלום, יש לעבור ל<strong>היסטוריית תשלומים</strong> של השוכר הרלוונטי.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>כל התשלומים</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין תשלומים רשומים לנכס זה.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 font-semibold">שוכר</th>
                    <th className="p-3 font-semibold">תאריך לתשלום</th>
                    <th className="p-3 font-semibold">תאריך תשלום בפועל</th>
                    <th className="p-3 font-semibold">סכום</th>
                    <th className="p-3 font-semibold">סטטוס</th>
                    <th className="p-3 font-semibold">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map(payment => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{payment.tenantName}</td>
                      <td className="p-3">{new Date(payment.expectedDate).toLocaleDateString('he-IL')}</td>
                      <td className="p-3">{payment.paidDate ? new Date(payment.paidDate).toLocaleDateString('he-IL') : '-'}</td>
                      <td className="p-3 font-bold text-green-600">₪{payment.amount.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${payment.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {payment.status === 'PAID' ? 'שולם' : payment.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <Link href={`/dashboard/properties/${id}/tenants/${payment.tenantId}/payments`} className="text-blue-600 hover:underline text-xs">
                          נהל בכרטיס שוכר
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
