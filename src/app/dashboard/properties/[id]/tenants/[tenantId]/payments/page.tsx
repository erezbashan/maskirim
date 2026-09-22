"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, use } from "react";
import { getRentPaymentsByUser, addRentPayment } from "@/lib/db";
import { updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { RentPayment } from "@/lib/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Check, Pencil } from "lucide-react";
import { HebrewDatePicker } from "@/components/ui/date-picker";

export default function TenantPaymentsPage({ params }: { params: Promise<{ id: string; tenantId: string }> }) {
  const { id, tenantId } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");

  const fetchPayments = async () => {
    if (!user) return;
    try {
      // Fetch all payments for user, then filter by tenant
      const all = await getRentPaymentsByUser(user.uid);
      const tenantPayments = all.filter(p => p.tenantId === tenantId).sort((a, b) => new Date(b.expectedDate).getTime() - new Date(a.expectedDate).getTime());
      setPayments(tenantPayments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [user, tenantId]);

  const handleDelete = async (paymentId: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק תשלום זה?")) {
      try {
        await deleteDoc(doc(db, "rentPayments", paymentId));
        fetchPayments();
      } catch (err) {
        console.error(err);
        alert("שגיאה במחיקת התשלום");
      }
    }
  };

  const handleEdit = (p: RentPayment) => {
    setEditingId(p.id!);
    setEditAmount(p.amount);
    setEditDate(p.paidDate.split("T")[0]); // just the YYYY-MM-DD part for input
  };

  const handleSave = async (p: RentPayment) => {
    if (!p.id) return;
    try {
      const docRef = doc(db, "rentPayments", p.id);
      await updateDoc(docRef, {
        amount: editAmount,
        paidDate: new Date(editDate).toISOString()
      });
      setEditingId(null);
      fetchPayments();
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון התשלום");
    }
  };

  if (loading) return <div>טוען תשלומים...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">היסטוריית תשלומים</h2>
        <Link href={`/dashboard/properties/${id}`} className="text-blue-600 hover:underline">
          חזרה לנכס
        </Link>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">תשלומים רשומים</h3>
        <button 
          onClick={() => {
            const amt = prompt("הכנס סכום (₪):");
            if (!amt) return;
            const dt = prompt("הכנס תאריך (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
            if (!dt) return;
            // A simple prompt-based addition for now, or just use the DB function
            addRentPayment({
              userId: user!.uid,
              propertyId: id,
              tenantId: tenantId,
              rentPeriodId: payments[0]?.rentPeriodId || 'manual',
              expectedDate: dt,
              paidDate: new Date(dt).toISOString(),
              amount: Number(amt),
              status: 'PAID'
            }).then(() => fetchPayments());
          }}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
        >
          + תשלום ידני
        </button>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            לא נמצאו תשלומים רשומים לשוכר זה. תשלומים שתסמן דרך התזכורות יופיעו כאן.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {payments.map(p => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold">תשלום עבור: {new Date(p.expectedDate).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</p>
                    <p className="text-sm text-gray-500">תאריך יעד מקורי: {new Date(p.expectedDate).toLocaleDateString('he-IL')}</p>
                  </div>
                  
                  {editingId === p.id ? (
                    <div className="flex items-center gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">סכום ששולם (₪)</label>
                        <Input type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} className="w-24" />
                      </div>
                      <div className="w-40">
                        <label className="text-xs text-gray-500 block mb-1">תאריך תשלום</label>
                        <HebrewDatePicker 
                          selected={editDate ? new Date(editDate) : null} 
                          onChange={(d) => setEditDate(d ? d.toISOString().split('T')[0] : '')} 
                        />
                      </div>
                      <div className="pt-5 flex gap-2">
                        <button onClick={() => handleSave(p)} className="bg-green-600 hover:bg-green-700 text-white p-2 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="border border-gray-300 hover:bg-gray-100 p-2 rounded">ביטול</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-left sm:text-right">
                      <div>
                        <p className="font-bold text-green-600">₪{p.amount.toLocaleString()}</p>
                        <p className="text-sm text-gray-500">שולם ב-{new Date(p.paidDate).toLocaleDateString('he-IL')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(p)} className="text-gray-400 hover:text-blue-600" title="ערוך"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(p.id!)} className="text-gray-400 hover:text-red-600" title="מחק"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
