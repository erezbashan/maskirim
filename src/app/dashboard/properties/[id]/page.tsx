"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { getPropertiesByUser, getLeasesByProperty, getExpensesByProperty, getDocumentsByProperty } from "@/lib/db";
import { Property, Lease, Expense, Document as AppDocument } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      try {
        // In a real app we'd have getPropertyById, for now we filter:
        const userProps = await getPropertiesByUser(user.uid);
        const prop = userProps.find(p => p.id === id);
        if (prop) setProperty(prop);

        const propLeases = await getLeasesByProperty(id);
        setLeases(propLeases);

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
            <CardTitle>חוזי שכירות</CardTitle>
            <Link 
              href={`/dashboard/properties/${id}/leases/new`}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
            >
              הוסף חוזה
            </Link>
          </CardHeader>
          <CardContent>
            {leases.length === 0 ? (
              <p className="text-gray-500">אין חוזים פעילים.</p>
            ) : (
              <ul className="space-y-2">
                {leases.map(lease => (
                  <li key={lease.id} className="border p-3 rounded">
                    <strong>{lease.tenantName}</strong> - {lease.monthlyRent} ₪ / חודש
                    <br />
                    <span className="text-sm text-gray-600">
                      תוקף: {new Date(lease.startDate).toLocaleDateString()} עד {new Date(lease.endDate).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
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
