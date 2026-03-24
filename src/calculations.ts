export type Frequency = 'Monthly' | 'Fortnightly' | 'Weekly';
export type PurchaseType = 'PPR' | 'FHOG' | 'Investment';
export type ApplicantType = 'Single' | 'Couple';
export type LoanPurpose = 'Owner Occupier' | 'Investment';
export type LenderProfile = 'NAB-style' | 'Conservative' | 'Aggressive';
export type AlertTone = 'good' | 'warn' | 'bad' | 'info';

export const FREQUENCIES: Record<Frequency, number> = {
  Monthly: 12,
  Fortnightly: 26,
  Weekly: 52,
};

export const DEFAULTS = {
  meta: {
    brandName: 'XYZ Finance Specialists',
    brokerName: '',
    propertyOneName: '',
    propertyTwoName: '',
  },
  oneProperty: {
    scenarioName: '',
    purchaseType: '' as PurchaseType | '',
    interestRate: '',
    loanTerm: '',
    housePrice: '',
    desiredLvr: '',
    loanApprovalMax: '',
    maxCashContribution: '',
    maxPurchaseMode: false,
    useGuarantor: false,
    enableOopLimit: false,
    lmiExempt: false,
    exemptCap: '',
    repaymentFrequency: '' as Frequency | '',
    extraPrincipal: '',
    yearlyIncome: '',
    livingExpensesMonthly: '3000',
  },
  twoProperties: {
    scenarioName: '',
    interestRate: '',
    loanTerm: '',
    currentMortgage: '',
    currentValue: '',
    secondPrice: '',
    crossCollat: true,
    desiredLvr: '',
    withdraw80: false,
    currentRent: '',
    newRent: '',
    approvalMax: '',
    lmiExempt: false,
    exemptCap: '',
    yearlyIncome: '',
  },
  refinance: {
    scenarioName: '',
    currentValue: '',
    currentLoan: '',
    currentRate: '',
    currentTerm: '',
    currentFreq: '' as Frequency | '',
    newRate: '',
    newTerm: '',
    newFreq: '' as Frequency | '',
    dischargeFee: '',
    applicationFee: '',
    legalFee: '',
    valuationFee: '',
    govFee: '',
    cashback: '',
    extraBorrow: '',
    lmiExempt: false,
  },
  borrowing: {
    scenarioName: '',
    lenderProfile: '' as LenderProfile | '',
    applicantType: '' as ApplicantType | '',
    dependants: '',
    loanPurpose: '' as LoanPurpose | '',
    grossIncome1: '',
    grossIncome2: '',
    rentalIncomeMonthly: '',
    otherIncomeAnnual: '',
    livingExpensesMonthly: '3000',
    existingLoanRepaymentsMonthly: '',
    creditCardLimits: '',
    otherDebtsMonthly: '',
    actualRate: '',
    assessmentBufferPct: '',
    assessmentFloorRatePct: '',
    loanTerm: '',
    targetLvr: '',
    rentalShadingPct: '',
    otherIncomeShadingPct: '',
    creditCardLoadingPct: '',
  },
};

const STAMP_DUTY_BANDS: Array<[number, number, number]> = [
  [0, 0, 0.014],
  [25000, 350, 0.024],
  [130000, 2870, 0.06],
  [960000, 0, 0.055],
  [2000000, 110000, 0.065],
];

const LMI_BANDS: Array<[number, number]> = [
  [0.0, 0.0],
  [0.8001, 0.016],
  [0.85, 0.022],
  [0.9, 0.032],
  [0.95, 0.048],
  [0.975, 0.058],
];

const TAX_BANDS: Array<[number, number, number]> = [
  [0, 0, 0.0],
  [18200, 0, 0.16],
  [45000, 4288, 0.3],
  [135000, 31288, 0.37],
  [190000, 51638, 0.45],
];

const LAND_TAX_BANDS: Array<[number, number, number]> = [
  [0, 0, 0.0],
  [50000, 500, 0.0],
  [100000, 975, 0.0],
  [300000, 1350, 0.003],
  [600000, 2250, 0.006],
  [1000000, 4650, 0.009],
];

const PURCHASE_TYPES = {
  PPR: {
    description: 'Standard owner-occupier purchase. No first home buyer concessions apply unless separately eligible.',
    fhogPriceLimit: 0,
    fullSdExemptUpto: 0,
    sdConcessionLimit: 0,
    maxFhogLvr: 0,
    applyFhog: false,
    applySdConcession: false,
  },
  FHOG: {
    description: 'First home buyer style scenario. House price capped at $950,000 and max LVR 95% for FHOG check.',
    fhogPriceLimit: 950000,
    fullSdExemptUpto: 600000,
    sdConcessionLimit: 750000,
    maxFhogLvr: 0.95,
    applyFhog: true,
    applySdConcession: true,
  },
  Investment: {
    description: 'Investment purchase. No FHOG or first-home stamp duty concession applies.',
    fhogPriceLimit: 0,
    fullSdExemptUpto: 0,
    sdConcessionLimit: 0,
    maxFhogLvr: 0,
    applyFhog: false,
    applySdConcession: false,
  },
};

export const DISCLAIMER =
  'All calculations are based on the uploaded spreadsheet as at 20/03/2026 and are for Victoria only. This app is for general information and education only and is not financial, legal, or tax advice. Please verify assumptions and speak with a qualified professional before relying on the outputs.';

export const parseNumber = (value: string | number | boolean, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, '').replace(/\$/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatMoney = (value: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(2)}%`;
export const formatSignedMoney = (value: number): string => `${value >= 0 ? '+' : '-'}${formatMoney(Math.abs(value))}`;
export const periodsPerYear = (frequency: Frequency): number => FREQUENCIES[frequency];
export const paymentLabel = (frequency: Frequency): string => (frequency === 'Weekly' ? 'week' : frequency === 'Fortnightly' ? 'fortnight' : 'month');

const pickBandRate = <T extends Array<number>>(value: number, bands: T[]): T => {
  let chosen = bands[0];
  for (const band of bands) {
    if (value >= band[0]) chosen = band;
    else break;
  }
  return chosen;
};

export const periodicPayment = (principal: number, annualRatePercent: number, years: number, frequency: Frequency): number => {
  const periods = periodsPerYear(frequency);
  const totalPeriods = Math.max(0, years) * periods;
  const ratePerPeriod = annualRatePercent / 100 / periods;
  if (principal <= 0 || totalPeriods <= 0) return 0;
  if (ratePerPeriod === 0) return principal / totalPeriods;
  const factor = Math.pow(1 + ratePerPeriod, totalPeriods);
  return (principal * ratePerPeriod * factor) / (factor - 1);
};

export const totalInterest = (principal: number, annualRatePercent: number, years: number, frequency: Frequency): number => {
  const payment = periodicPayment(principal, annualRatePercent, years, frequency);
  const n = years * periodsPerYear(frequency);
  return payment * n - principal;
};

export const amortizationInterestOverPeriod = (
  principal: number,
  annualRatePercent: number,
  years: number,
  frequency: Frequency,
  periods: number,
): number => {
  if (principal <= 0 || years <= 0 || periods <= 0) return 0;
  const perYear = periodsPerYear(frequency);
  const r = annualRatePercent / 100 / perYear;
  const payment = periodicPayment(principal, annualRatePercent, years, frequency);
  let balance = principal;
  let interestPaid = 0;
  for (let i = 0; i < Math.floor(periods); i += 1) {
    if (balance <= 0) break;
    const interest = balance * r;
    const principalComponent = Math.max(0, Math.min(payment - interest, balance));
    balance -= principalComponent;
    interestPaid += interest;
  }
  return interestPaid;
};

export const stampDuty = (price: number, purchaseType: PurchaseType): number => {
  if (price <= 0) return 0;
  const [threshold, base, rate] = pickBandRate(price, STAMP_DUTY_BANDS);
  const duty = base + (price - threshold) * rate;
  const cfg = PURCHASE_TYPES[purchaseType];
  if (!cfg.applySdConcession) return Math.max(duty, 0);
  if (price <= cfg.fullSdExemptUpto) return 0;
  if (price >= cfg.sdConcessionLimit) return Math.max(duty, 0);
  const scale = (price - cfg.fullSdExemptUpto) / (cfg.sdConcessionLimit - cfg.fullSdExemptUpto);
  return Math.max(duty * scale, 0);
};

export const fhogStatus = (price: number, lvr: number, purchaseType: PurchaseType): string => {
  const cfg = PURCHASE_TYPES[purchaseType];
  if (!cfg.applyFhog) return 'N/A';
  if (price <= cfg.fhogPriceLimit && lvr <= cfg.maxFhogLvr) return 'Eligible for FHOG';
  return 'Does not qualify for FHOG';
};

export const lmiCost = (propertyValue: number, loanAmount: number, exempt = false, exemptCap = 0.9): number => {
  if (propertyValue <= 0 || loanAmount <= 0) return 0;
  const lvr = loanAmount / propertyValue;
  if (exempt && lvr <= exemptCap) return 0;
  let rate = 0;
  for (const [threshold, bandRate] of LMI_BANDS) {
    if (lvr >= threshold) rate = bandRate;
    else break;
  }
  return loanAmount * rate;
};

export const annualTax = (income: number): number => {
  const [threshold, base, rate] = pickBandRate(income, TAX_BANDS);
  return base + rate * (income - threshold);
};

export const annualLandTax = (totalTaxableValue: number): number => {
  const [threshold, base, rate] = pickBandRate(totalTaxableValue, LAND_TAX_BANDS);
  return base + (totalTaxableValue - threshold) * rate;
};

export const getBankStyleHemMonthly = (applicantType: ApplicantType, dependants: number, loanPurpose: LoanPurpose): number => {
  const dep = Math.max(0, Math.min(6, Math.floor(dependants)));
  const hemTable = {
    single: [2800, 3350, 3850, 4350, 4850, 5350, 5850],
    couple: [4200, 4750, 5250, 5750, 6250, 6750, 7250],
  } as const;
  let hem = hemTable[applicantType === 'Couple' ? 'couple' : 'single'][dep];
  if (loanPurpose === 'Investment') hem *= 1.03;
  return hem;
};

export const annualNetIncomeForServicing = (grossIncome: number): number => {
  if (grossIncome <= 0) return 0;
  const tax = annualTax(grossIncome);
  const medicare = grossIncome * 0.02;
  return Math.max(0, grossIncome - tax - medicare);
};

export const getLenderProfileSettings = (profile: LenderProfile) => {
  switch (profile) {
    case 'Conservative':
      return { hemMultiplier: 1.06, rentalShadingPct: 0.75, otherIncomeShadingPct: 0.7, creditCardLoadingPct: 0.038, assessmentBufferPct: 3.0, assessmentFloorRatePct: 8.8, surplusHaircut: 0.88 };
    case 'Aggressive':
      return { hemMultiplier: 0.98, rentalShadingPct: 0.8, otherIncomeShadingPct: 0.8, creditCardLoadingPct: 0.025, assessmentBufferPct: 3.0, assessmentFloorRatePct: 8.2, surplusHaircut: 0.95 };
    default:
      return { hemMultiplier: 1.0, rentalShadingPct: 0.75, otherIncomeShadingPct: 0.7, creditCardLoadingPct: 0.03, assessmentBufferPct: 3.0, assessmentFloorRatePct: 8.5, surplusHaircut: 0.92 };
  }
};

const toneFromLvr = (lvr: number): AlertTone => (lvr > 0.95 ? 'bad' : lvr > 0.9 ? 'warn' : 'good');

export const scoreOnePropertyScenario = ({
  maxPurchaseMode = false,
  fhogBad = false,
  baseLvr = 0,
  affordabilityRatio,
  bufferAfterHousing,
}: {
  maxPurchaseMode?: boolean;
  fhogBad?: boolean;
  baseLvr?: number;
  affordabilityRatio?: number;
  bufferAfterHousing?: number;
}): { text: string; tone: AlertTone } => {
  if (fhogBad) return { text: 'Policy mismatch', tone: 'bad' };
  let score = 0;
  if (affordabilityRatio === undefined) score += 1;
  else if (affordabilityRatio <= 0.3) score += 2;
  else if (affordabilityRatio <= 0.4) score += 1;

  if (bufferAfterHousing === undefined) score += 1;
  else if (bufferAfterHousing >= 1000) score += 2;
  else if (bufferAfterHousing >= 0) score += 1;

  if (baseLvr <= 0.8) score += 2;
  else if (baseLvr <= 0.9) score += 1;
  if (maxPurchaseMode) score -= 1;
  if (score >= 5) return { text: 'Strong deal', tone: 'good' };
  if (score >= 3) return { text: 'Stretch but acceptable', tone: 'warn' };
  return { text: 'High-risk structure', tone: 'bad' };
};

export const buildOnePropertyRecommendations = ({
  price, purchaseType, fhogBad, finalLoan, lmi, oop, maxCashContribution, extraCash, affordabilityRatio, monthlyIncome, monthlyRepayment, bufferAfterHousing, useGuarantor, maxPurchaseMode,
}: {
  price: number; purchaseType: PurchaseType; fhogBad: boolean; finalLoan: number; lmi: number; oop: number; maxCashContribution: number; extraCash: number; affordabilityRatio?: number; monthlyIncome: number; monthlyRepayment: number; bufferAfterHousing?: number; useGuarantor: boolean; maxPurchaseMode: boolean;
}): string[] => {
  const cfg = PURCHASE_TYPES[purchaseType];
  const actions: string[] = [];
  const cashShortfall = maxCashContribution > 0 ? Math.max(0, oop - maxCashContribution) : 0;
  if (fhogBad) actions.push(`Keep the purchase price at or below ${formatMoney(cfg.fhogPriceLimit)} and the base LVR at or below ${(cfg.maxFhogLvr * 100).toFixed(1)}% for FHOG.`);
  if (extraCash > 0) actions.push(`The structure is short by about ${formatMoney(extraCash)} on borrowing power. Lift approval, add cash, or reduce the target price.`);
  if (cashShortfall > 0) actions.push(`Cash to complete is about ${formatMoney(cashShortfall)} above the entered contribution cap.`);
  if (lmi > 0 && price > 0) {
    const extraTo80 = Math.max(0, finalLoan - price * 0.8);
    if (extraTo80 > 0) actions.push(`About ${formatMoney(extraTo80)} more toward the deal would move the base LVR closer to 80% and usually remove LMI.`);
  }
  if (affordabilityRatio !== undefined && monthlyIncome > 0 && affordabilityRatio > 0.4) {
    const targetCut = Math.max(0, monthlyRepayment - monthlyIncome * 0.4);
    actions.push(`Repayments are running above 40% of income. A safer target is roughly ${formatMoney(targetCut)} less per month.`);
  }
  if (bufferAfterHousing !== undefined && bufferAfterHousing < 0) actions.push(`Monthly buffer after mortgage and living costs is short by about ${formatMoney(Math.abs(bufferAfterHousing))}.`);
  if (useGuarantor) actions.push('Treat guarantor support as temporary and confirm release strategy with the lender.');
  if (maxPurchaseMode) actions.push('Maximum purchase mode should be treated as an outer limit, not the recommended target.');
  if (!actions.length) actions.push('The current structure looks reasonably clean. Compare one step down in price or LVR to preserve comfort buffer.');
  return actions;
};

export type OnePropertyInputs = typeof DEFAULTS.oneProperty;
export type RefinanceInputs = typeof DEFAULTS.refinance;
export type BorrowingInputs = typeof DEFAULTS.borrowing;


export const calcOneProperty = (inputs: OnePropertyInputs) => {
  const purchaseType = (inputs.purchaseType || 'PPR') as PurchaseType;
  const frequency = (inputs.repaymentFrequency || 'Monthly') as Frequency;
  const requestedLvr = parseNumber(inputs.desiredLvr) / 100;
  const approvalMax = parseNumber(inputs.loanApprovalMax);
  const maxCashContribution = parseNumber(inputs.maxCashContribution);
  const rate = parseNumber(inputs.interestRate);
  const years = parseNumber(inputs.loanTerm);
  const yearlyIncome = parseNumber(inputs.yearlyIncome);
  const monthlyIncome = yearlyIncome / 12;
  const livingExpenses = parseNumber(inputs.livingExpensesMonthly);
  const exemptCap = parseNumber(inputs.exemptCap, 90) / 100;
  const transferFees = 2000;
  const inputPrice = parseNumber(inputs.housePrice);
  const extraPrincipal = parseNumber(inputs.extraPrincipal);
  const useGuarantor = !!inputs.useGuarantor;
  const lmiExempt = !!inputs.lmiExempt || useGuarantor;

  const cfg = PURCHASE_TYPES[purchaseType];
  const maxBaseLvr = purchaseType === 'FHOG' ? cfg.maxFhogLvr : 0.95;
  const appliedLvr = Math.min(requestedLvr || 0, maxBaseLvr);

  const evaluatePrice = (candidatePrice: number) => {
    const price = Math.max(0, candidatePrice);
    const requiredLoan = price * appliedLvr;
    const finalLoan = approvalMax > 0 ? Math.min(requiredLoan, approvalMax) : requiredLoan;
    const extraCash = approvalMax > 0 ? Math.max(0, requiredLoan - approvalMax) : 0;
    const sd = stampDuty(price, purchaseType);
    const baseLvr = price > 0 ? finalLoan / price : 0;
    const fhogLmiWaived =
      purchaseType === 'FHOG' &&
      price <= cfg.fhogPriceLimit &&
      baseLvr <= cfg.maxFhogLvr;

    const lmi = useGuarantor ? 0 : (fhogLmiWaived ? 0 : lmiCost(price, finalLoan, lmiExempt, exemptCap || 0.9));
    const loanPlusLmi = finalLoan + lmi;
    const effectiveLvr = price > 0 ? loanPlusLmi / price : 0;
    const repayment = periodicPayment(loanPlusLmi, rate, years, frequency);
    const interest = interestComponent(loanPlusLmi, rate, frequency);
    const yearlyExpenses = repayment * periodsPerYear(frequency) + extraPrincipal;
    const oop = Math.max(0, (price - finalLoan) + sd + transferFees);

    return {
      price,
      requiredLoan,
      finalLoan,
      extraCash,
      stampDuty: sd,
      baseLvr,
      fhogLmiWaived,
      lmi,
      loanPlusLmi,
      effectiveLvr,
      repayment,
      interest,
      yearlyExpenses,
      oop,
    };
  };

  let maxPurchasePrice = inputPrice;
  let modeNote = '';
  let oopLimitStatus = 'No limit applied';
  let price = inputPrice;

  if (inputs.maxPurchaseMode && appliedLvr > 0) {
    if (maxCashContribution > 0) {
      let high =
        approvalMax > 0
          ? Math.max(inputPrice, approvalMax / Math.max(appliedLvr, 1e-9) + maxCashContribution + transferFees + 250000)
          : Math.max(inputPrice, maxCashContribution / Math.max(1 - appliedLvr, 0.05) + transferFees + 250000);
      if (purchaseType === 'FHOG') high = Math.min(high, cfg.fhogPriceLimit * 1.1);
      let low = 0;
      let best = 0;
      for (let i = 0; i < 55; i += 1) {
        const mid = (low + high) / 2;
        const result = evaluatePrice(mid);
        if (result.oop <= maxCashContribution) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      maxPurchasePrice = Math.round(best);
      modeNote = `Maximum purchase price solved using cash cap of ${formatMoney(maxCashContribution)}.`;
    } else if (approvalMax > 0) {
      maxPurchasePrice = Math.round(approvalMax / Math.max(appliedLvr, 1e-9));
      modeNote = 'Maximum purchase price solved using the loan approval limit only.';
    } else {
      maxPurchasePrice = inputPrice;
      modeNote = 'Maximum purchase mode is on, but it needs a cash cap and/or approval limit to reverse-solve a price.';
    }
    price = maxPurchasePrice;
  }

  let result = evaluatePrice(price);

  if (
    inputs.enableOopLimit &&
    maxCashContribution > 0 &&
    result.oop > maxCashContribution &&
    !inputs.maxPurchaseMode &&
    appliedLvr > 0
  ) {
    const originalPrice = result.price;
    let low = 0;
    let high = result.price;
    let best = 0;
    for (let i = 0; i < 55; i += 1) {
      const mid = (low + high) / 2;
      const midResult = evaluatePrice(mid);
      if (midResult.oop <= maxCashContribution) {
        best = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    price = Math.round(best);
    result = evaluatePrice(price);
    oopLimitStatus = `Capped house price from ${formatMoney(originalPrice)} to ${formatMoney(price)} to fit within ${formatMoney(maxCashContribution)}`;
  } else if (inputs.enableOopLimit && maxCashContribution > 0) {
    oopLimitStatus = `Within limit of ${formatMoney(maxCashContribution)}`;
  } else if (maxCashContribution > 0) {
    oopLimitStatus = `Indicative only against ${formatMoney(maxCashContribution)}`;
  }

  const {
    requiredLoan,
    finalLoan,
    extraCash,
    stampDuty: sd,
    baseLvr,
    lmi,
    loanPlusLmi,
    effectiveLvr,
    repayment,
    interest,
    yearlyExpenses,
    oop,
  } = result;

  const fhog = fhogStatus(price, baseLvr, purchaseType);
  const fhogBad = purchaseType === 'FHOG' && fhog !== 'Eligible for FHOG';
  const monthlyRepaymentEquiv = repayment * periodsPerYear(frequency) / 12;
  const affordabilityRatio = monthlyIncome > 0 ? monthlyRepaymentEquiv / monthlyIncome : undefined;
  const bufferAfterHousing = monthlyIncome > 0 ? monthlyIncome - monthlyRepaymentEquiv - livingExpenses : undefined;

  const deal = scoreOnePropertyScenario({
    maxPurchaseMode: inputs.maxPurchaseMode,
    fhogBad,
    baseLvr,
    affordabilityRatio,
    bufferAfterHousing,
  });

  const cashShortfall = maxCashContribution > 0 ? Math.max(0, oop - maxCashContribution) : 0;
  const whyLimit = fhogBad
    ? 'FHOG / concession rules'
    : extraCash > 0
      ? 'Borrowing capacity / approval limit'
      : cashShortfall > 0
        ? 'Available cash contribution'
        : requestedLvr > appliedLvr + 0.0005
          ? 'LVR cap / policy limit'
          : affordabilityRatio !== undefined && affordabilityRatio > 0.4
            ? 'Affordability / cashflow'
            : bufferAfterHousing !== undefined && bufferAfterHousing < 0
              ? 'Monthly cash buffer'
              : inputs.maxPurchaseMode
                ? 'Maximum purchase solver'
                : useGuarantor
                  ? 'Guarantor-assisted structure'
                  : 'No obvious hard blocker';

  const recommendations = buildOnePropertyRecommendations({
    price,
    purchaseType,
    fhogBad,
    finalLoan,
    lmi,
    oop,
    maxCashContribution,
    extraCash,
    affordabilityRatio,
    monthlyIncome,
    monthlyRepayment: monthlyRepaymentEquiv,
    bufferAfterHousing,
    useGuarantor,
    maxPurchaseMode: inputs.maxPurchaseMode,
  });
  const bestNextMove = recommendations[0] ?? 'Review the structure against your policy, cash, and comfort settings.';

  const warnings: string[] = [];
  let warningTone: AlertTone = 'good';
  if (inputs.maxPurchaseMode) {
    warnings.push(modeNote || 'Maximum purchase price mode is active.');
    warningTone = 'info';
  }
  if (fhogBad) {
    warnings.push('FHOG selected but this scenario does not qualify under the current price/LVR.');
    warningTone = 'bad';
  }
  if (requestedLvr > 0.95 && !useGuarantor) {
    warnings.push('Above 95% LVR normally means limited lender options and elevated risk.');
    warningTone = 'bad';
  } else if (requestedLvr > 0.90 && warningTone !== 'bad') {
    warnings.push('Above 90% LVR means LMI can become expensive and valuations matter more.');
    warningTone = 'warn';
  }
  if (affordabilityRatio !== undefined && affordabilityRatio > 0.4) {
    warnings.push('Repayment exceeds 40% of entered income, which is a heavy affordability load.');
    warningTone = 'bad';
  } else if (affordabilityRatio !== undefined && affordabilityRatio > 0.3 && warningTone !== 'bad') {
    warnings.push('Repayment exceeds 30% of entered income, so cash flow should be reviewed carefully.');
    if (warningTone === 'good' || warningTone === 'info') warningTone = 'warn';
  }
  if (inputs.enableOopLimit) {
    warnings.push(oopLimitStatus);
    if ((cashShortfall > 0 || oop > maxCashContribution) && warningTone === 'good') warningTone = 'warn';
  } else if (maxCashContribution > 0) {
    warnings.push(oopLimitStatus);
  }
  if (useGuarantor) warnings.push('Guarantor mode is on and removes LMI here, but family/security risk still needs separate review.');
  if (!warnings.length) warnings.push('Scenario looks internally consistent using the current assumptions.');

  return {
    tone: deal.tone,
    deal,
    description: inputs.maxPurchaseMode
      ? `${PURCHASE_TYPES[purchaseType].description} Maximum purchase price mode is currently active.`
      : PURCHASE_TYPES[purchaseType].description,
    warnings,
    warningTone,
    outputs: {
      'Scenario Description': inputs.maxPurchaseMode
        ? `${PURCHASE_TYPES[purchaseType].description} Maximum purchase price mode is currently active.`
        : PURCHASE_TYPES[purchaseType].description,
      'Maximum Purchase Price': formatMoney(maxPurchasePrice || price),
      'Stamp Duty': formatMoney(sd),
      'Transfer Fees': formatMoney(transferFees),
      'LMI Costs': formatMoney(lmi),
      'FHOG Status': fhog,
      'Required Loan': formatMoney(requiredLoan),
      'Final Loan': formatMoney(finalLoan),
      'Extra Cash Required Due to Approval Limit': formatMoney(extraCash),
      'Approval Gap to Requested Loan': formatMoney(extraCash),
      'Total Out-of-Pocket Expenses': formatMoney(oop),
      'Requested LVR': requestedLvr > 0 ? formatPercent(requestedLvr) : '-',
      'Applied / Capped LVR': appliedLvr > 0 ? formatPercent(appliedLvr) : '-',
      'Base Loan-to-Value Ratio': formatPercent(baseLvr),
      'Total Loan Amount + LMI': formatMoney(loanPlusLmi),
      'Effective LVR Including LMI': formatPercent(effectiveLvr),
      'Principal & Interest Repayment': formatMoney(repayment),
      'Interest Portion of Repayment': formatMoney(interest),
      'Repayment as % of Income': affordabilityRatio !== undefined ? formatPercent(affordabilityRatio) : '-',
      'Affordability Stress': affordabilityRatio === undefined ? 'Not enough income entered'
        : affordabilityRatio <= 0.30 ? 'Green - comfortable'
        : affordabilityRatio <= 0.40 ? 'Amber - stretching'
        : 'Red - affordability pressure',
      'Monthly Buffer After Mortgage + Living': bufferAfterHousing !== undefined ? formatSignedMoney(bufferAfterHousing) : '-',
      'Main Limiting Factor': whyLimit,
      'Best Next Move': bestNextMove,
      'OOP Limit Status': oopLimitStatus,
      'Total Yearly Expenses': formatMoney(yearlyExpenses),
      'Repayment @ 4.5%': formatMoney(periodicPayment(loanPlusLmi, 4.5, years, frequency)),
      'Repayment @ 5.5%': formatMoney(periodicPayment(loanPlusLmi, 5.5, years, frequency)),
      'Repayment @ 6.5%': formatMoney(periodicPayment(loanPlusLmi, 6.5, years, frequency)),
    },
    atAGlance: [
      { label: 'Maximum purchase price', value: formatMoney(maxPurchasePrice || price), tone: 'info' as AlertTone },
      { label: 'Out of pocket', value: formatMoney(oop), tone: maxCashContribution > 0 && oop > maxCashContribution ? 'warn' : 'good' as AlertTone },
      { label: 'Loan amount', value: formatMoney(finalLoan), tone: 'info' as AlertTone },
      { label: 'Effective LVR', value: formatPercent(effectiveLvr), tone: toneFromLvr(effectiveLvr) },
      { label: 'Structure', value: deal.text, tone: deal.tone as AlertTone },
      { label: `Repayment / ${paymentLabel(frequency)}`, value: formatMoney(repayment), tone: affordabilityRatio !== undefined && affordabilityRatio > 0.4 ? 'bad' : affordabilityRatio !== undefined && affordabilityRatio > 0.3 ? 'warn' : 'good' as AlertTone },
    ],
    decisionGuide: [
      { label: 'Why this result', value: whyLimit },
      { label: 'Best next move', value: bestNextMove },
      { label: 'LVR position', value: `${formatPercent(baseLvr)} base / ${formatPercent(effectiveLvr)} effective` },
      { label: 'Monthly cash buffer', value: bufferAfterHousing !== undefined ? formatSignedMoney(bufferAfterHousing) : '-' },
    ],
  };
};

export const calcRefinance = (inputs: RefinanceInputs) => {
  const currentValue = parseNumber(inputs.currentValue);
  const currentLoan = parseNumber(inputs.currentLoan);
  const currentRate = parseNumber(inputs.currentRate);
  const currentTerm = parseNumber(inputs.currentTerm, 26);
  const currentFreq = (inputs.currentFreq || 'Monthly') as Frequency;
  const newRate = parseNumber(inputs.newRate);
  const newTerm = parseNumber(inputs.newTerm, 26);
  const newFreq = (inputs.newFreq || 'Monthly') as Frequency;
  const discharge = parseNumber(inputs.dischargeFee);
  const application = parseNumber(inputs.applicationFee);
  const legal = parseNumber(inputs.legalFee);
  const valuation = parseNumber(inputs.valuationFee);
  const gov = parseNumber(inputs.govFee);
  const cashback = parseNumber(inputs.cashback);
  const extraBorrow = parseNumber(inputs.extraBorrow);
  const lmiExempt = inputs.lmiExempt;
  const currentEquity = currentValue - currentLoan;
  const currentLvr = currentValue > 0 ? currentLoan / currentValue : 0;
  const baseNewLoan = currentLoan + extraBorrow;
  const lmi = lmiExempt ? 0 : lmiCost(currentValue, baseNewLoan, false, 0.9);
  const newLoanTotal = baseNewLoan + lmi;
  const newLvr = currentValue > 0 ? newLoanTotal / currentValue : 0;
  const currentRepay = periodicPayment(currentLoan, currentRate, currentTerm, currentFreq);
  const newRepay = periodicPayment(newLoanTotal, newRate, newTerm, newFreq);
  const annualDiff = currentRepay * periodsPerYear(currentFreq) - newRepay * periodsPerYear(newFreq);
  const refiCosts = discharge + application + legal + valuation + gov;
  const netCost = refiCosts - cashback;
  const breakeven = netCost <= 0 ? 'Immediate' : annualDiff <= 0 ? 'No break-even' : `${((netCost / annualDiff) * 12).toFixed(1)} months`;
  const interestCurrent = totalInterest(currentLoan, currentRate, currentTerm, currentFreq);
  const interestNew = totalInterest(newLoanTotal, newRate, newTerm, newFreq);
  const interestSaved = interestCurrent - interestNew - netCost;
  const periods1 = Math.min(periodsPerYear(currentFreq), currentTerm * periodsPerYear(currentFreq), newTerm * periodsPerYear(newFreq));
  const periods3 = Math.min(periodsPerYear(currentFreq) * 3, currentTerm * periodsPerYear(currentFreq), newTerm * periodsPerYear(newFreq));
  const periods5 = Math.min(periodsPerYear(currentFreq) * 5, currentTerm * periodsPerYear(currentFreq), newTerm * periodsPerYear(newFreq));
  const benefit1 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods1) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods1) + Math.max(0, netCost));
  const benefit3 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods3) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods3) + Math.max(0, netCost));
  const benefit5 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods5) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods5) + Math.max(0, netCost));
  let warningTone: AlertTone = 'good';
  const warnings: string[] = [];
  if (newLvr > 0.95) { warnings.push('Refinance LVR is above 95%. This is a very high-leverage scenario.'); warningTone = 'bad'; }
  else if (newLvr > 0.9) { warnings.push('Refinance LVR is above 90%. Review LMI and serviceability carefully.'); warningTone = 'warn'; }
  if (breakeven === 'No break-even') { warnings.push('On these assumptions, the refinance does not break even.'); if (warningTone === 'good') warningTone = 'warn'; }
  else if (breakeven === 'Immediate') warnings.push('Cashback offsets the upfront refinance costs immediately.');
  if (netCost > 0 && benefit1 < 0) { warnings.push('The first 12 months still look worse after costs, so this may be a medium-term play rather than an immediate win.'); if (warningTone === 'good') warningTone = 'warn'; }
  if (!warnings.length) warnings.push('Refinance scenario looks internally consistent on the current assumptions.');
  const worth = benefit5 > 0 && breakeven !== 'No break-even';
  const tone: AlertTone = worth ? (newLvr > 0.9 ? 'warn' : 'good') : 'bad';
  return {
    tone,
    deal: { text: worth ? 'Worth refinancing' : 'Refinance looks weak', tone },
    warnings,
    warningTone,
    outputs: {
      'Current equity': formatMoney(currentEquity),
      'Current LVR': formatPercent(currentLvr),
      'New LVR': formatPercent(newLvr),
      'Current repayment': formatMoney(currentRepay),
      'New repayment': formatMoney(newRepay),
      'Annual repayment difference': formatSignedMoney(annualDiff),
      'Total refinance costs': formatMoney(refiCosts),
      'Net upfront cost': formatMoney(netCost),
      'Break-even period': breakeven,
      'Calculated LMI cost': formatMoney(lmi),
      'Stay vs refinance benefit (1 year)': formatSignedMoney(benefit1),
      'Stay vs refinance benefit (3 years)': formatSignedMoney(benefit3),
      'Stay vs refinance benefit (5 years)': formatSignedMoney(benefit5),
      'Estimated lifetime interest saved': formatSignedMoney(interestSaved),
    },
    atAGlance: [
      { label: 'Worth refinancing?', value: worth ? 'Yes' : 'No', tone },
      { label: 'Break-even', value: breakeven, tone: breakeven === 'No break-even' ? 'bad' : breakeven === 'Immediate' ? 'good' : 'info' as AlertTone },
      { label: 'Net upfront cost', value: formatMoney(netCost), tone: netCost > 0 ? 'warn' : 'good' as AlertTone },
      { label: 'New repayment', value: formatMoney(newRepay), tone: annualDiff > 0 ? 'good' : 'warn' as AlertTone },
      { label: '12 month benefit', value: formatSignedMoney(benefit1), tone: benefit1 >= 0 ? 'good' : 'warn' as AlertTone },
      { label: '5 year benefit', value: formatSignedMoney(benefit5), tone: benefit5 >= 0 ? 'good' : 'bad' as AlertTone },
    ],
    decisionGuide: [
      { label: 'Why this result', value: !worth ? 'The refinance does not recover its costs strongly enough under the current assumptions.' : newLvr > 0.9 ? 'Savings exist, but leverage remains elevated so lender policy matters.' : 'The lower rate appears to recover costs and improve medium-term cashflow.' },
      { label: 'Best next move', value: !worth ? 'Reprice the current lender first, or test a lower-cost refinance structure.' : 'Confirm lender policy, valuation, and cashback terms before proceeding.' },
      { label: 'LVR position', value: formatPercent(newLvr) },
      { label: 'New total loan', value: formatMoney(newLoanTotal) },
    ],
  };
};

export const calcBorrowing = (inputs: BorrowingInputs) => {
  const lenderProfile = (inputs.lenderProfile || 'NAB-style') as LenderProfile;
  const applicantType = (inputs.applicantType || 'Single') as ApplicantType;
  const loanPurpose = (inputs.loanPurpose || 'Owner Occupier') as LoanPurpose;
  const dependants = parseNumber(inputs.dependants);
  const grossIncome1 = parseNumber(inputs.grossIncome1);
  const grossIncome2 = parseNumber(inputs.grossIncome2);
  const rentalIncomeMonthly = parseNumber(inputs.rentalIncomeMonthly);
  const otherIncomeAnnual = parseNumber(inputs.otherIncomeAnnual);
  const livingExpensesMonthly = parseNumber(inputs.livingExpensesMonthly);
  const existingLoanRepaymentsMonthly = parseNumber(inputs.existingLoanRepaymentsMonthly);
  const creditCardLimits = parseNumber(inputs.creditCardLimits);
  const otherDebtsMonthly = parseNumber(inputs.otherDebtsMonthly);
  const actualRate = parseNumber(inputs.actualRate, 5.9);
  const inputBuffer = parseNumber(inputs.assessmentBufferPct, 3);
  const inputFloor = parseNumber(inputs.assessmentFloorRatePct, 8.5);
  const loanTerm = parseNumber(inputs.loanTerm, 30);
  const targetLvr = parseNumber(inputs.targetLvr, 80) / 100;
  const inputRentalShade = parseNumber(inputs.rentalShadingPct, 75) / 100;
  const inputOtherShade = parseNumber(inputs.otherIncomeShadingPct, 70) / 100;
  const inputCardLoad = parseNumber(inputs.creditCardLoadingPct, 3) / 100;
  const profile = getLenderProfileSettings(lenderProfile);
  const hemFloor = getBankStyleHemMonthly(applicantType, dependants, loanPurpose) * profile.hemMultiplier;
  const livingUsed = Math.max(livingExpensesMonthly, hemFloor);
  const salaryIncomeAnnual = annualNetIncomeForServicing(grossIncome1) + annualNetIncomeForServicing(grossIncome2);
  const shadedRentAnnual = rentalIncomeMonthly * 12 * (inputs.rentalShadingPct ? inputRentalShade : profile.rentalShadingPct);
  const shadedOtherIncomeAnnual = otherIncomeAnnual * (inputs.otherIncomeShadingPct ? inputOtherShade : profile.otherIncomeShadingPct);
  const monthlyIncomeUsed = (salaryIncomeAnnual + shadedRentAnnual + shadedOtherIncomeAnnual) / 12;
  const ccCommitment = creditCardLimits * (inputs.creditCardLoadingPct ? inputCardLoad : profile.creditCardLoadingPct);
  const monthlyCommitments = livingUsed + existingLoanRepaymentsMonthly + ccCommitment + otherDebtsMonthly;
  const monthlySurplus = Math.max(0, (monthlyIncomeUsed - monthlyCommitments) * profile.surplusHaircut);
  const assessmentRateUsed = Math.max(actualRate + (inputs.assessmentBufferPct ? inputBuffer : profile.assessmentBufferPct), inputs.assessmentFloorRatePct ? inputFloor : profile.assessmentFloorRatePct);
  const borrowingCapacity = monthlySurplus > 0 ? (monthlySurplus * (1 - Math.pow(1 + assessmentRateUsed / 100 / 12, -(loanTerm * 12)))) / (assessmentRateUsed / 100 / 12) : 0;
  const depositRequired = targetLvr > 0 ? borrowingCapacity * (1 - targetLvr) / targetLvr : 0;
  const maxPurchasePrice = borrowingCapacity + depositRequired;
  const assessmentRepayment = periodicPayment(borrowingCapacity, assessmentRateUsed, loanTerm, 'Monthly');
  const surplusRatio = monthlyIncomeUsed > 0 ? monthlySurplus / monthlyIncomeUsed : 0;
  const warnings: string[] = [];
  let warningTone: AlertTone = 'good';
  if (monthlySurplus <= 0) { warnings.push('Monthly surplus is nil or negative after the benchmark expenses and debt commitments, so borrowing capacity is effectively exhausted.'); warningTone = 'bad'; }
  else if (surplusRatio < 0.15) { warnings.push('Serviceability looks tight because only a small share of assessed income remains after benchmark commitments.'); warningTone = 'warn'; }
  if (!warnings.length) warnings.push('Bank-style borrowing estimate is positive on the current assumptions.');
  const tone: AlertTone = monthlySurplus <= 0 ? 'bad' : surplusRatio < 0.15 ? 'warn' : 'good';
  return {
    tone,
    deal: { text: monthlySurplus <= 0 ? 'Borrowing capacity exhausted' : surplusRatio < 0.15 ? 'Borrowing capacity is tight' : 'Borrowing position looks workable', tone },
    warnings,
    warningTone,
    outputs: {
      'HEM floor': formatMoney(hemFloor),
      'Living expense used': formatMoney(livingUsed),
      'Salary income used': formatMoney(salaryIncomeAnnual),
      'Shaded rent': formatMoney(shadedRentAnnual),
      'Other income used': formatMoney(shadedOtherIncomeAnnual),
      'Monthly income used': formatMoney(monthlyIncomeUsed),
      'Credit card commitment': formatMoney(ccCommitment),
      'Monthly commitments': formatMoney(monthlyCommitments),
      'Monthly surplus': formatMoney(monthlySurplus),
      'Assessment rate used': `${assessmentRateUsed.toFixed(2)}%`,
      'Borrowing capacity': formatMoney(borrowingCapacity),
      'Maximum purchase price': formatMoney(maxPurchasePrice),
      'Assessment repayment': formatMoney(assessmentRepayment),
      'Deposit required': formatMoney(depositRequired),
      'Service ratio': formatPercent(surplusRatio),
    },
    borrowingSummary: [
      { label: 'Total borrowing capacity', value: formatMoney(borrowingCapacity), tone },
      { label: 'Maximum purchase price', value: formatMoney(maxPurchasePrice), tone: 'info' as AlertTone },
      { label: 'Assessment rate', value: `${assessmentRateUsed.toFixed(2)}%`, tone: targetLvr <= 0.9 ? 'good' : 'warn' as AlertTone },
      { label: 'Target LVR', value: formatPercent(targetLvr), tone: targetLvr <= 0.9 ? 'good' : 'bad' as AlertTone },
    ],
    decisionGuide: [
      { label: 'Why this result', value: monthlySurplus <= 0 ? 'Benchmark expenses and commitments consume all assessed surplus.' : surplusRatio < 0.15 ? 'Only a thin monthly servicing buffer remains after benchmark commitments.' : 'A positive monthly servicing buffer remains after benchmark commitments.' },
      { label: 'Best next move', value: monthlySurplus <= 0 ? 'Reduce debts or expenses, or increase assessed income before pursuing a higher purchase.' : 'Stress test the result with a slightly higher living cost or lower target LVR.' },
      { label: 'Monthly surplus', value: formatMoney(monthlySurplus) },
      { label: 'Deposit required', value: formatMoney(depositRequired) },
    ],
  };
};
export const interestComponent = (principal: number, annualRatePercent: number, frequency: Frequency): number => {
  if (principal <= 0) return 0;
  return (principal * (annualRatePercent / 100)) / periodsPerYear(frequency);
};


