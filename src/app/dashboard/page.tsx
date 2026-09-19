"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center h-full">טוען...</div>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">ברוך הבא למערכת ניהול הנכסים</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold mb-2">נכסים פעילים</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold mb-2">תזכורות</h3>
          <p className="text-3xl font-bold text-orange-500">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-xl font-semibold mb-2">הכנסה חודשית (צפי)</h3>
          <p className="text-3xl font-bold text-green-600">₪0</p>
        </div>
      </div>
    </div>
  );
}
