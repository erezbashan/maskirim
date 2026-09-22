"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getExpensesByProperty, deleteExpense } from "@/lib/db";
import { Expense } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";

export default function PropertyExpensesPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      try {
        const propExpenses = await getExpensesByProperty(id);
        setExpenses(propExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        console.error("Error fetching expenses", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, id]);

  const handleDeleteExpense = async (expenseId: string, receiptUrl?: string) => {
    if (confirm("האם למחוק הוצאה זו?")) {
      await deleteExpense(id, expenseId, receiptUrl);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
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
                <div key={expense.id} className="p-4 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-lg text-red-600">₪{expense.amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-600"><strong>תאריך:</strong> {new Date(expense.date).toLocaleDateString('he-IL')}</p>
                    <p className="text-sm text-gray-600"><strong>קטגוריה:</strong> {expense.category}</p>
                    {expense.description && <p className="text-sm text-gray-500 mt-1">{expense.description}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    {expense.receiptUrl && (
                      <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition">צפה בקבלה</a>
                    )}
                    <button onClick={() => handleDeleteExpense(expense.id!, expense.receiptUrl)} className="text-gray-400 hover:text-red-600 transition" title="מחק הוצאה">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
