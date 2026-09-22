"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import GlobalUploader from "@/components/GlobalUploader";
import { Upload } from "lucide-react";

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
        <div className="p-4 border-b space-y-4">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent("open-smart-uploader"))}
            className="w-full bg-blue-600 text-white p-3 rounded-lg shadow-sm hover:bg-blue-700 transition flex items-center justify-center space-x-2 space-x-reverse font-bold text-sm"
          >
            <Upload className="w-5 h-5" />
            <span>תיבה חכמה (העלאת מסמכים)</span>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            ראשי
          </Link>
          <Link href="/dashboard/properties" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            נכסים
          </Link>
          <Link href="/dashboard/taxes" className="block px-4 py-2 rounded text-gray-700 hover:bg-gray-100">
            סימולטור מס
          </Link>
          
          <div className="pt-4 mt-4 border-t border-gray-100">
            <a 
              href={`mailto:erez.bashan@gmail.com?subject=${encodeURIComponent('משוב על מערכת ניהול נכסים')}&body=${encodeURIComponent('כתובת עמוד: ')}${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}%0A%0A${encodeURIComponent('המשוב שלי: ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 rounded text-gray-600 hover:bg-gray-100 text-sm"
            >
              שלח משוב
            </a>
          </div>
        </nav>
        <div className="p-4 border-t space-y-2">
          <div className="text-sm mb-2 truncate text-center text-gray-600" title={user.email || ""}>
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
