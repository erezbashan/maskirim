"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPropertiesByUser, getTenantsByProperty, getDocumentsByProperty, getRentPeriodsByTenant, deleteTenant, deleteRentPeriod } from "@/lib/db";
import { Property, Tenant, Document as AppDocument, RentPeriod } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

export default function PropertyDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();
  
  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentPeriodsByTenant, setRentPeriodsByTenant] = useState<Record<string, RentPeriod[]>>({});
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTenants, setExpandedTenants] = useState<Record<string, boolean>>({});

  const toggleTenantExpanded = (tenantId: string) => {
    setExpandedTenants(prev => ({ ...prev, [tenantId]: !prev[tenantId] }));
  };

  useEffect(() => {
    if (!user || !id) return;
    
    const fetchData = async () => {
      try {
        const userProps = await getPropertiesByUser(user.uid);
        const prop = userProps.find(p => p.id === id);
        if (prop) setProperty(prop);

        const propTenants = await getTenantsByProperty(id);
        setTenants(propTenants);

        const periodsMap: Record<string, RentPeriod[]> = {};
        for (const t of propTenants) {
          if (t.id) {
            periodsMap[t.id] = await getRentPeriodsByTenant(t.id);
          }
        }
        setRentPeriodsByTenant(periodsMap);

        const propExpenses = await getExpensesByProperty(id);

        const propDocs = await getDocumentsByProperty(id);
        setDocuments(propDocs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();

    // Listen for cross-component refresh events (e.g. from GlobalUploader)
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener("propertyDataUpdated", handleRefresh);

    return () => {
      window.removeEventListener("propertyDataUpdated", handleRefresh);
    };
  }, [user, id]);

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק שוכר זה ואת כל תקופות השכירות שלו?")) return;
    try {
      await deleteTenant(tenantId);
      setTenants(prev => prev.filter(t => t.id !== tenantId));
    } catch (e) {
      console.error(e);
      alert("שגיאה במחיקת שוכר");
    }
  };

  const handleDeleteRentPeriod = async (tenantId: string, periodId: string, url?: string) => {
    if (!confirm("האם אתה בטוח שברצונך למחוק תקופת שכירות זו?")) return;
    try {
      await deleteRentPeriod(periodId, url);
      setRentPeriodsByTenant(prev => ({
        ...prev,
        [tenantId]: prev[tenantId].filter(p => p.id !== periodId)
      }));
    } catch (e) {
      console.error(e);
      alert("שגיאה במחיקת תקופה");
    }
  };

  if (loading) return <div>טוען נתונים...</div>;
  if (!property) return null;

  // Sorting logic
  const getLatestPeriodDate = (tenantId: string) => {
    const periods = rentPeriodsByTenant[tenantId] || [];
    if (periods.length === 0) return 0;
    return Math.max(...periods.map(p => new Date(p.startDate).getTime()));
  };

  const sortedTenants = [...tenants].sort((a, b) => {
    const latestA = getLatestPeriodDate(a.id!);
    const latestB = getLatestPeriodDate(b.id!);
    // If both have 0 (no periods), keep original order
    if (latestA === 0 && latestB === 0) return 0;
    return latestB - latestA; // Descending: newest first
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{property.address}, {property.city}</h2>
        <button 
          onClick={() => router.back()}
          className="text-gray-600 hover:underline"
        >
          חזור לרשימה
        </button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>פרטי נכס</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>בעלים רשום:</strong> {property.ownerName}</p>
            {property.notes && <p><strong>הערות:</strong> {property.notes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>שוכרים</CardTitle>
            <Link 
              href={`/dashboard/properties/${id}/tenants/new`}
              className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
            >
              הוסף שוכר חדש
            </Link>
          </CardHeader>
          <CardContent>
            {sortedTenants.length === 0 ? (
              <p className="text-gray-500">אין שוכרים רשומים.</p>
            ) : (
              <div className="space-y-6">
                {sortedTenants.map(tenant => {
                  const tenantPeriods = rentPeriodsByTenant[tenant.id!] || [];
                  const firstPeriod = tenantPeriods.length > 0
                    ? [...tenantPeriods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]
                    : null;
                  const originalLeaseUrl = firstPeriod?.documentUrl;
                  const terminationDoc = documents.find(d => d.tenantId === tenant.id && d.type === "TERMINATION");

                  // Calculate status
                  let status = "לא מוגדר";
                  let statusColor = "bg-gray-100 text-gray-800";
                  
                  if (tenantPeriods.length > 0) {
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const earliestStart = new Date(Math.min(...tenantPeriods.map(p => new Date(p.startDate).getTime())));
                    const latestEnd = new Date(Math.max(...tenantPeriods.map(p => new Date(p.endDate).getTime())));
                    
                    if (now < earliestStart) {
                      status = "שוכר עתידי";
                      statusColor = "bg-purple-100 text-purple-800";
                    } else if (now > latestEnd) {
                      status = "שוכר עבר";
                      statusColor = "bg-gray-200 text-gray-600";
                    } else {
                      status = "שוכר פעיל";
                      statusColor = "bg-green-100 text-green-800";
                    }
                  }

                  return (
                  <div key={tenant.id} className="border rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                      <div>
                        <div className="flex items-center space-x-3 space-x-reverse">
                          <h3 className="font-bold text-lg">{tenant.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                            {status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 space-x-reverse mt-2 mb-1">
                          {originalLeaseUrl && (
                            <a href={originalLeaseUrl} target="_blank" rel="noreferrer" className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200">
                              📄 חוזה מקורי
                            </a>
                          )}
                          {terminationDoc && (
                            <a href={terminationDoc.url} target="_blank" rel="noreferrer" className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">
        {/* Action bar for Income and Expenses */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Link href={`/dashboard/properties/${id}/income`} className="flex-1 bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 rounded-xl p-4 flex items-center justify-between transition group shadow-sm">
            <div className="flex flex-col">
              <span className="font-bold text-lg">הכנסות נכס</span>
              <span className="text-sm opacity-80">צפה בתשלומי שכירות</span>
            </div>
            <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
              💰
            </div>
          </Link>
          
          <Link href={`/dashboard/properties/${id}/expenses`} className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 rounded-xl p-4 flex items-center justify-between transition group shadow-sm">
            <div className="flex flex-col">
              <span className="font-bold text-lg">הוצאות נכס</span>
              <span className="text-sm opacity-80">ניהול קבלות ותשלומים</span>
            </div>
            <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
              🧾
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>שוכרים</CardTitle>
                <Link 
                  href={`/dashboard/properties/${id}/tenants/new`}
                  className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
                >
                  הוסף שוכר חדש
                </Link>
              </CardHeader>
              <CardContent>
                {sortedTenants.length === 0 ? (
                  <p className="text-gray-500">אין שוכרים רשומים.</p>
                ) : (
                  <div className="space-y-6">
                    {sortedTenants.map(tenant => {
                      const tenantPeriods = rentPeriodsByTenant[tenant.id!] || [];
                      const firstPeriod = tenantPeriods.length > 0
                        ? [...tenantPeriods].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]
                        : null;
                      const originalLeaseUrl = firstPeriod?.documentUrl;
                      const terminationDoc = documents.find(d => d.tenantId === tenant.id && d.type === "TERMINATION");

                      // Calculate status
                      let status = "לא מוגדר";
                      let statusColor = "bg-gray-100 text-gray-800";
                      
                      if (tenantPeriods.length > 0) {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        const earliestStart = new Date(Math.min(...tenantPeriods.map(p => new Date(p.startDate).getTime())));
                        const latestEnd = new Date(Math.max(...tenantPeriods.map(p => new Date(p.endDate).getTime())));
                        
                        if (now < earliestStart) {
                          status = "שוכר עתידי";
                          statusColor = "bg-purple-100 text-purple-800";
                        } else if (now > latestEnd) {
                          status = "שוכר עבר";
                          statusColor = "bg-gray-200 text-gray-600";
                        } else {
                          status = "שוכר פעיל";
                          statusColor = "bg-green-100 text-green-800";
                        }
                      }

                      return (
                      <div key={tenant.id} className="border rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                          <div>
                            <div className="flex items-center space-x-3 space-x-reverse">
                              <h3 className="font-bold text-lg">{tenant.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                {status}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 space-x-reverse mt-2 mb-1">
                              {originalLeaseUrl && (
                                <a href={originalLeaseUrl} target="_blank" rel="noreferrer" className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200">
                                  📄 חוזה מקורי
                                </a>
                              )}
                              {terminationDoc && (
                                <a href={terminationDoc.url} target="_blank" rel="noreferrer" className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200">
                                  📄 סיום חוזה
                                </a>
                              )}
                            </div>
                            {tenant.paymentDueDay && <p className="text-sm text-gray-600">יום תשלום: ה-{tenant.paymentDueDay} בחודש</p>}
                          </div>
                          <div className="flex space-x-3 space-x-reverse items-center">
                            <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/payments`} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded hover:bg-green-100 font-medium transition" title="פתח היסטוריית תשלומים">
                              היסטוריית תשלומים
                            </Link>
                            <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/edit`} className="text-gray-500 hover:text-blue-600 transition" title="ערוך שוכר">
                              <Pencil className="w-5 h-5" />
                            </Link>
                            <button onClick={() => handleDeleteTenant(tenant.id!)} className="text-gray-500 hover:text-red-600 transition" title="מחק שוכר">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <div className="p-4 bg-white">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-gray-700">תקופות שכירות</h4>
                            <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/rent-periods/new`} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-medium">הוסף תקופה</Link>
                          </div>
                          
                          {(!rentPeriodsByTenant[tenant.id!] || rentPeriodsByTenant[tenant.id!].length === 0) ? (
                            <p className="text-sm text-gray-500">אין תקופות שכירות רשומות.</p>
                          ) : (
                            <div className="space-y-3">
                              {[...rentPeriodsByTenant[tenant.id!]]
                                .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                                .slice(0, expandedTenants[tenant.id!] ? undefined : 1)
                                .map(period => (
                                <div key={period.id} className="border p-3 rounded text-sm relative">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                                    <p><strong>מתאריך:</strong> {new Date(period.startDate).toLocaleDateString('he-IL')}</p>
                                    <p><strong>עד תאריך:</strong> {new Date(period.endDate).toLocaleDateString('he-IL')}</p>
                                    <p><strong>שכירות:</strong> ₪{period.monthlyRent}</p>
                                    {period.guaranteeType && <p><strong>ערבות:</strong> {period.guaranteeType}</p>}
                                  </div>
                                  {(period.renewalTerms || period.renewalDeadline) && (
                                    <div className="mt-2 bg-blue-50 p-2 rounded text-blue-800 text-xs">
                                      {period.renewalTerms && <p><strong>אופציה:</strong> {period.renewalTerms}</p>}
                                      {period.renewalDeadline && <p><strong>תאריך אחרון להודעה:</strong> {new Date(period.renewalDeadline).toLocaleDateString('he-IL')}</p>}
                                    </div>
                                  )}
                                  <div className="flex space-x-3 space-x-reverse text-xs mt-3 pt-2 border-t border-gray-100 items-center">
                                    <Link href={`/dashboard/properties/${id}/tenants/${tenant.id}/rent-periods/${period.id}/edit`} className="text-gray-400 hover:text-blue-600 transition" title="ערוך תקופה">
                                      <Pencil className="w-4 h-4" />
                                    </Link>
                                    <button onClick={() => handleDeleteRentPeriod(tenant.id!, period.id!, period.documentUrl)} className="text-gray-400 hover:text-red-600 transition" title="מחק תקופה">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    {period.documentUrl && (
                                      <a href={period.documentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold pr-2 border-r border-gray-300">📄 צפה במסמך</a>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {rentPeriodsByTenant[tenant.id!].length > 1 && (
                                <button 
                                  onClick={() => toggleTenantExpanded(tenant.id!)}
                                  className="text-sm text-blue-600 hover:underline w-full text-center py-2 bg-blue-50 rounded"
                                >
                                  {expandedTenants[tenant.id!] 
                                    ? "הסתר היסטוריית שכירות" 
                                    : `הצג היסטוריית שכירות (${rentPeriodsByTenant[tenant.id!].length - 1} קודמות)`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Documents Repository Link */}
            <Link href={`/dashboard/properties/${id}/documents`} className="block">
              <Card className="hover:bg-blue-50 transition border-blue-100 cursor-pointer shadow-sm">
                <CardContent className="p-6 flex flex-col justify-center items-center gap-3">
                  <span className="text-4xl">📂</span>
                  <span className="text-blue-700 font-bold text-lg text-center">
                    מאגר המסמכים של הנכס ({documents.length})
                  </span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
