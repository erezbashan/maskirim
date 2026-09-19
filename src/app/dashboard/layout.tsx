"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import GlobalUploader from "@/components/GlobalUploader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex relative">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-l shadow-sm flex flex-col z-10">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-blue-600">Maskirim</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            ראשי
          </Link>
          <Link href="/dashboard/properties" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            הנכסים שלי
          </Link>
          <Link href="/dashboard/taxes" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            סימולטור מס
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="text-sm mb-2 truncate" title={user.email || ""}>
            {user.email}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full text-center px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
          >
            התנתק
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 pb-32">
        {children}
      </main>

      <GlobalUploader />
    </div>
  );
}
