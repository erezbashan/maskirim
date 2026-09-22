"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { collection, query, where, getDocs, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Property, RentPeriod, Expense, Tenant } from "@/lib/types";
import { simulateTaxes, TaxSimulationResult } from "@/lib/tax-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

const YEAR_CEILINGS: Record<number, number> = {
  2023: 5471,
  2024: 5654,
  2025: 5654, // Frozen until 2027 by Israeli law
  2026: 5654,
};

function InfoPopup({ title, content }: { title: string, content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="text-gray-400 hover:text-blue-600 transition"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-6 w-64 bg-white border shadow-xl p-3 rounded-lg text-sm text-gray-700 z-50">
          <strong className="block mb-1 text-gray-900">{title}</strong>
          {content}
        </div>
      )}
    </div>
  );
}

export default function TaxesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentPeriods, setRentPeriods] = useState<RentPeriod[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [owners, setOwners] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const [marginalTaxRate, setMarginalTaxRate] = useState<number>(31);
  const [previousLosses, setPreviousLosses] = useState<number>(0);
  const [incomeConfirmedZero, setIncomeConfirmedZero] = useState(false);
  const [expensesConfirmedZero, setExpensesConfirmedZero] = useState(false);
  
  const [loading, setLoading] = useState(true);

  // Fetch Core Data
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

  // Fetch Settings when Owner or Year changes
  useEffect(() => {
    if (!user || !selectedOwner || !selectedYear) return;
    const fetchSettings = async () => {
      const docRef = doc(db, "taxSettings", `${user.uid}_${selectedOwner}_${selectedYear}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setMarginalTaxRate(data.marginalTaxRate ?? 31);
        setPreviousLosses(data.previousLosses ?? 0);
        setIncomeConfirmedZero(data.incomeConfirmedZero ?? false);
        setExpensesConfirmedZero(data.expensesConfirmedZero ?? false);
      } else {
        setMarginalTaxRate(31);
        setPreviousLosses(0);
        setIncomeConfirmedZero(false);
        setExpensesConfirmedZero(false);
      }
    };
    fetchSettings();
  }, [user, selectedOwner, selectedYear]);

  const saveSettings = async (updates: any) => {
    if (!user || !selectedOwner || !selectedYear) return;
    const docRef = doc(db, "taxSettings", `${user.uid}_${selectedOwner}_${selectedYear}`);
    await setDoc(docRef, updates, { merge: true });
  };

  const handleUpdateProperty = async (propId: string, field: string, value: number) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, [field]: value } : p));
    if (propId) {
      await updateDoc(doc(db, "properties", propId), { [field]: value });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען סימולטור...</div>;

  const ownerProps = properties.filter(p => p.ownerName === selectedOwner);
  const ownerPropIds = ownerProps.map(p => p.id!);

  // Check for missing mandatory property fields
  const missingPropertyData = ownerProps.some(p => !p.propertyValue || p.yearlyFinancingCosts === undefined || p.yearlyFinancingCosts === null);

  // Aggregations for Selected Year
  let totalYearlyRent = 0;
  rentPeriods.forEach(rp => {
    const tenant = tenants.find(t => t.id === rp.tenantId);
    if (tenant && ownerPropIds.includes(tenant.propertyId)) {
      // In a real system, we'd calculate overlap days with selectedYear.
      // For the simulator MVP, we assume active periods represent the yearly run rate.
      totalYearlyRent += (rp.monthlyRent || 0) * 12;
    }
  });

  const totalExpenses = expenses
    .filter(e => ownerPropIds.includes(e.propertyId) && e.date.startsWith(selectedYear.toString()))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const totalDepreciation = ownerProps.reduce((sum, p) => sum + ((p.propertyValue || 0) * (p.depreciationRate ?? 0.02)), 0);
  const totalFinancing = ownerProps.reduce((sum, p) => sum + (p.yearlyFinancingCosts || 0), 0);

  const needsIncomeConfirmation = totalYearlyRent === 0 && !incomeConfirmedZero;
  const needsExpensesConfirmation = totalExpenses === 0 && !expensesConfirmedZero;

  const ceiling = YEAR_CEILINGS[selectedYear] || 5654;

  const simulation = simulateTaxes({
    totalYearlyRent,
    totalExpenses,
    totalDepreciation,
    totalFinancing,
    previousLosses,
    marginalTaxRate: marginalTaxRate / 100,
    exemptionCeilingMonthly: ceiling,
  });

  const canCalculate = !missingPropertyData && !needsIncomeConfirmation && !needsExpensesConfirmation;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">סימולטור מס מקרקעין</h1>
          <p className="text-gray-500">השוואת מסלולי מיסוי מקרקעין למגורים עבור בעל הנכסים</p>
        </div>
        <a 
          href="https://www.kolzchut.org.il/he/%D7%A0%D7%99%D7%9B%D7%95%D7%99_%D7%9E%D7%A1_%D7%94%D7%9B%D7%A0%D7%A1%D7%94_%D7%9E%D7%93%D7%9E%D7%99_%D7%A9%D7%9B%D7%99%D7%A8%D7%95%D7%AA_%D7%A9%D7%9C_%D7%93%D7%99%D7%A8%D7%94_%D7%9C%D7%9E%D7%92%D7%95%D7%A8%D7%99%D7%9D"
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-2 text-blue-600 hover:underline bg-blue-50 px-4 py-2 rounded-lg"
        >
          <ExternalLink className="w-4 h-4" />
          <span>מדריך מסלולי מיסוי (כל זכות)</span>
        </a>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 max-w-md">
            <div className="flex flex-col space-y-1.5">
              <Label className="text-lg font-semibold">שנת מס</Label>
              <select 
                className="w-full border rounded-md p-3 bg-gray-50 font-medium"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label className="text-lg font-semibold">בחר בעלים (נישום)</Label>
              <select 
                className="w-full border rounded-md p-3 bg-gray-50 font-medium"
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
              >
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label className="text-lg font-semibold flex items-center">
                מדרגת מס שולי (%)
                <InfoPopup title="מדרגת מס שולי" content="שיעור המס החל על השקל העליון בהכנסה שלכם מיגיעה אישית (או פסיבית, בדרך כלל החל מ-31% אלא אם אתם מעל גיל 60). משפיע ישירות על מסלול הפטור והמסלול הפירותי." />
              </Label>
              <Input 
                type="number" 
                value={marginalTaxRate} 
                onChange={(e) => {
                  setMarginalTaxRate(Number(e.target.value));
                  saveSettings({ marginalTaxRate: Number(e.target.value) });
                }}
                className="text-lg p-3"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label className="text-lg font-semibold flex items-center">
                הפסדים מועברים (₪)
                <InfoPopup title="הפסדים מועברים" content="הפסדים עסקיים משנים קודמות המוכרים לצרכי קיזוז מס מול הכנסות פירותיות (שכירות) בשנה הנוכחית." />
              </Label>
              <Input 
                type="number" 
                value={previousLosses} 
                onChange={(e) => {
                  setPreviousLosses(Number(e.target.value));
                  saveSettings({ previousLosses: Number(e.target.value) });
                }}
                className="text-lg p-3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!canCalculate && (
        <div className="bg-orange-50 border-orange-200 border text-orange-800 p-4 rounded-lg flex flex-col gap-2">
          <strong>שים לב: הנתונים חסרים ולא ניתן להציג סימולציה.</strong>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {missingPropertyData && <li>חובה להזין &quot;עלות נכס&quot; ו-&quot;עלות מימון שנתית&quot; (אפילו 0) לכל הנכסים כדי לחשב את המסלול הפירותי. הנתונים נשמרים אוטומטית בעת ההזנה.</li>}
            {needsIncomeConfirmation && <li>לא נמצאו הכנסות עבור שנה זו. סמנו V למטה לאישור או <Link href="/dashboard/properties" className="underline">הזינו תקופות שכירות</Link>.</li>}
            {needsExpensesConfirmation && <li>לא נמצאו הוצאות עבור שנה זו. סמנו V למטה לאישור או הזינו הוצאות בכרטיס הנכס.</li>}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">נתוני נכסים לחישוב</h2>
        <div className="grid grid-cols-1 gap-4">
          {ownerProps.map(prop => {
            const propRentPeriods = rentPeriods.filter(rp => tenants.find(t => t.id === rp.tenantId)?.propertyId === prop.id);
            const propTotalYearlyRent = propRentPeriods.reduce((sum, rp) => sum + ((rp.monthlyRent || 0) * 12), 0);

            const propExpenses = expenses.filter(e => e.propertyId === prop.id && e.date.startsWith(selectedYear.toString()));
            const propTotalExpenses = propExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

            return (
              <Card key={prop.id} className={(!prop.propertyValue || prop.yearlyFinancingCosts === undefined) ? "border-orange-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <div className="font-semibold text-lg">{prop.address}</div>
                      <div className="text-sm text-gray-500">
                        הכנסות ({selectedYear}): <span className="font-semibold text-gray-700">₪{propTotalYearlyRent.toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        הוצאות ({selectedYear}): <span className="font-semibold text-gray-700">₪{propTotalExpenses.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap flex-1 justify-end">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center">
                          עלות נכס (₪) <span className="text-red-500 ml-1">*</span>
                          <InfoPopup title="עלות נכס רשומה" content="עלות רכישת הנכס המקורית (כולל מס רכישה, עו״ד, תיווך ושיפוצים צמודים). נדרש לחישוב הפחת השנתי במסלול השולי." />
                        </Label>
                        <Input 
                          type="number" 
                          value={prop.propertyValue ?? ""} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'propertyValue', Number(e.target.value))}
                          className={`w-32 ${!prop.propertyValue ? 'border-orange-400 bg-orange-50' : ''}`}
                          placeholder="חובה להזין"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center">
                          שיעור פחת
                          <InfoPopup title="שיעור הפחת" content="לפי התקנות, מבנה בטון זכאי לפחת של 2% לשנה (או 1.33% מתוך שווי הכולל את הקרקע). לעיתים מגיע ל-4%. ברירת מחדל 2%. התייעצו עם רואה חשבון." />
                        </Label>
                        <Input 
                          type="number" 
                          step="0.01"
                          value={prop.depreciationRate ?? 0.02} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'depreciationRate', Number(e.target.value))}
                          className="w-32"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold flex items-center">
                          עלות מימון שנתית (₪) <span className="text-red-500 ml-1">*</span>
                          <InfoPopup title="הוצאות מימון (משכנתא)" content="סך רכיב הריבית וההצמדה (ללא הקרן) ששולם על המשכנתא עבור נכס זה בשנת המס המחושבת. אם אין משכנתא, הזינו 0." />
                        </Label>
                        <Input 
                          type="number" 
                          value={prop.yearlyFinancingCosts ?? ""} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'yearlyFinancingCosts', Number(e.target.value))}
                          className={`w-32 ${prop.yearlyFinancingCosts === undefined ? 'border-orange-400 bg-orange-50' : ''}`}
                          placeholder="חובה להזין"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {ownerProps.length === 0 && (
            <div className="text-gray-500 p-4 border rounded text-center">אין נכסים המשויכים לבעלים זה.</div>
          )}
        </div>
      </div>

      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">סיכום נתונים {selectedYear} (חישוב אוטומטי)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-gray-600 mb-1 font-semibold">סך הכנסות (שנתי)</div>
              <div className="font-bold text-2xl">₪{Math.round(totalYearlyRent).toLocaleString()}</div>
              {needsIncomeConfirmation && (
                <label className="flex items-center gap-2 mt-2 text-orange-700 bg-orange-100 p-2 rounded">
                  <input type="checkbox" onChange={(e) => {
                    setIncomeConfirmedZero(e.target.checked);
                    saveSettings({ incomeConfirmedZero: e.target.checked });
                  }} />
                  מאשר שההכנסה השנה היא 0
                </label>
              )}
            </div>
            <div>
              <div className="text-gray-600 mb-1 font-semibold">הוצאות שוטפות</div>
              <div className="font-bold text-2xl text-red-600">₪{Math.round(totalExpenses).toLocaleString()}</div>
              {needsExpensesConfirmation && (
                <label className="flex items-center gap-2 mt-2 text-orange-700 bg-orange-100 p-2 rounded">
                  <input type="checkbox" onChange={(e) => {
                    setExpensesConfirmedZero(e.target.checked);
                    saveSettings({ expensesConfirmedZero: e.target.checked });
                  }} />
                  מאשר שאין הוצאות השנה
                </label>
              )}
            </div>
            <div>
              <div className="text-gray-600 mb-1 font-semibold">סך הוצאות מימון</div>
              <div className="font-bold text-2xl text-red-600">₪{Math.round(totalFinancing).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1 font-semibold">פחת מחושב</div>
              <div className="font-bold text-2xl text-red-600">₪{Math.round(totalDepreciation).toLocaleString()}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {canCalculate && (
        <div className="space-y-6 pt-4 border-t-2 border-dashed border-gray-300">
          <h2 className="text-2xl font-bold text-gray-900 text-center">תוצאות הסימולציה</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-100 transition-opacity">
            {[
              {
                id: '10',
                title: "מסלול 10%",
                tax: simulation.reducedTrackTax,
                desc: "10% מההכנסות ברוטו. ללא הכרה בהוצאות או פחת.",
                colors: "border-blue-200 bg-blue-50/80 text-blue-800",
              },
              {
                id: 'exemption',
                title: "מסלול פטור / חלקי",
                tax: simulation.exemptionTrackTax,
                desc: `תקרת פטור שנתית: ₪${(ceiling * 12).toLocaleString()} (₪${ceiling.toLocaleString()} בחודש)`,
                colors: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
              },
              {
                id: 'marginal',
                title: "מסלול שולי (פירותי)",
                tax: simulation.marginalTrackTax,
                desc: `לפי מס שולי ${marginalTaxRate}%. הכרה מלאה בהוצאות, מימון ופחת.`,
                colors: "border-purple-200 bg-purple-50/80 text-purple-800",
              },
            ].map(track => {
              const isWinner = track.tax === Math.min(simulation.reducedTrackTax, simulation.exemptionTrackTax, simulation.marginalTrackTax);
              return (
                <Card 
                  key={track.id} 
                  className={`relative overflow-hidden shadow-md transition-all ${isWinner ? 'ring-4 ring-green-500 scale-105 z-10' : 'border-gray-200'}`}
                >
                  {isWinner && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-sm font-bold rounded-bl-lg">
                      המסלול המשתלם ביותר!
                    </div>
                  )}
                  <CardHeader className={`${track.colors} border-b`}>
                    <CardTitle className="text-xl text-center">{track.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 text-center space-y-4">
                    <div className={`text-4xl font-bold ${isWinner ? 'text-green-700' : 'text-gray-900'}`}>
                      ₪{Math.round(track.tax).toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-500">{track.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}

