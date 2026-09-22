"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SmartUploadHeader({ title, description }: { title: string, description?: string }) {
  const triggerUploader = () => {
    window.dispatchEvent(new CustomEvent("open-smart-uploader"));
  };

  return (
    <Card className="border-blue-200 shadow-md mb-6 cursor-pointer hover:bg-blue-50/80 transition" onClick={triggerUploader}>
      <CardHeader className="bg-blue-50/50 border-b rounded-t-xl">
        <CardTitle className="text-2xl text-blue-800">{title}</CardTitle>
        <CardDescription className="text-blue-900/70">
          {description || (
            <span>
              הזן את הפרטים ידנית להלן, או <b className="underline">לחץ כאן כדי להעלות מסמך</b> והמערכת תשלוף את הנתונים באופן אוטומטי!
            </span>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
