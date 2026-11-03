import { SITE_CONFIG } from './site-config';
import { residentialDuty, schemePriceCap, AUSTRALIAN_STATES, type AustralianState, type HomeKind } from './duty';
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
    brandName: SITE_CONFIG.businessName,
    brokerName: '',
    propertyOneName: '',
    propertyTwoName: '',
  },
  oneProperty: {
    scenarioName: '',
    purchaseType: '' as PurchaseType | '',
    state: 'VIC' as AustralianState,
    homeKind: 'Established' as HomeKind,
    firstHomeEligible: false, // Legacy saved-case field; relief is now automatic.
    firstHomeReliefOptOut: false,
    ntPackageEligible: false,
    lmiBasis: 'Lender / professional waiver' as 'Lender / professional waiver' | '5% Deposit Scheme',
    schemeArea: '' as '' | 'Capital / eligible regional centre' | 'Other areas',
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
    exemptCap: '95',
    repaymentFrequency: '' as Frequency | '',
    extraPrincipal: '',
    yearlyIncome: '',
    livingExpensesMonthly: '3000',
  },
  twoProperties: {
    scenarioName: '',
    state: 'VIC' as AustralianState,
    interestRate: '',
    loanTerm: '',
    currentMortgage: '',
    currentValue: '',
    secondPrice: '',
    secondPurpose: 'Investment' as 'Investment' | 'PPR',
    crossCollat: true,
    desiredLvr: '',
    withdraw80: false,
    currentRent: '',
    newRent: '',
    approvalMax: '',
    lmiExempt: false,
    exemptCap: '',
    yearlyIncome: '',
    annualPropertyCosts: '',
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
    helpRepaymentsMonthly: '',
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
  [18200, 0, 0.15],
  [45000, 4020, 0.3],
  [135000, 31020, 0.37],
  [190000, 51370, 0.45],
];

const LAND_TAX_BANDS: Array<[number, number, number]> = [
  [0, 0, 0.0],
  [50000, 500, 0.0],
  [100000, 975, 0.0],
  [300000, 1350, 0.003],
  [600000, 2250, 0.006],
  [1000000, 4650, 0.009],
];

const PURCHASE_TYPES: Record<PurchaseType, { description: string }> = {
  PPR: { description: 'Owner-occupier purchase; applicable home concessions depend on eligibility.' },
  FHOG: { description: 'First home buyer purchase; duty relief and LMI waivers require separate eligibility checks.' },
  Investment: { description: 'Investment purchase; first-home duty relief is not applied.' },
};

export const DISCLAIMER =
  'Residential duty estimates use selected state rules as at 2 November 2026, for standard home purchases. Eligibility, transaction dates, concessions, surcharges, state land tax and fees must be checked independently. Financial estimates are indicative, not loan approval or financial advice.';

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

export const stampDuty = (price: number, purchaseType: PurchaseType, state: AustralianState = 'VIC', firstHomeEligible = false, kind: HomeKind = 'Established'): number =>
  residentialDuty(price, state, purchaseType !== 'Investment', purchaseType === 'FHOG' && firstHomeEligible, kind);

export const lmiCost = (propertyValue: number, loanAmount: number, exempt = false, exemptCap = 0.9): number => {
  if (propertyValue <= 0 || loanAmount <= 0) return 0;
  const lvr = loanAmount / propertyValue;
  if (exempt && lvr <= exemptCap + 1e-10) return 0;
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
  if (score >= 5) return { text: 'Indicative estimate', tone: 'info' };
  if (score >= 3) return { text: 'Review your assumptions', tone: 'info' };
  return { text: 'Review lending and cash flow', tone: 'warn' };
};

export const buildOnePropertyRecommendations = ({
  price, purchaseType, fhogBad, finalLoan, lmi, oop, maxCashContribution, extraCash, affordabilityRatio, monthlyIncome, monthlyRepayment, bufferAfterHousing, useGuarantor, maxPurchaseMode,
}: {
  price: number; purchaseType: PurchaseType; fhogBad: boolean; finalLoan: number; lmi: number; oop: number; maxCashContribution: number; extraCash: number; affordabilityRatio?: number; monthlyIncome: number; monthlyRepayment: number; bufferAfterHousing?: number; useGuarantor: boolean; maxPurchaseMode: boolean;
}): string[] => {
  void purchaseType;
  const actions: string[] = [];
  const cashShortfall = maxCashContribution > 0 ? Math.max(0, oop - maxCashContribution) : 0;
  if (fhogBad) actions.push('Review the purchase eligibility and lending policy.');
  if (extraCash > 0) actions.push(`The entered loan limit is ${formatMoney(extraCash)} below the requested base loan. Consider more available cash or a lower price, and check lending options.`);
  if (cashShortfall > 0) actions.push(`Cash to complete is about ${formatMoney(cashShortfall)} above the entered contribution cap.`);
  if (lmi > 0 && price > 0) {
    const extraTo80 = Math.max(0, finalLoan - price * 0.8);
    if (extraTo80 > 0) actions.push(`About ${formatMoney(extraTo80)} more toward the deal would move the base LVR closer to 80% and usually remove LMI.`);
  }
  if (affordabilityRatio !== undefined && monthlyIncome > 0 && affordabilityRatio > 0.4) {
    const targetCut = Math.max(0, monthlyRepayment - monthlyIncome * 0.4);
    actions.push(`Repayments are running above 40% of income. Reducing repayments by about ${formatMoney(targetCut)} per month would bring them to 40% of gross income; this is not a serviceability assessment.`);
  }
  if (bufferAfterHousing !== undefined && bufferAfterHousing < 0) actions.push(`Monthly buffer after mortgage and living costs is short by about ${formatMoney(Math.abs(bufferAfterHousing))}.`);
  if (useGuarantor) actions.push('Treat guarantor support as temporary and confirm release strategy with the lender.');
  if (maxPurchaseMode) actions.push('Maximum purchase mode should be treated as an outer limit, not the recommended target.');
  if (!actions.length) actions.push('Compare a lower purchase price or LVR and check the assumptions with a lender.');
  return actions;
};

export type OnePropertyInputs = typeof DEFAULTS.oneProperty;
export type TwoPropertyInputs = typeof DEFAULTS.twoProperties;
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
  const waiverCapPercent = parseNumber(inputs.exemptCap ?? '95', NaN);
  const exemptCap = waiverCapPercent / 100;
  const professionalWaiverSelected = !!inputs.lmiExempt && inputs.lmiBasis !== '5% Deposit Scheme';
  const validWaiverCap = Number.isFinite(waiverCapPercent) && waiverCapPercent > 0 && waiverCapPercent <= 100;
  const transferFees = 2000;
  const inputPrice = parseNumber(inputs.housePrice);
  const extraPrincipal = parseNumber(inputs.extraPrincipal);
  const useGuarantor = !!inputs.useGuarantor;
  const lmiExempt = !!inputs.lmiExempt || useGuarantor;

  const state: AustralianState = AUSTRALIAN_STATES.includes(inputs.state) ? inputs.state : 'VIC';
  const kind: HomeKind = inputs.homeKind === 'New' ? 'New' : 'Established';
  const maxBaseLvr = 0.95;
  // A selected professional waiver is a goal for this scenario, so stay within its cap.
  // The entered desired LVR remains intact for comparison if the waiver is switched off.
  const appliedLvr = professionalWaiverSelected && !validWaiverCap
    ? 0
    : Math.min(Math.max(requestedLvr || 0, 0), maxBaseLvr, professionalWaiverSelected ? exemptCap : 1);
  const waiverLimitsLvr = professionalWaiverSelected && validWaiverCap && requestedLvr > appliedLvr + 1e-10 && exemptCap <= maxBaseLvr;

  const evaluatePrice = (candidatePrice: number) => {
    const price = Math.max(0, candidatePrice);
    const requiredLoan = price * appliedLvr;
    const finalLoan = approvalMax > 0 ? Math.min(requiredLoan, approvalMax) : requiredLoan;
    const extraCash = approvalMax > 0 ? Math.max(0, requiredLoan - approvalMax) : 0;
    const ntRelief = state === 'NT' && purchaseType !== 'Investment' && kind === 'New' && !!inputs.ntPackageEligible;
    const sd = ntRelief ? 0 : stampDuty(price, purchaseType, state, !inputs.firstHomeReliefOptOut, kind);
    const baseLvr = price > 0 ? finalLoan / price : 0;
    const schemeSelected = inputs.lmiBasis === '5% Deposit Scheme';
    const schemeArea = inputs.schemeArea;
    const schemeCap = schemeArea === 'Other areas' || schemeArea === 'Capital / eligible regional centre' ? schemePriceCap(state, schemeArea) : 0;
    const schemeWaiver = lmiExempt && schemeSelected && purchaseType === 'FHOG' && price <= schemeCap && baseLvr <= 0.95;
    const professionalWaiver = lmiExempt && !schemeSelected;
    const lmi = useGuarantor ? 0 : lmiCost(price, finalLoan, schemeWaiver || professionalWaiver, schemeWaiver ? 0.95 : exemptCap);
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
      lmi,
      loanPlusLmi,
      effectiveLvr,
      repayment,
      interest,
      yearlyExpenses,
      oop,
    };
  };

  let maxPurchasePrice = inputs.maxPurchaseMode ? 0 : inputPrice;
  let modeNote = '';
  let oopLimitStatus = 'No limit applied';
  let price = inputs.maxPurchaseMode ? 0 : inputPrice;

  if (inputs.maxPurchaseMode && appliedLvr > 0) {
    if (maxCashContribution > 0) {
      let high =
        approvalMax > 0
          ? Math.max(inputPrice, approvalMax / Math.max(appliedLvr, 1e-9) + maxCashContribution + transferFees + 250000)
          : Math.max(inputPrice, maxCashContribution / Math.max(1 - appliedLvr, 0.05) + transferFees + 250000);
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
      maxPurchasePrice = Math.floor(best + 1e-7);
      modeNote = `Maximum purchase price solved using cash cap of ${formatMoney(maxCashContribution)}.`;
    } else if (approvalMax > 0) {
      maxPurchasePrice = Math.round(approvalMax / Math.max(appliedLvr, 1e-9));
      modeNote = 'Maximum purchase price solved using the loan approval limit only.';
    } else {
      maxPurchasePrice = 0;
      modeNote = 'Maximum purchase mode is on, but it needs a cash cap and/or approval limit to reverse-solve a price.';
    }
    price = maxPurchasePrice;
  } else if (inputs.maxPurchaseMode) {
    modeNote = professionalWaiverSelected && !validWaiverCap
      ? 'Enter a valid maximum LVR for the waiver to calculate a maximum price.'
      : 'Enter a desired LVR and a cash budget and/or loan approval limit to calculate a maximum price.';
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

  const fhogBad = false;
  const firstHomeStatus = purchaseType !== 'FHOG' ? 'Not selected' : inputs.firstHomeReliefOptOut ? 'Not applied — buyer marked ineligible' : 'State rules applied where available; eligibility assumed';
  const repaymentKnown = String(inputs.interestRate ?? '').trim() !== '' && rate >= 0 && years > 0;
  const monthlyRepaymentEquiv = repayment * periodsPerYear(frequency) / 12;
  const affordabilityRatio = repaymentKnown && monthlyIncome > 0 ? monthlyRepaymentEquiv / monthlyIncome : undefined;
  const bufferAfterHousing = repaymentKnown && monthlyIncome > 0 ? monthlyIncome - monthlyRepaymentEquiv - livingExpenses : undefined;
  const invalidAmounts = [inputs.maxPurchaseMode ? 0 : inputPrice, requestedLvr, approvalMax, maxCashContribution, rate, years, yearlyIncome, livingExpenses, extraPrincipal].some(value => value < 0);
  const invalidLvr = requestedLvr > 1;
  const purchaseTypeMissing = !inputs.purchaseType;
  const cashLimitMissing = !!inputs.enableOopLimit && !inputs.maxPurchaseMode && maxCashContribution <= 0;
  const incomplete = price <= 0 || appliedLvr <= 0 || invalidAmounts || invalidLvr || purchaseTypeMissing || cashLimitMissing;
  const scoredDeal = scoreOnePropertyScenario({
    maxPurchaseMode: inputs.maxPurchaseMode,
    fhogBad,
    baseLvr,
    affordabilityRatio,
    bufferAfterHousing,
  });

  const deal: { text: string; tone: AlertTone } = incomplete ? { text: 'Add inputs to calculate', tone: 'info' } : scoredDeal;

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
                  : 'Lender eligibility and serviceability not assessed';

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
  const bestNextMove = incomplete ? 'Enter a property price or maximum-price limits and a desired LVR.' : recommendations[0] ?? 'Review the structure against your policy, cash, and comfort settings.';

  const warnings: string[] = [];
  let warningTone: AlertTone = 'info';
  if (purchaseTypeMissing) warnings.push('Select the purchase type to apply the appropriate duty assumptions.');
  if (invalidAmounts) warnings.push('Enter non-negative amounts for the property, loan, income and expenses.');
  if (invalidLvr) warnings.push('Enter a desired LVR no higher than 100%.');
  if (cashLimitMissing) warnings.push('Enter available cash or turn off the option to limit price to available cash.');
  if (requestedLvr > maxBaseLvr && !invalidLvr && !waiverLimitsLvr) warnings.push(`The model uses a maximum base LVR of ${formatPercent(maxBaseLvr)}; actual lender limits may differ.`);
  if (inputs.maxPurchaseMode) {
    warnings.push(modeNote || 'Maximum purchase price mode is active.');
    warningTone = 'info';
  }
  if (professionalWaiverSelected && !validWaiverCap) warnings.push('Enter a waiver maximum LVR greater than 0% and no more than 100%; the scenario is paused until then.');
  if (waiverLimitsLvr) {
    warnings.push(`Desired LVR ${formatPercent(requestedLvr)} was reduced to ${formatPercent(appliedLvr)} to stay within the selected LMI waiver limit.`);
    warningTone = 'info';
  }
  if (bufferAfterHousing !== undefined) warnings.push('Income figures are before tax and do not include all debts or expenses; this is not take-home cash flow or a serviceability assessment.');
  if (purchaseType === 'FHOG' && inputs.firstHomeReliefOptOut) warnings.push('First-home duty relief is switched off for this scenario.');
  if (purchaseType === 'FHOG' && !inputs.firstHomeReliefOptOut) warnings.push('First-home duty relief is applied where available, assuming all buyers qualify. Confirm conditions and transaction dates.');
  if (inputs.maxPurchaseMode && maxCashContribution <= 0 && approvalMax > 0) warnings.push('No cash budget was entered, so available deposit and costs have not limited this result.');
  if (inputs.maxPurchaseMode && maxCashContribution > 0 && approvalMax <= 0) warnings.push('No loan approval limit was entered, so borrowing capacity has not limited this result.');
  if (state === 'NT' && !(inputs.ntPackageEligible && purchaseType !== 'Investment' && kind === 'New')) warnings.push('NT house-and-land package exemptions are not automatically included; check the Territory Revenue Office.');
  if (state === 'NT' && inputs.ntPackageEligible && purchaseType !== 'Investment' && kind === 'New') warnings.push('NT package exemption applies only if all conditions and contract dates are met.');
  if (state === 'TAS' && purchaseType === 'FHOG') warnings.push('Tasmania first-home relief depends on settlement date; current estimates exclude historical concessions.');
  if (inputs.lmiExempt && inputs.lmiBasis === '5% Deposit Scheme') {
    const schemeCap = inputs.schemeArea === 'Other areas' || inputs.schemeArea === 'Capital / eligible regional centre' ? schemePriceCap(state, inputs.schemeArea) : 0;
    warnings.push(schemeCap ? `5% Deposit Scheme: selected area cap ${formatMoney(schemeCap)}. Confirm postcode, lender valuation and full eligibility; approval is not assessed.` : 'Select the correct scheme price-cap area; the scheme LMI waiver has not been applied.');
    if (price > schemeCap || purchaseType !== 'FHOG' || baseLvr > 0.95) warnings.push('5% Deposit Scheme LMI waiver not applied: review price, purchase type and LVR.');
  } else if (inputs.lmiExempt) warnings.push('LMI waiver assumes lender or professional eligibility has been confirmed.');
  if (new Date().getFullYear() > 2026) warnings.push('Duty rates were reviewed for 2026 and may have changed; verify current rates.');
  if (appliedLvr > 0.95 && !useGuarantor) {
    warnings.push('Above 95% LVR normally means limited lender options and elevated risk.');
    warningTone = 'bad';
  } else if (appliedLvr > 0.90) {
    warnings.push('Above 90% LVR means LMI can become expensive and valuations matter more.');
    warningTone = 'warn';
  }
  if (affordabilityRatio !== undefined && affordabilityRatio > 0.4) {
    warnings.push('Repayment exceeds 40% of entered gross income; review the full household budget.');
    warningTone = 'bad';
  } else if (affordabilityRatio !== undefined && affordabilityRatio > 0.3 && warningTone !== 'bad') {
    warnings.push('Repayment exceeds 30% of entered gross income; review the full household budget.');
    if (warningTone === 'info') warningTone = 'warn';
  }
  if (inputs.enableOopLimit && !inputs.maxPurchaseMode) {
    warnings.push(oopLimitStatus);
    if ((cashShortfall > 0 || oop > maxCashContribution) && warningTone === 'info') warningTone = 'warn';
  } else if (maxCashContribution > 0) {
    warnings.push(oopLimitStatus);
  }
  if (useGuarantor) warnings.push('Guarantor mode is on and removes LMI here, but family/security risk still needs separate review.');
  if (!warnings.length) warnings.push('Scenario looks internally consistent using the current assumptions.');

  return {
    tone: deal.tone,
    isComplete: !incomplete,
    waiverLimitsLvr,
    invalidWaiverCap: professionalWaiverSelected && !validWaiverCap,
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
      'Maximum Purchase Price': price > 0 ? formatMoney(price) : '-',
      'Stamp Duty': formatMoney(sd),
      'Transfer Fees': formatMoney(transferFees),
      'LMI Costs': formatMoney(lmi),
      'State / territory': state,
      'First-home duty relief': firstHomeStatus,
      '5% Scheme area price cap': inputs.lmiExempt && inputs.lmiBasis === '5% Deposit Scheme' && (inputs.schemeArea === 'Other areas' || inputs.schemeArea === 'Capital / eligible regional centre') ? formatMoney(schemePriceCap(state, inputs.schemeArea)) : 'Not selected',
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
      'Principal & Interest Repayment': repaymentKnown ? formatMoney(repayment) : 'Enter rate and term',
      'Interest Portion of Repayment': repaymentKnown ? formatMoney(interest) : 'Enter rate and term',
      'Repayment as % of gross income': affordabilityRatio !== undefined ? formatPercent(affordabilityRatio) : '-',
      'Repayment-to-gross-income indicator': affordabilityRatio === undefined ? 'Enter income, interest rate and term'
        : affordabilityRatio <= 0.30 ? 'Up to 30% of gross income'
        : affordabilityRatio <= 0.40 ? '30–40% of gross income'
        : 'Above 40% of gross income',
      'Gross monthly income less repayment and entered living costs (before tax)': bufferAfterHousing !== undefined ? formatSignedMoney(bufferAfterHousing) : '-',
      'Main Limiting Factor': whyLimit,
      'Best Next Move': bestNextMove,
      'OOP Limit Status': oopLimitStatus,
      'Total Yearly Expenses': repaymentKnown ? formatMoney(yearlyExpenses) : 'Enter rate and term',
      'Repayment @ 4.5%': years > 0 ? formatMoney(periodicPayment(loanPlusLmi, 4.5, years, frequency)) : 'Enter loan term',
      'Repayment @ 5.5%': years > 0 ? formatMoney(periodicPayment(loanPlusLmi, 5.5, years, frequency)) : 'Enter loan term',
      'Repayment @ 6.5%': years > 0 ? formatMoney(periodicPayment(loanPlusLmi, 6.5, years, frequency)) : 'Enter loan term',
    },
    atAGlance: [
      { label: inputs.maxPurchaseMode ? 'Maximum purchase price' : 'Property price', value: price > 0 ? formatMoney(price) : '-', tone: 'info' as AlertTone },
      { label: 'Out of pocket', value: formatMoney(oop), tone: maxCashContribution > 0 && oop > maxCashContribution ? 'warn' : 'info' as AlertTone },
      { label: 'Loan amount', value: formatMoney(finalLoan), tone: 'info' as AlertTone },
      { label: 'Effective LVR', value: formatPercent(effectiveLvr), tone: toneFromLvr(effectiveLvr) },
      { label: 'Structure', value: deal.text, tone: deal.tone as AlertTone },
      { label: `Repayment / ${paymentLabel(frequency)}`, value: repaymentKnown ? formatMoney(repayment) : 'Enter rate and term', tone: affordabilityRatio !== undefined && affordabilityRatio > 0.4 ? 'bad' : affordabilityRatio !== undefined && affordabilityRatio > 0.3 ? 'warn' : 'info' as AlertTone },
    ],
    decisionGuide: [
      { label: 'Why this result', value: whyLimit },
      { label: 'Best next move', value: bestNextMove },
      { label: 'LVR position', value: `${formatPercent(baseLvr)} base / ${formatPercent(effectiveLvr)} effective` },
      { label: 'Gross income less entered costs (before tax)', value: bufferAfterHousing !== undefined ? formatSignedMoney(bufferAfterHousing) : '-' },
    ],
  };
};



export const calcTwoProperties = (inputs: TwoPropertyInputs) => {
  const rate = parseNumber(inputs.interestRate, 5.9), years = parseNumber(inputs.loanTerm, 30);
  const currentMortgage = parseNumber(inputs.currentMortgage), currentValue = parseNumber(inputs.currentValue);
  const secondPrice = parseNumber(inputs.secondPrice), desiredLvr = parseNumber(inputs.desiredLvr) / 100;
  const currentRent = parseNumber(inputs.currentRent), newRent = parseNumber(inputs.newRent);
  const approvalMax = parseNumber(inputs.approvalMax), yearlyIncome = parseNumber(inputs.yearlyIncome);
  const crossCollat = !!inputs.crossCollat, withdraw80 = !!inputs.withdraw80;
  const exemptCap = parseNumber(inputs.exemptCap, NaN) / 100;
  const costsEntered = String(inputs.annualPropertyCosts ?? '').trim() !== '';
  const annualCosts = parseNumber(inputs.annualPropertyCosts ?? '');
  const invalid: string[] = [];
  if (currentValue <= 0 || secondPrice <= 0) invalid.push('Enter both property values above zero.');
  if (currentMortgage < 0 || approvalMax < 0 || currentRent < 0 || newRent < 0 || annualCosts < 0) invalid.push('Amounts cannot be negative.');
  if (desiredLvr <= 0 || desiredLvr >= 1) invalid.push('Enter a target combined LVR above 0% and below 100%.');
  if (!String(inputs.interestRate ?? '').trim() || !String(inputs.loanTerm ?? '').trim() || years <= 0 || rate < 0) invalid.push('Enter a positive loan term and a non-negative interest rate.');
  if (inputs.lmiExempt && (!(exemptCap > 0) || exemptCap > 1)) invalid.push('Enter a waiver maximum LVR between 0% and 100%.');
  if (invalid.length) return { isComplete: false, tone: 'info' as AlertTone, deal: {text:'Add valid inputs',tone:'info' as AlertTone}, warnings:invalid, warningTone:'info' as AlertTone, outputs: {'Scenario status':'Enter valid values to calculate.'}, atAGlance:[], decisionGuide:[] };

  const equity = currentValue - currentMortgage, currentLvr = currentMortgage / currentValue;
  const mortgageAfterDraw = withdraw80 ? Math.max(currentMortgage, 0.8 * currentValue) : currentMortgage;
  const equityWithdrawn = mortgageAfterDraw - currentMortgage;
  const secondState: AustralianState = AUSTRALIAN_STATES.includes(inputs.state) ? inputs.state : 'VIC';
  const secondPurpose = inputs.secondPurpose === 'PPR' ? 'PPR' : 'Investment';
  const stamp = stampDuty(secondPrice, secondPurpose, secondState), transferFees = 2000;
  const totalAssets = currentValue + secondPrice, targetLoan = desiredLvr * totalAssets;
  const purchaseFundsNeeded = Math.max(0, secondPrice + stamp + transferFees - equityWithdrawn);
  const newLoanRequired = Math.min(Math.max(0, targetLoan - mortgageAfterDraw), purchaseFundsNeeded);
  const actualNewLoan = approvalMax > 0 ? Math.min(newLoanRequired, approvalMax) : newLoanRequired;
  const actualBaseLoan = mortgageAfterDraw + actualNewLoan;
  const lmiBaseLoan = crossCollat ? actualBaseLoan : actualNewLoan;
  const lmiBaseValue = crossCollat ? totalAssets : secondPrice;
  const lmi = lmiCost(lmiBaseValue, lmiBaseLoan, !!inputs.lmiExempt, exemptCap);
  const loanPlusLmi = actualBaseLoan + lmi, totalLvr = loanPlusLmi / totalAssets;
  const oop = Math.max(0, purchaseFundsNeeded - actualNewLoan);
  const extraCash = Math.max(0, newLoanRequired - actualNewLoan);
  const monthlyPiCurrent = periodicPayment(mortgageAfterDraw, rate, years, 'Monthly');
  const monthlyPiNew = periodicPayment(actualNewLoan + lmi, rate, years, 'Monthly');
  const totalMonthlyPi = monthlyPiCurrent + monthlyPiNew;
  const beforeCosts = currentRent + newRent - totalMonthlyPi;
  const afterCosts = beforeCosts - annualCosts / 12;
  const warnings = ['Indicative purchase duty assumes the selected use and standard eligibility; verify transaction details. Transfer fees assumed $2,000.', 'Both loans are modelled at the same rate and term. Actual facilities may differ.', 'LMI is an approximation; confirm lender quote, loan structure and waiver eligibility.', 'Tax effects are not calculated: deductibility depends on how borrowed funds are used.'];
  if (approvalMax <= 0) warnings.push('No new-loan approval limit was entered; borrowing capacity has not limited this estimate.');
  if (!String(inputs.currentRent ?? '').trim() || !String(inputs.newRent ?? '').trim()) warnings.push('Any blank rent field is treated as zero.');
  if (inputs.lmiExempt && lmiBaseValue > 0 && lmiBaseLoan / lmiBaseValue > exemptCap + 1e-10) warnings.push('The modelled LVR exceeds the waiver limit, so the waiver was not applied and LMI is estimated.');
  if (!costsEntered) warnings.push('Enter annual property costs to see cash flow after expenses; land tax, insurance, rates and other costs are not estimated automatically.');
  if (equityWithdrawn > secondPrice + stamp + transferFees) warnings.push('Equity release exceeds purchase costs; the excess remains borrowed and is not counted as a purchase expense.');
  if (withdraw80 && currentMortgage >= 0.8 * currentValue) warnings.push('No equity is released: the existing mortgage is already at or above 80% of the property value.');
  if (extraCash > 0) warnings.push('The new-loan approval limit reduces borrowing; extra cash is required.');
  if (currentMortgage > targetLoan) warnings.push('Existing debt already exceeds the target combined LVR; this model does not pay down the existing loan.');
  if (!crossCollat && actualNewLoan / secondPrice > 1) warnings.push('New loan exceeds the purchase price; confirm the lender can support this structure and security.');
  const tone: AlertTone = totalLvr > .9 || extraCash > 0 ? 'warn' : 'info';
  const dealText = 'Indicative purchase structure';
  return { isComplete:true, tone, deal:{text:dealText,tone}, warnings, warningTone:'info' as AlertTone,
    outputs: {
      'Current equity':formatSignedMoney(equity), 'Current LVR':formatPercent(currentLvr), 'Mortgage after equity release':formatMoney(mortgageAfterDraw), 'Equity released':formatMoney(equityWithdrawn),
      'New property state / territory':secondState, 'New property use':secondPurpose === 'PPR' ? 'Owner occupier' : 'Investment', 'Estimated purchase duty':formatMoney(stamp), 'Transfer fees assumption':formatMoney(transferFees),
      'Target combined loan':formatMoney(targetLoan), 'New loan needed at target':formatMoney(newLoanRequired), 'Actual new loan':formatMoney(actualNewLoan),
      'Extra cash due to approval limit':formatMoney(extraCash), 'Total out-of-pocket expenses':formatMoney(oop), 'Actual combined base loan':formatMoney(actualBaseLoan),
      'Estimated LMI':formatMoney(lmi), 'Actual combined loan including LMI':formatMoney(loanPlusLmi), 'Combined LVR including LMI':formatPercent(totalLvr),
      'Monthly P&I repayments':formatMoney(totalMonthlyPi), 'Monthly cash flow before property costs':formatSignedMoney(beforeCosts),
      'Annual property costs entered':costsEntered?formatMoney(annualCosts):'Not entered', 'Monthly cash flow after entered property costs':costsEntered?formatSignedMoney(afterCosts):'Enter property costs',
      'Tax impact':'Not calculated', 'Cross-collateralised LMI estimate':crossCollat?'Yes':'No',
    },
    atAGlance:[{label:'Cash required',value:formatMoney(oop),tone:'info' as AlertTone},{label:'Combined LVR incl. LMI',value:formatPercent(totalLvr),tone},{label:'Actual combined debt',value:formatMoney(loanPlusLmi),tone:'info' as AlertTone},{label:'Monthly P&I',value:formatMoney(totalMonthlyPi),tone:'info' as AlertTone},{label:'Monthly cash flow after costs',value:costsEntered?formatSignedMoney(afterCosts):'Enter property costs',tone:'info' as AlertTone},{label:'Equity released',value:formatMoney(equityWithdrawn),tone:'info' as AlertTone}],
    decisionGuide:[{label:'Approval gap',value:formatMoney(extraCash)},{label:'Target versus actual combined LVR',value:`${formatPercent(desiredLvr)} target / ${formatPercent(totalLvr)} including LMI`},{label:'Tax',value:'Not calculated; seek advice on loan purposes and deductible expenses.'},{label:'Income context',value:yearlyIncome>0?`Gross annual income entered: ${formatMoney(yearlyIncome)}`:'Income not entered; servicing has not been assessed.'}]
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
  const errors: string[] = [];
  if (currentValue <= 0 || currentLoan <= 0) errors.push('Enter the property value and current loan balance.');
  if (currentTerm <= 0 || newTerm <= 0 || !String(inputs.currentTerm ?? '').trim() || !String(inputs.newTerm ?? '').trim()) errors.push('Enter the remaining current term and new term.');
  if (!String(inputs.currentRate ?? '').trim() || !String(inputs.newRate ?? '').trim() || currentRate < 0 || newRate < 0) errors.push('Enter non-negative current and new rates.');
  if ([discharge,application,legal,valuation,gov,cashback,extraBorrow].some(x=>x<0)) errors.push('Fees, cashback and extra borrowing cannot be negative.');
  if (errors.length) return { isComplete:false, tone:'info' as AlertTone, deal:{text:'Add valid inputs',tone:'info' as AlertTone}, warnings:errors, warningTone:'info' as AlertTone, outputs:{'Scenario status':'Enter valid values to calculate.'}, atAGlance:[], decisionGuide:[] };
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
  const interestSaved = interestCurrent - interestNew - netCost - lmi;
  const periods1 = 1, periods3 = 3, periods5 = 5;
  const benefit1 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods1 * periodsPerYear(currentFreq)) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods1 * periodsPerYear(newFreq)) + netCost + lmi);
  const benefit3 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods3 * periodsPerYear(currentFreq)) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods3 * periodsPerYear(newFreq)) + netCost + lmi);
  const benefit5 = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods5 * periodsPerYear(currentFreq)) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods5 * periodsPerYear(newFreq)) + netCost + lmi);
  let warningTone: AlertTone = 'good';
  const warnings: string[] = [];
  if (newLvr > 0.95) { warnings.push('Refinance LVR is above 95%. This is a very high-leverage scenario.'); warningTone = 'bad'; }
  else if (newLvr > 0.9) { warnings.push('Refinance LVR is above 90%. Review LMI and serviceability carefully.'); warningTone = 'warn'; }
  if (extraBorrow === 0 && breakeven === 'No break-even') { warnings.push('The entered repayments provide no simple cash-flow payback under these assumptions.'); if (warningTone === 'good') warningTone = 'warn'; }
  else if (extraBorrow === 0 && breakeven === 'Immediate') warnings.push('Cashback covers the entered cash fees; estimated LMI may still be added to the loan.');
  if (extraBorrow === 0 && netCost > 0 && benefit1 < 0) { warnings.push('The first 12 months still look worse after costs, so this may be a medium-term play rather than an immediate win.'); if (warningTone === 'good') warningTone = 'warn'; }
  warnings.push('LMI is an indicative approximation; other fees are assumed paid upfront. Rates are assumed constant.');
  warnings.push('Repayment payback is a simple cash-flow measure and ignores differences in remaining balances; compare interest costs and loan terms too.');
  if (newTerm !== currentTerm) warnings.push('Loan terms differ. Lower repayments can coincide with a higher lifetime interest cost.');
  if (extraBorrow > 0) warnings.push('Comparative savings are not shown because the new loan includes extra borrowing.');
  const comparable = extraBorrow === 0;
  const tone: AlertTone = 'info';
  return {
    isComplete: true,
    tone,
    deal: { text: 'Indicative refinance comparison', tone },
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
      'Simple repayment payback': comparable ? breakeven : 'Not comparable with extra borrowing',
      'Calculated LMI cost': formatMoney(lmi),
      'Interest and upfront cost difference (1 year)': comparable ? formatSignedMoney(benefit1) : 'Not comparable',
      'Interest and upfront cost difference (3 years)': comparable ? formatSignedMoney(benefit3) : 'Not comparable',
      'Interest and upfront cost difference (5 years)': comparable ? formatSignedMoney(benefit5) : 'Not comparable',
      'Lifetime interest and upfront cost difference': comparable ? formatSignedMoney(interestSaved) : 'Not comparable',
    },
    atAGlance: [
      {label:'Current repayment',value:formatMoney(currentRepay) + ' / ' + paymentLabel(currentFreq),tone},
      {label:'New repayment',value:formatMoney(newRepay) + ' / ' + paymentLabel(newFreq),tone},
      {label:'Annual repayment difference',value:comparable?formatSignedMoney(annualDiff):'Not comparable',tone},
      {label:'Upfront cost after cashback',value:formatSignedMoney(netCost),tone},
      {label:'5-year interest and cost difference',value:comparable?formatSignedMoney(benefit5):'Not comparable',tone},
      {label:'Lifetime interest and cost difference',value:comparable?formatSignedMoney(interestSaved):'Not comparable',tone},
    ],
    decisionGuide: [
      {label:'Repayment payback (cash flow only)',value:comparable?breakeven:'Not comparable with extra borrowing'},
      {label:'Terms',value:`${currentTerm} years remaining / ${newTerm} years new`},
      {label:'New LVR including estimated LMI',value:formatPercent(newLvr)},
      {label:'New total loan',value:formatMoney(newLoanTotal)},
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
  const helpRepaymentsMonthly = parseNumber(inputs.helpRepaymentsMonthly ?? '');
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
  // Simplified allocation: all shaded additional income is allocated to applicant 1 for tax.
  const monthlyIncomeUsed = (annualNetIncomeForServicing(grossIncome1 + shadedRentAnnual + shadedOtherIncomeAnnual) + annualNetIncomeForServicing(grossIncome2)) / 12;
  const ccCommitment = creditCardLimits * (inputs.creditCardLoadingPct ? inputCardLoad : profile.creditCardLoadingPct);
  const monthlyCommitments = livingUsed + existingLoanRepaymentsMonthly + ccCommitment + otherDebtsMonthly + helpRepaymentsMonthly;
  const monthlySurplus = Math.max(0, (monthlyIncomeUsed - monthlyCommitments) * profile.surplusHaircut);
  const assessmentRateUsed = Math.max(actualRate + (inputs.assessmentBufferPct ? inputBuffer : profile.assessmentBufferPct), inputs.assessmentFloorRatePct ? inputFloor : profile.assessmentFloorRatePct);
  const monthlyAssessmentRate = assessmentRateUsed / 100 / 12;
  const borrowingCapacity = monthlySurplus > 0 && loanTerm > 0 ? (monthlyAssessmentRate > 0 ? monthlySurplus * (1 - Math.pow(1 + monthlyAssessmentRate, -(loanTerm * 12))) / monthlyAssessmentRate : monthlySurplus * loanTerm * 12) : 0;
  const depositRequired = targetLvr > 0 ? borrowingCapacity * (1 - targetLvr) / targetLvr : 0;
  const maxPurchasePrice = borrowingCapacity + depositRequired;
  const assessmentRepayment = periodicPayment(borrowingCapacity, assessmentRateUsed, loanTerm, 'Monthly');
  const surplusRatio = monthlyIncomeUsed > 0 ? monthlySurplus / monthlyIncomeUsed : 0;
  const warnings: string[] = ['Illustrative model, not a lender calculator or loan approval. Expense benchmarks and lender profiles are assumptions, not actual lender policy.', 'Uses simplified 2026–27 resident income tax and 2% Medicare levy; offsets, thresholds and individual circumstances are not modelled. All additional income is allocated to applicant 1 for this approximation.', 'Enter HELP repayments and other debts. Existing loans should be entered at the lender-assessed repayment. Purchase price assumes sufficient deposit and excludes duty and purchase costs.'];
  let warningTone: AlertTone = 'info';
  if (grossIncome1 <= 0 || !String(inputs.loanTerm ?? '').trim() || !String(inputs.actualRate ?? '').trim() || !String(inputs.targetLvr ?? '').trim() || loanTerm <= 0 || actualRate <= 0 || targetLvr <= 0 || targetLvr > 1 || [grossIncome2,rentalIncomeMonthly,otherIncomeAnnual,livingExpensesMonthly,existingLoanRepaymentsMonthly,creditCardLimits,otherDebtsMonthly,helpRepaymentsMonthly,inputBuffer,inputFloor].some(x=>x<0) || inputRentalShade > 1 || inputOtherShade > 1 || inputRentalShade < 0 || inputOtherShade < 0 || inputCardLoad < 0 || inputCardLoad > 1) {
    return {isComplete:false, tone:'info' as AlertTone, deal:{text:'Add valid inputs',tone:'info' as AlertTone}, warnings:['Enter income for applicant 1, a positive interest rate and loan term, a target LVR from 0 to 100%, and valid non-negative amounts and percentages.'], warningTone:'info' as AlertTone, outputs:{'Scenario status':'Enter valid values to calculate.'}, borrowingSummary:[], decisionGuide:[]};
  }
  if (monthlySurplus <= 0) { warnings.push('Monthly surplus is nil or negative after the benchmark expenses and debt commitments, so borrowing capacity is effectively exhausted.'); warningTone = 'bad'; }
  else if (surplusRatio < 0.15) { warnings.push('Serviceability looks tight because only a small share of assessed income remains after benchmark commitments.'); warningTone = 'warn'; }
  if (!warnings.length) warnings.push('Bank-style borrowing estimate is positive on the current assumptions.');
  const tone: AlertTone = monthlySurplus <= 0 ? 'warn' : 'info';
  return {
    isComplete:true,
    tone,
    deal: { text: 'Illustrative borrowing estimate', tone },
    warnings,
    warningTone,
    outputs: {
      'Illustrative expense benchmark (not lender HEM)': formatMoney(hemFloor),
      'Living expense used': formatMoney(livingUsed),
      'Salary after simplified tax (annual)': formatMoney(salaryIncomeAnnual),
      'Shaded rent': formatMoney(shadedRentAnnual),
      'Other income used': formatMoney(shadedOtherIncomeAnnual),
      'Monthly income used': formatMoney(monthlyIncomeUsed),
      'Credit card commitment': formatMoney(ccCommitment),
      'Monthly commitments': formatMoney(monthlyCommitments),
      'Monthly surplus': formatMoney(monthlySurplus),
      'Assessment rate used': `${assessmentRateUsed.toFixed(2)}%`,
      'Borrowing capacity': formatMoney(borrowingCapacity),
      'Illustrative price at target LVR (excludes costs)': formatMoney(maxPurchasePrice),
      'Assessment repayment': formatMoney(assessmentRepayment),
      'Deposit required': formatMoney(depositRequired),
      'Service ratio': formatPercent(surplusRatio),
    },
    borrowingSummary: [
      { label: 'Total borrowing capacity', value: formatMoney(borrowingCapacity), tone },
      { label: 'Indicative price before costs', value: formatMoney(maxPurchasePrice), tone: 'info' as AlertTone },
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


