"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Property, Lease, Expense } from "@/lib/types";
import { getLeasesByProperty, getExpensesByProperty } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const docSnap = await getDoc(doc(db, "properties", id));
        if (docSnap.exists()) {
          setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
          const [loadedLeases, loadedExpenses] = await Promise.all([
            getLeasesByProperty(docSnap.id),
            getExpensesByProperty(docSnap.id)
          ]);
          setLeases(loadedLeases);
          setExpenses(loadedExpenses);
        } else {
          router.push("/dashboard/properties");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, router]);

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
            <p><strong>חדרים:</strong> {property.rooms}</p>
            {property.sizeSqm && <p><strong>גודל:</strong> {property.sizeSqm} מ"ר</p>}
            {property.notes && <p><strong>הערות:</strong> {property.notes}</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>חוזי שכירות</CardTitle>
            <button className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700">
              הוסף חוזה (בקרוב)
            </button>
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
      </div>
    </div>
  );
}
