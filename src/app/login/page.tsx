"use client";

import { useEffect } from "react";
import { compatAuth } from "@/lib/firebase/config";
import firebase from "firebase/compat/app";
import "firebaseui/dist/firebaseui.css";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window !== "undefined" && !loading && !user) {
      // Dynamically import firebaseui to avoid SSR window issues
      import("firebaseui").then((firebaseui) => {
        const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(compatAuth);
        
        ui.start("#firebaseui-auth-container", {
          signInSuccessUrl: "/dashboard",
          signInOptions: [
            firebase.auth.EmailAuthProvider.PROVIDER_ID,
          ],
          tosUrl: "/",
          privacyPolicyUrl: "/",
        });
      });
    }
  }, [loading, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-center mb-6">התחברות למערכת</h2>
        <div id="firebaseui-auth-container" dir="ltr"></div>
      </div>
    </div>
  );
}
