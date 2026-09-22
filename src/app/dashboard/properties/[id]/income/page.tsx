"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getRentPaymentsByProperty, getTenantsByProperty, addRentPayment } from "@/lib/db";
import { RentPayment, Tenant } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HebrewDatePicker } from "@/components/ui/date-picker";
import { ArrowRight, Trash2, Pencil, Check, X } from "lucide-react";

export default function PropertyIncomePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [payments, setPayments] = useState<(RentPayment & { tenantName?: string })[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Income state
  const [isAdding, setIsAdding] = useState(false);
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  // Edit Income state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");

  const fetchData = async () => {
    if (!user || !id) return;
    try {
      const propPayments = await getRentPaymentsByProperty(id);
      const fetchedTenants = await getTenantsByProperty(id);
      setTenants(fetchedTenants);
      
      const tenantMap = new Map(fetchedTenants.map(t => [t.id, t.name]));
      
      const enrichedPayments = propPayments.map(p => ({
        ...p,
        tenantName: tenantMap.get(p.tenantId) || "שוכר לא ידוע"
      }));

      setPayments(enrichedPayments.sort((a, b) => new Date(b.paidDate || b.expectedDate).getTime() - new Date(a.paidDate || a.expectedDate).getTime()));
      
      if (fetchedTenants.length > 0 && !selectedTenant) {
        setSelectedTenant(fetchedTenants[0].id!);
      }
    } catch (err) {
      console.error("Error fetching income", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, id]);

  const handleAddSave = async () => {
    if (!user || !newAmount || !newDate || !selectedTenant) return;
    try {
      await addRentPayment({
        userId: user.uid,
        propertyId: id,
        tenantId: selectedTenant,
        rentPeriodId: 'manual',
        expectedDate: newDate,
        paidDate: new Date(newDate).toISOString(),
        amount: Number(newAmount),
        status: 'PAID'
      });
      setIsAdding(false);
      setNewAmount("");
      setNewDate(new Date().toISOString().split("T")[0]);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("שגיאה בהוספת ההכנסה");
    }
  };

  const handleEdit = (p: RentPayment) => {
    setEditingId(p.id!);
    setEditAmount(p.amount);
    setEditDate(p.paidDate ? p.paidDate.split("T")[0] : p.expectedDate.split("T")[0]);
  };

  const handleEditSave = async (p: RentPayment) => {
    if (!p.id) return;
    try {
      const docRef = doc(db, "rentPayments", p.id);
      await updateDoc(docRef, {
        amount: editAmount,
        paidDate: new Date(editDate).toISOString()
      });
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון התשלום");
    }
  };

  const handleDelete = async (paymentId: string) => {
    if (confirm("האם למחוק הכנסה זו?")) {
      await deleteDoc(doc(db, "rentPayments", paymentId));
      setPayments(prev => prev.filter(p => p.id !== paymentId));
    }
  };

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

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-green-800 mb-1">סך הכנסות (שולמו) בנכס</h2>
          <p className="text-3xl font-bold text-green-900">₪{totalPaid.toLocaleString()}</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-green-600 text-white px-4 py-2 rounded shadow-sm hover:bg-green-700 font-medium"
        >
          {isAdding ? "ביטול" : "+ הוסף הכנסה ידנית"}
        </button>
      </div>

      {isAdding && (
        <Card className="mb-6 bg-white border-green-300 shadow-sm">
          <CardHeader className="bg-green-50/50 border-b border-green-100 pb-4">
            <CardTitle className="text-green-800 text-lg">הוספת תשלום חדש</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col md:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <label className="text-sm font-semibold text-gray-700 block mb-1">שייך לשוכר</label>
              <select 
                className="w-full border-gray-300 rounded-md shadow-sm border p-2"
                value={selectedTenant}
                onChange={e => setSelectedTenant(e.target.value)}
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {tenants.length === 0 && <option value="manual">כללי (ללא שוכר)</option>}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="text-sm font-semibold text-gray-700 block mb-1">סכום (₪)</label>
              <Input type="number" placeholder="הכנס סכום" value={newAmount} onChange={e => setNewAmount(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="flex-1 w-full">
              <label className="text-sm font-semibold text-gray-700 block mb-1">תאריך קבלה</label>
              <HebrewDatePicker 
                selected={newDate ? new Date(newDate) : null} 
                onChange={(date) => {
                  if (date) {
                    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
                    setNewDate(localDate.toISOString().split("T")[0]);
                  } else {
                    setNewDate("");
                  }
                }} 
              />
            </div>
            <div className="w-full md:w-auto">
              <button 
                onClick={handleAddSave}
                disabled={newAmount === "" || !newDate || (!selectedTenant && tenants.length > 0)}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded text-sm font-medium transition whitespace-nowrap w-full"
              >
                שמור הכנסה
              </button>
            </div>
          </CardContent>
        </Card>
      )}

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
                      <td className="p-3 font-medium text-gray-900">
                        {payment.tenantName}
                      </td>
                      <td className="p-3">{new Date(payment.expectedDate).toLocaleDateString('he-IL')}</td>
                      
                      {editingId === payment.id ? (
                        <>
                          <td className="p-2">
                            <HebrewDatePicker 
                              selected={editDate ? new Date(editDate) : null} 
                              onChange={(d) => setEditDate(d ? d.toISOString().split('T')[0] : '')} 
                            />
                          </td>
                          <td className="p-2">
                            <Input type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} className="w-24" />
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              שולם
                            </span>
                          </td>
                          <td className="p-2 flex items-center gap-2 mt-1">
                            <button onClick={() => handleEditSave(payment)} className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded" title="שמור"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditingId(null)} className="border border-gray-300 hover:bg-gray-100 p-1.5 rounded" title="ביטול"><X className="w-4 h-4" /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-3">{payment.paidDate ? new Date(payment.paidDate).toLocaleDateString('he-IL') : '-'}</td>
                          <td className="p-3 font-bold text-green-600">₪{payment.amount.toLocaleString()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${payment.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {payment.status === 'PAID' ? 'שולם' : payment.status}
                            </span>
                          </td>
                          <td className="p-3 flex items-center gap-3">
                            <button onClick={() => handleEdit(payment)} className="text-gray-400 hover:text-blue-600 transition" title="ערוך">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(payment.id!)} className="text-gray-400 hover:text-red-600 transition" title="מחק">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
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
