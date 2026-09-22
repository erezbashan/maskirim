"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDocumentsByProperty, getPropertiesByUser } from "@/lib/db";
import { Document as AppDocument, Property } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DocumentsRepositoryPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      try {
        const userProps = await getPropertiesByUser(user.uid);
        const prop = userProps.find(p => p.id === id);
        if (prop) setProperty(prop);

        const propDocs = await getDocumentsByProperty(id);
        setDocuments(propDocs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, id]);

  const typeTranslations: Record<string, string> = {
    "LEASE": "חוזה שכירות",
    "EXTENSION": "הארכת שכירות",
    "TERMINATION": "סיום חוזה",
    "EXPENSE": "הוצאה / קבלה",
    "ID_CARD": "תעודה מזהה",
    "OTHER": "מסמך כללי"
  };

  const filteredDocs = documents
    .filter(doc => 
      doc.name.toLowerCase().includes(search.toLowerCase()) || 
      (typeTranslations[doc.type] || doc.type).toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading) return <div className="p-8">טוען מסמכים...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">כל המסמכים - {property?.address}</h2>
        <button onClick={() => router.back()} className="text-gray-600 hover:underline">
          חזור לנכס
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>מאגר מסמכים</CardTitle>
          <div className="mt-4">
            <Input 
              type="text" 
              placeholder="חפש לפי שם מסמך או סוג..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredDocs.length === 0 ? (
            <p className="text-gray-500">לא נמצאו מסמכים התואמים לחיפוש שלך.</p>
          ) : (
            <div className="space-y-3">
              {filteredDocs.map((doc) => {
                const displayType = typeTranslations[doc.type] || doc.type;
                return (
                  <div key={doc.id} className="p-4 border rounded-lg shadow-sm bg-gray-50 hover:bg-white transition flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                    <div>
                      <a href={doc.url} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline text-lg">
                        {doc.name}
                      </a>
                    </div>
                    <div className="flex space-x-6 space-x-reverse text-sm text-gray-600">
                      <p><strong>סוג:</strong> {displayType}</p>
                      <p><strong>הועלה:</strong> {new Date(doc.createdAt).toLocaleDateString('he-IL')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
