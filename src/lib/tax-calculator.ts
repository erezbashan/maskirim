export interface TaxSimulationResult {
  reducedTrackTax: number;
  marginalTrackTax: number;
  exemptionTrackTax: number;
  details: {
    totalYearlyRent: number;
    totalMonthlyRent: number;
    totalExpenses: number;
    totalDepreciation: number;
    totalFinancing: number;
    marginalTaxRate: number;
    exemptionCeilingMonthly: number;
  };
}

export function simulateTaxes(params: {
  totalYearlyRent: number;
  totalExpenses: number;
  totalDepreciation: number;
  totalFinancing: number;
  previousLosses: number;
  marginalTaxRate: number; // e.g., 0.31 for 31%
  exemptionCeilingMonthly?: number; // Defaults to 2024 value of 5654
}): TaxSimulationResult {
  const {
    totalYearlyRent,
    totalExpenses,
    totalDepreciation,
    totalFinancing,
    previousLosses,
    marginalTaxRate,
    exemptionCeilingMonthly = 5654,
  } = params;

  const totalMonthlyRent = totalYearlyRent / 12;

  // 1. Reduced Tax Track (10%)
  // Flat 10% on all rental income. No deductions allowed.
  const reducedTrackTax = totalYearlyRent * 0.10;

  // 2. Marginal Tax Track (Full)
  // Deduct all allowed expenses
  const marginalTaxable = totalYearlyRent - totalExpenses - totalDepreciation - totalFinancing - previousLosses;
  const marginalTrackTax = Math.max(0, marginalTaxable) * marginalTaxRate;

  // 3. Exemption Track (מסלול פטור)
  let exemptionTrackTax = 0;
  if (totalMonthlyRent > exemptionCeilingMonthly) {
    // Calculate the penalty (Excess)
    const excess = totalMonthlyRent - exemptionCeilingMonthly;
    // Adjusted Exemption = Ceiling - Excess
    const adjustedExemption = Math.max(0, exemptionCeilingMonthly - excess);
    // Taxable Amount per month
    const taxableAmountMonthly = totalMonthlyRent - adjustedExemption;
    const taxableAmountYearly = taxableAmountMonthly * 12;

    // Proportion of expenses that can be deducted
    const taxableProportion = taxableAmountMonthly / totalMonthlyRent;
    const allowedExpensesYearly = (totalExpenses + totalDepreciation + totalFinancing) * taxableProportion;

    // We can also deduct previous losses (usually fully deductible against taxable income, check law, but let's deduct proportional or full? Usually previous losses are carried forward fully against taxable income. We'll deduct fully from the final taxable amount).
    const netTaxableYearly = taxableAmountYearly - allowedExpensesYearly - previousLosses;
    
    exemptionTrackTax = Math.max(0, netTaxableYearly) * marginalTaxRate;
  }

  return {
    reducedTrackTax,
    marginalTrackTax,
    exemptionTrackTax,
    details: {
      totalYearlyRent,
      totalMonthlyRent,
      totalExpenses,
      totalDepreciation,
      totalFinancing,
      marginalTaxRate,
      exemptionCeilingMonthly,
    }
  };
}
