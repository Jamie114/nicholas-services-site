export type Frequency = 'Monthly' | 'Fortnightly' | 'Weekly';
export type PurchaseType = 'PPR' | 'FHOG' | 'Investment';
export type ApplicantType = 'Single' | 'Couple';
export type LoanPurpose = 'Owner Occupier' | 'Investment';
export type LenderProfile = 'NAB-style' | 'Conservative' | 'Aggressive';

export const FREQUENCIES: Record<Frequency, number> = {
  Monthly: 12,
  Fortnightly: 26,
  Weekly: 52,
};

export const DEFAULTS = {
  meta: {
    brandName: 'XYZ Finance Specialists',
    brokerName: 'Jamie',
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
    fhogPriceLimit: 0,
    fullSdExemptUpto: 0,
    sdConcessionLimit: 0,
    maxFhogLvr: 0,
    applyFhog: false,
    applySdConcession: false,
  },
  FHOG: {
    fhogPriceLimit: 950000,
    fullSdExemptUpto: 600000,
    sdConcessionLimit: 750000,
    maxFhogLvr: 0.95,
    applyFhog: true,
    applySdConcession: true,
  },
  Investment: {
    fhogPriceLimit: 0,
    fullSdExemptUpto: 0,
    sdConcessionLimit: 0,
    maxFhogLvr: 0,
    applyFhog: false,
    applySdConcession: false,
  },
};

export const parseNumber = (value: string | number, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, ''));
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

export const paymentLabel = (frequency: Frequency): string => {
  switch (frequency) {
    case 'Weekly':
      return 'week';
    case 'Fortnightly':
      return 'fortnight';
    default:
      return 'month';
  }
};

const pickBandRate = <T extends Array<number>>(value: number, bands: T[]): T => {
  let chosen = bands[0];
  for (const band of bands) {
    if (value >= band[0]) chosen = band;
    else break;
  }
  return chosen;
};

export const periodicPayment = (
  principal: number,
  annualRatePercent: number,
  years: number,
  frequency: Frequency,
): number => {
  const periods = periodsPerYear(frequency);
  const totalPeriods = Math.max(0, years) * periods;
  const ratePerPeriod = annualRatePercent / 100 / periods;
  if (principal <= 0 || totalPeriods <= 0) return 0;
  if (ratePerPeriod === 0) return principal / totalPeriods;
  const factor = Math.pow(1 + ratePerPeriod, totalPeriods);
  return (principal * ratePerPeriod * factor) / (factor - 1);
};

export const interestComponent = (principal: number, annualRatePercent: number, frequency: Frequency): number =>
  principal * (annualRatePercent / 100) / periodsPerYear(frequency);

export const totalInterest = (
  principal: number,
  annualRatePercent: number,
  years: number,
  frequency: Frequency,
): number => {
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

export const getBankStyleHemMonthly = (
  applicantType: ApplicantType,
  dependants: number,
  loanPurpose: LoanPurpose,
): number => {
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
      return {
        hemMultiplier: 1.06,
        rentalShadingPct: 0.75,
        otherIncomeShadingPct: 0.7,
        creditCardLoadingPct: 0.038,
        assessmentBufferPct: 3.0,
        assessmentFloorRatePct: 8.8,
        surplusHaircut: 0.88,
      };
    case 'Aggressive':
      return {
        hemMultiplier: 0.98,
        rentalShadingPct: 0.8,
        otherIncomeShadingPct: 0.8,
        creditCardLoadingPct: 0.025,
        assessmentBufferPct: 3.0,
        assessmentFloorRatePct: 8.2,
        surplusHaircut: 0.95,
      };
    default:
      return {
        hemMultiplier: 1.0,
        rentalShadingPct: 0.75,
        otherIncomeShadingPct: 0.7,
        creditCardLoadingPct: 0.03,
        assessmentBufferPct: 3.0,
        assessmentFloorRatePct: 8.5,
        surplusHaircut: 0.92,
      };
  }
};
