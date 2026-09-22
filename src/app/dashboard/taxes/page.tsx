"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Property, RentPeriod, Expense, Tenant } from "@/lib/types";
import { simulateTaxes, TaxSimulationResult } from "@/lib/tax-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TaxesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentPeriods, setRentPeriods] = useState<RentPeriod[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [owners, setOwners] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  
  const [marginalTaxRate, setMarginalTaxRate] = useState<number>(31);
  const [previousLosses, setPreviousLosses] = useState<number>(0);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const pSnap = await getDocs(query(collection(db, "properties"), where("userId", "==", user.uid)));
      const props = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      
      const tSnap = await getDocs(query(collection(db, "tenants")));
      const tens = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));

      const rSnap = await getDocs(query(collection(db, "rentPeriods")));
      const rents = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as RentPeriod));
      
      const eSnap = await getDocs(query(collection(db, "expenses")));
      const exps = eSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      
      setProperties(props);
      setTenants(tens);
      setRentPeriods(rents);
      setExpenses(exps);
      
      const uniqueOwners = Array.from(new Set(props.map(p => p.ownerName).filter(Boolean)));
      setOwners(uniqueOwners);
      if (uniqueOwners.length > 0) {
        setSelectedOwner(uniqueOwners[0]);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleUpdateProperty = async (propId: string, field: string, value: number) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, [field]: value } : p));
    if (propId) {
      await updateDoc(doc(db, "properties", propId), { [field]: value });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען סימולטור...</div>;

  const ownerProps = properties.filter(p => p.ownerName === selectedOwner);
  const ownerPropIds = ownerProps.map(p => p.id!);

  let totalYearlyRent = 0;
  rentPeriods.forEach(rp => {
    const tenant = tenants.find(t => t.id === rp.tenantId);
    if (tenant && ownerPropIds.includes(tenant.propertyId)) {
      totalYearlyRent += (rp.monthlyRent || 0) * 12; // Assuming active for 12 months for the simulation
    }
  });

  const totalExpenses = expenses
    .filter(e => ownerPropIds.includes(e.propertyId))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalDepreciation = ownerProps.reduce((sum, p) => sum + ((p.propertyValue || 0) * (p.depreciationRate || 0.02)), 0);
  const totalFinancing = ownerProps.reduce((sum, p) => sum + (p.yearlyFinancingCosts || 0), 0);

  const simulation = simulateTaxes({
    totalYearlyRent,
    totalExpenses,
    totalDepreciation,
    totalFinancing,
    previousLosses,
    marginalTaxRate: marginalTaxRate / 100, // convert percentage to decimal
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">סימולטור מס - {new Date().getFullYear()}</h1>
        <p className="text-gray-500">השוואת מסלולי מיסוי מקרקעין למגורים עבור בעל הנכסים</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-2">
              <Label className="text-lg font-semibold">בחר בעלים (נישום)</Label>
              <select 
                className="w-full border rounded-md p-3 bg-gray-50 font-medium"
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
              >
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-lg font-semibold">מדרגת מס שולי (%)</Label>
              <Input 
                type="number" 
                value={marginalTaxRate} 
                onChange={(e) => setMarginalTaxRate(Number(e.target.value))}
                className="text-lg p-3"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-lg font-semibold">הפסדים מועברים (₪)</Label>
              <Input 
                type="number" 
                value={previousLosses} 
                onChange={(e) => setPreviousLosses(Number(e.target.value))}
                className="text-lg p-3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-blue-200 shadow-md">
          <CardHeader className="bg-blue-50/50 border-b">
            <CardTitle className="text-xl text-blue-800 text-center">מסלול 10%</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl font-bold text-gray-900">
              ₪{Math.round(simulation.reducedTrackTax).toLocaleString()}
            </div>
            <p className="text-sm text-gray-500">10% מההכנסות. ללא הכרה בהוצאות.</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-md">
          <CardHeader className="bg-emerald-50/50 border-b">
            <CardTitle className="text-xl text-emerald-800 text-center">מסלול פטור</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl font-bold text-gray-900">
              ₪{Math.round(simulation.exemptionTrackTax).toLocaleString()}
            </div>
            <p className="text-sm text-gray-500">פטור עד {simulation.details.exemptionCeilingMonthly.toLocaleString()} ₪ בחודש.</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 shadow-md">
          <CardHeader className="bg-purple-50/50 border-b">
            <CardTitle className="text-xl text-purple-800 text-center">מסלול פירותי (שולי)</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-4xl font-bold text-gray-900">
              ₪{Math.round(simulation.marginalTrackTax).toLocaleString()}
            </div>
            <p className="text-sm text-gray-500">הכרה מלאה בהוצאות ופחת. מס שולי.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">נתוני נכסים לחישוב ({selectedOwner})</h2>
        <div className="grid grid-cols-1 gap-4">
          {ownerProps.map(prop => (
            <Card key={prop.id}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="font-semibold text-lg">{prop.address}</div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">עלות נכס (₪)</Label>
                      <Input 
                        type="number" 
                        value={prop.propertyValue || ""} 
                        onChange={(e) => handleUpdateProperty(prop.id!, 'propertyValue', Number(e.target.value))}
                        className="w-32"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">שיעור פחת (למשל 0.02)</Label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={prop.depreciationRate ?? 0.02} 
                        onChange={(e) => handleUpdateProperty(prop.id!, 'depreciationRate', Number(e.target.value))}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">עלות מימון שנתית (₪)</Label>
                      <Input 
                        type="number" 
                        value={prop.yearlyFinancingCosts || ""} 
                        onChange={(e) => handleUpdateProperty(prop.id!, 'yearlyFinancingCosts', Number(e.target.value))}
                        className="w-32"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {ownerProps.length === 0 && (
            <div className="text-gray-500 p-4 border rounded text-center">אין נכסים המשויכים לבעלים זה.</div>
          )}
        </div>
      </div>

      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">סיכום נתונים (חישוב אוטומטי לשנה)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">סך הכנסות (שנתי)</div>
              <div className="font-semibold text-lg">₪{Math.round(totalYearlyRent).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">הוצאות שוטפות</div>
              <div className="font-semibold text-lg text-red-600">₪{Math.round(totalExpenses).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">הוצאות מימון</div>
              <div className="font-semibold text-lg text-red-600">₪{Math.round(totalFinancing).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-500">פחת מחושב</div>
              <div className="font-semibold text-lg text-red-600">₪{Math.round(totalDepreciation).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

