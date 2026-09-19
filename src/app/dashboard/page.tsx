"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">טוען...</div>;
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow">
        <h1 className="text-2xl font-bold">לוח בקרה - נכסים</h1>
        <div className="flex items-center gap-4">
          <span>שלום, {user.email}</span>
          <button 
            onClick={handleLogout}
            className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200"
          >
            התנתק
          </button>
        </div>
      </header>

      <main>
        <p>כאן יופיעו הנכסים, התזכורות וההוצאות שלך.</p>
      </main>
    </div>
  );
}
