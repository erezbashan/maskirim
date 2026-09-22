"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { getPropertiesByUser, getTenantsByProperty, getExpensesByProperty, getDocumentsByProperty, getRentPeriodsByTenant, deleteTenant, deleteRentPeriod, deleteProperty } from "@/lib/db";
import { Property, Tenant, Expense, Document as AppDocument, RentPeriod } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentPeriodsByTenant, setRentPeriodsByTenant] = useState<Record<string, RentPeriod[]>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      try {
        const userProps = await getPropertiesByUser(user.uid);
        const prop = userProps.find(p => p.id === id);
        if (prop) setProperty(prop);

        const propTenants = await getTenantsByProperty(id);
        setTenants(propTenants);

        const periodsMap: Record<string, RentPeriod[]> = {};
        for (const t of propTenants) {
          if (t.id) {
            periodsMap[t.id] = await getRentPeriodsByTenant(t.id);
          }
        }
        setRentPeriodsByTenant(periodsMap);

        const propExpenses = await getExpensesByProperty(id);
        setExpenses(propExpenses);

        const propDocs = await getDocumentsByProperty(id);
        setDocuments(propDocs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, id]);

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק שוכר זה ואת כל תקופות השכירות שלו?")) return;
    try {
      await deleteTenant(tenantId);
      setTenants(prev => prev.filter(t => t.id !== tenantId));
    } catch (e) {
      console.error(e);
      alert("שגיאה במחיקת שוכר");
    }
  };

  const handleDeleteRentPeriod = async (tenantId: string, periodId: string, url?: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק תקופת שכירות זו?")) return;
    try {
      await deleteRentPeriod(periodId, url);
      setRentPeriodsByTenant(prev => ({
        ...prev,
        [tenantId]: prev[tenantId].filter(p => p.id !== periodId)
      }));
    } catch (e) {
      console.error(e);
      alert("שגיאה במחיקת תקופה");
    }
  };

  if (loading) return <div>טוען נתונים...</div>;
  if (!property) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{property.address}, {property.city}</h2>
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:underline"
        >
          חזור לרשימה
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>פרטי נכס</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>בעלים רשום:</strong> {property.ownerName}</p>
            {property.notes && <p><strong>הערות:</strong> {property.notes}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>שוכרים</CardTitle>
            <Link 
              href={`/dashboard/properties/${id}/tenants/new`}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
            >
              הוסף שוכר חדש
            </Link>
          </CardHeader>
          <CardContent>
            {tenants.length === 0 ? (
              <p className="text-gray-500">אין שוכרים רשומים.</p>
            ) : (
              <div className="space-y-6">
                {tenants.map(tenant => (
                  <div key={tenant.id} className="border rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">{tenant.name}</h3>
                        {tenant.paymentDueDay && <p className="text-sm text-gray-600">יום תשלום: ה-{tenant.paymentDueDay} בחודש</p>}
                      </div>
                      <div className="flex space-x-3 space-x-reverse">
                        <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/edit`} className="text-blue-600 text-sm hover:underline font-medium">ערוך שוכר</Link>
                        <button onClick={() => handleDeleteTenant(tenant.id!)} className="text-red-600 text-sm hover:underline font-medium">מחק שוכר</button>
                      </div>
                    </div>
                    <div className="p-4 bg-white">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-gray-700">תקופות שכירות</h4>
                        <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/rent-periods/new`} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-medium">הוסף תקופה</Link>
                      </div>
                      
                      {(!rentPeriodsByTenant[tenant.id!] || rentPeriodsByTenant[tenant.id!].length === 0) ? (
                        <p className="text-sm text-gray-500">אין תקופות שכירות רשומות.</p>
                      ) : (
                        <div className="space-y-3">
                          {rentPeriodsByTenant[tenant.id!].map(period => (
                            <div key={period.id} className="border p-3 rounded text-sm relative">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                                <p><strong>מתאריך:</strong> {new Date(period.startDate).toLocaleDateString()}</p>
                                <p><strong>עד תאריך:</strong> {new Date(period.endDate).toLocaleDateString()}</p>
                                <p><strong>שכירות:</strong> ₪{period.monthlyRent}</p>
                                {period.guaranteeType && <p><strong>ערבות:</strong> {period.guaranteeType}</p>}
                              </div>
                              <div className="flex space-x-3 space-x-reverse text-xs mt-3 pt-2 border-t border-gray-100">
                                <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/rent-periods/${period.id}/edit`} className="text-blue-600 hover:underline">ערוך תקופה</Link>
                                <button onClick={() => handleDeleteRentPeriod(tenant.id!, period.id!, period.documentUrl)} className="text-red-600 hover:underline">מחק תקופה</button>
                                {period.documentUrl && (
                                  <a href={period.documentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold pr-2 border-r border-gray-300">📄 צפה בחוזה</a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>הוצאות אחרונות</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-gray-500">אין הוצאות רשומות</p>
            ) : (
              <div className="space-y-4">
                {expenses.map((expense) => (
                  <div key={expense.id} className="p-4 border rounded shadow-sm">
                    <p><strong>תאריך:</strong> {new Date(expense.date).toLocaleDateString()}</p>
                    <p><strong>סכום:</strong> ₪{expense.amount}</p>
                    {expense.description && <p><strong>תיאור:</strong> {expense.description}</p>}
                    {expense.receiptUrl && (
                      <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-500 underline text-sm mt-2 inline-block">צפה בקבלה</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>מסמכים סרוקים</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-gray-500">אין מסמכים מצורפים לנכס זה</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-3 border rounded shadow-sm flex justify-between items-center bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800">{doc.name}</p>
                      <p className="text-xs text-gray-500">סוג: {doc.type} | תאריך: {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200">
                      צפה במסמך
                    </a>
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
