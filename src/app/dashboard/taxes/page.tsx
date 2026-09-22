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
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border shadow-xl p-3 rounded-lg text-sm text-gray-700 z-50">
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
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [owners, setOwners] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  
  const [marginalTaxRate, setMarginalTaxRate] = useState<number>(31);
  const [previousLosses, setPreviousLosses] = useState<number>(0);
  
  const [zeroConfirmations, setZeroConfirmations] = useState<Record<string, { income?: boolean, expenses?: boolean }>>({});
  
  const [loading, setLoading] = useState(true);

  // Fetch Core Data
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const pSnap = await getDocs(query(collection(db, "properties"), where("userId", "==", user.uid)));
      const props = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      
      const tSnap = await getDocs(query(collection(db, "tenants")));
      const tens = tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));

      const pmtSnap = await getDocs(query(collection(db, "rentPayments"), where("userId", "==", user.uid)));
      const pmts = pmtSnap.docs.map(d => ({ id: d.id, ...d.data() } as RentPayment));
      
      const eSnap = await getDocs(query(collection(db, "expenses")));
      const exps = eSnap.docs.map(d => ({ id: d.id, ...d.data() } as Expense));
      
      setProperties(props);
      setTenants(tens);
      setRentPayments(pmts);
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
        setZeroConfirmations(data.zeroConfirmations || {});
      } else {
        setMarginalTaxRate(31);
        setPreviousLosses(0);
        setZeroConfirmations({});
      }
    };
    fetchSettings();
  }, [user, selectedOwner, selectedYear]);

  const saveSettings = async (updates: any) => {
    if (!user || !selectedOwner || !selectedYear) return;
    const docRef = doc(db, "taxSettings", `${user.uid}_${selectedOwner}_${selectedYear}`);
    await setDoc(docRef, updates, { merge: true });
  };

  const handleZeroConfirmation = (propId: string, type: 'income' | 'expenses', checked: boolean) => {
    setZeroConfirmations(prev => {
      const next = { ...prev, [propId]: { ...(prev[propId] || {}), [type]: checked } };
      saveSettings({ zeroConfirmations: next });
      return next;
    });
  };

  const handleUpdateProperty = async (propId: string, field: string, value: number) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, [field]: value } : p));
    if (propId) {
      await updateDoc(doc(db, "properties", propId), { [field]: value });
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">טוען סימולטור...</div>;

  const ownerProps = properties.filter(p => p.ownerName === selectedOwner);

  // Check for missing mandatory property fields
  const missingPropertyData = ownerProps.some(p => !p.propertyValue || p.yearlyFinancingCosts === undefined || p.yearlyFinancingCosts === null);

  // Unconfirmed zeroes
  let hasUnconfirmedIncome = false;
  let hasUnconfirmedExpenses = false;

  let totalYearlyRent = 0;
  let totalExpenses = 0;

  const propertyCalculations = ownerProps.map(prop => {
    // Actual Income (Paid rent payments expected in the selected year)
    const propRent = rentPayments
      .filter(p => p.propertyId === prop.id && p.status === 'PAID' && p.expectedDate.startsWith(selectedYear.toString()))
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Expenses in the selected year
    const propExp = expenses
      .filter(e => e.propertyId === prop.id && e.date.startsWith(selectedYear.toString()))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    if (propRent === 0 && !zeroConfirmations[prop.id!]?.income) hasUnconfirmedIncome = true;
    if (propExp === 0 && !zeroConfirmations[prop.id!]?.expenses) hasUnconfirmedExpenses = true;

    totalYearlyRent += propRent;
    totalExpenses += propExp;

    return { prop, propRent, propExp };
  });

  const totalDepreciation = ownerProps.reduce((sum, p) => sum + ((p.propertyValue || 0) * (p.depreciationRate ?? 0.02)), 0);
  const totalFinancing = ownerProps.reduce((sum, p) => sum + (p.yearlyFinancingCosts || 0), 0);

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

  const canCalculate = !missingPropertyData && !hasUnconfirmedIncome && !hasUnconfirmedExpenses;

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

      <Card className="overflow-visible">
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
            {missingPropertyData && <li>חובה להזין &quot;עלות נכס&quot; ו-&quot;עלות מימון שנתית&quot; בטבלת הנכסים למטה כדי לחשב את המסלול הפירותי. הנתונים נשמרים אוטומטית בעת ההזנה.</li>}
            {hasUnconfirmedIncome && <li>ישנם נכסים ללא הכנסות משכירות עבור שנה זו. סמנו V בטבלה לאישור שההכנסה אכן 0.</li>}
            {hasUnconfirmedExpenses && <li>ישנם נכסים ללא הוצאות רשומות עבור שנה זו. סמנו V בטבלה לאישור שאין הוצאות.</li>}
          </ul>
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">נתוני נכסים לחישוב</h2>
        
        <div className="bg-white rounded-lg shadow border overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-sm text-right min-w-[800px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 font-semibold w-1/4">נכס</th>
                  <th className="p-4 font-semibold">
                    <div className="flex items-center gap-1">
                      הכנסות ({selectedYear})
                      <InfoPopup title="הכנסות (שכירות)" content="מחושב אוטומטית לפי מספר החודשים בהם חוזה השכירות היה פעיל בשנת המס הנבחרת." />
                    </div>
                  </th>
                  <th className="p-4 font-semibold">
                    הוצאות ({selectedYear})
                  </th>
                  <th className="p-4 font-semibold">
                    <div className="flex items-center gap-1">
                      עלות נכס (₪) <span className="text-red-500">*</span>
                      <InfoPopup title="עלות נכס רשומה" content="עלות רכישת הנכס המקורית. נדרש לחישוב הפחת במסלול השולי." />
                    </div>
                  </th>
                  <th className="p-4 font-semibold">
                    <div className="flex items-center gap-1">
                      שיעור פחת
                      <InfoPopup title="שיעור הפחת" content="ברירת מחדל 2%. לעיתים מגיע ל-4%. התייעצו עם רואה חשבון." />
                    </div>
                  </th>
                  <th className="p-4 font-semibold">
                    <div className="flex items-center gap-1">
                      עלות מימון שנתית <span className="text-red-500">*</span>
                      <InfoPopup title="הוצאות מימון (משכנתא)" content="סך רכיב הריבית וההצמדה (ללא הקרן) ששולם על המשכנתא בשנת המס. הזינו 0 אם אין." />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {propertyCalculations.map(({ prop, propRent, propExp }) => {
                  return (
                    <tr key={prop.id} className={(!prop.propertyValue || prop.yearlyFinancingCosts === undefined) ? "bg-orange-50/50" : "hover:bg-gray-50/50 transition-colors"}>
                      <td className="p-4 font-semibold text-gray-900 border-l">{prop.address}</td>
                      <td className="p-4 border-l">
                        <Link href={`/dashboard/properties/${prop.id}/income`} className="font-bold text-blue-600 hover:underline block mb-1">
                          ₪{propRent.toLocaleString()}
                        </Link>
                        {propRent === 0 && (
                          <label className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 p-1 rounded cursor-pointer w-max">
                            <input type="checkbox" checked={zeroConfirmations[prop.id!]?.income || false} onChange={(e) => handleZeroConfirmation(prop.id!, 'income', e.target.checked)} />
                            מאשר אכן 0
                          </label>
                        )}
                      </td>
                      <td className="p-4 border-l">
                        <Link href={`/dashboard/properties/${prop.id}/expenses`} className="font-bold text-blue-600 hover:underline block mb-1">
                          ₪{propExp.toLocaleString()}
                        </Link>
                        {propExp === 0 && (
                          <label className="flex items-center gap-1 text-xs text-orange-700 bg-orange-100 p-1 rounded cursor-pointer w-max">
                            <input type="checkbox" checked={zeroConfirmations[prop.id!]?.expenses || false} onChange={(e) => handleZeroConfirmation(prop.id!, 'expenses', e.target.checked)} />
                            מאשר אכן 0
                          </label>
                        )}
                      </td>
                      <td className="p-4 border-l align-top">
                        <Input 
                          type="number" 
                          value={prop.propertyValue ?? ""} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'propertyValue', Number(e.target.value))}
                          className={`w-28 h-9 ${!prop.propertyValue ? 'border-orange-400 bg-white' : 'bg-white'}`}
                          placeholder="חובה להזין"
                        />
                      </td>
                      <td className="p-4 border-l align-top">
                        <Input 
                          type="number" 
                          step="0.01"
                          value={prop.depreciationRate ?? 0.02} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'depreciationRate', Number(e.target.value))}
                          className="w-20 h-9 bg-white"
                        />
                      </td>
                      <td className="p-4 align-top">
                        <Input 
                          type="number" 
                          value={prop.yearlyFinancingCosts ?? ""} 
                          onChange={(e) => handleUpdateProperty(prop.id!, 'yearlyFinancingCosts', Number(e.target.value))}
                          className={`w-28 h-9 ${prop.yearlyFinancingCosts === undefined ? 'border-orange-400 bg-white' : 'bg-white'}`}
                          placeholder="חובה להזין"
                        />
                      </td>
                    </tr>
                  );
                })}
                {propertyCalculations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      אין נכסים המשויכים לבעלים זה.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-6">
          <h3 className="font-bold text-lg mb-4">סיכום נתונים {selectedYear} (חישוב אוטומטי)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <div className="text-gray-600 mb-1 font-semibold">סך הכנסות (שנתי)</div>
              <div className="font-bold text-2xl">₪{Math.round(totalYearlyRent).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1 font-semibold">סך הוצאות שוטפות</div>
              <div className="font-bold text-2xl text-red-600">₪{Math.round(totalExpenses).toLocaleString()}</div>
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

