"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExpensesByProperty, deleteExpense } from "@/lib/db";
import { Expense } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HebrewDatePicker } from "@/components/ui/date-picker";
import { ArrowRight, Trash2, Pencil, Check, X } from "lucide-react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import Link from "next/link";

export default function PropertyExpensesPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Expense State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");

  const fetchData = async () => {
    if (!user || !id) return;
    try {
      const propExpenses = await getExpensesByProperty(id);
      setExpenses(propExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error("Error fetching expenses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, id]);

  const handleDeleteExpense = async (expenseId: string, receiptUrl?: string) => {
    if (confirm("האם למחוק הוצאה זו?")) {
      await deleteExpense(expenseId);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    }
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id!);
    setEditAmount(e.amount);
    setEditDate(e.date.split("T")[0]);
    setEditCategory(e.category);
    setEditDescription(e.description || "");
  };

  const handleEditSave = async (e: Expense) => {
    if (!e.id) return;
    try {
      const docRef = doc(db, "expenses", e.id);
      await updateDoc(docRef, {
        amount: editAmount,
        date: new Date(editDate).toISOString(),
        category: editCategory,
        description: editDescription
      });
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("שגיאה בעדכון ההוצאה");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען הוצאות...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center space-x-4 space-x-reverse mb-6">
        <button onClick={() => router.push(`/dashboard/properties/${id}`)} className="text-gray-500 hover:text-gray-900 transition">
          <ArrowRight className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold text-gray-900">הוצאות הנכס</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>כל ההוצאות</CardTitle>
          <Link href={`/dashboard/properties/${id}/expenses/new`} className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            הוסף הוצאה חדשה
          </Link>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">אין הוצאות רשומות לנכס זה.</p>
          ) : (
            <div className="space-y-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                  
                  {editingId === expense.id ? (
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">סכום (₪)</label>
                        <Input type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} className="w-full" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">תאריך</label>
                        <HebrewDatePicker 
                          selected={editDate ? new Date(editDate) : null} 
                          onChange={(d) => setEditDate(d ? d.toISOString().split('T')[0] : '')} 
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">קטגוריה</label>
                        <Input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">תיאור</label>
                        <Input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full" />
                      </div>
                      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                        <button onClick={() => setEditingId(null)} className="border border-gray-300 hover:bg-gray-100 px-4 py-2 rounded text-sm transition font-medium">ביטול</button>
                        <button onClick={() => handleEditSave(expense)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition font-medium flex items-center gap-1">
                          <Check className="w-4 h-4" /> שמור שינויים
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <p className="font-semibold text-lg text-red-600">₪{expense.amount.toLocaleString()}</p>
                        <p className="text-sm text-gray-600"><strong>תאריך:</strong> {new Date(expense.date).toLocaleDateString('he-IL')}</p>
                        <p className="text-sm text-gray-600"><strong>קטגוריה:</strong> {expense.category}</p>
                        {expense.description && <p className="text-sm text-gray-500 mt-1">{expense.description}</p>}
                      </div>
                      <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0">
                        {expense.receiptUrl && (
                          <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition">צפה בקבלה</a>
                        )}
                        <button onClick={() => handleEdit(expense)} className="text-gray-400 hover:text-blue-600 transition p-2" title="ערוך הוצאה">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteExpense(expense.id!, expense.receiptUrl)} className="text-gray-400 hover:text-red-600 transition p-2" title="מחק הוצאה">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
