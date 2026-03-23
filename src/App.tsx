import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  DEFAULTS,
  type ApplicantType,
  annualLandTax,
  annualTax,
  annualNetIncomeForServicing,
  amortizationInterestOverPeriod,
  formatMoney,
  formatPercent,
  fhogStatus,
  FREQUENCIES,
  getBankStyleHemMonthly,
  getLenderProfileSettings,
  interestComponent,
  lmiCost,
  parseNumber,
  paymentLabel,
  periodicPayment,
  stampDuty,
  totalInterest,
  type Frequency,
  type LenderProfile,
  type LoanPurpose,
  type PurchaseType,
} from './calculations';

type TabKey = 'home' | 'one' | 'two' | 'refi' | 'borrow' | 'compare' | 'settings';
type ComparePayload = Record<string, string>;
type CompareSlot = { source: string; note: string; warning: string; payload: ComparePayload } | null;

type BannerTone = 'good' | 'warn' | 'bad' | 'info';

const STORAGE_KEY = 'loan-web-v32-settings';

function StatCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: 'text' | 'number';
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder="" onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}


function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Banner({ tone, text }: { tone: BannerTone; text: string }) {
  return <div className={`banner ${tone}`}>{text}</div>;
}

function saveJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


function loadJsonFile(onLoad: (payload: any) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '{}'));
        onLoad(parsed);
      } catch {
        window.alert('That JSON file could not be read.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function escapePdfText(value: string) {
  return String(value ?? '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2013|\u2014/g, '-');
}

function exportStyledPdfReport({
  brandName,
  brokerName,
  reportTitle,
  reportSubtitle,
  summaryCards,
  sections,
}: {
  brandName: string;
  brokerName: string;
  reportTitle: string;
  reportSubtitle: string;
  summaryCards: Array<{ label: string; value: string }>;
  sections: Array<{ heading: string; rows: Array<[string, string]> }>;
}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  let y = 36;

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, 28, pageWidth - margin * 2, 96, 18, 18, 'F');

    doc.setFillColor(29, 78, 216);
    doc.circle(margin + 28, 76, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('L', margin + 23, 81);

    doc.setFontSize(24);
    doc.text(escapePdfText(brandName || 'XYZ Finance Specialists'), margin + 58, 66);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(226, 232, 240);
    doc.text(escapePdfText(reportTitle), margin + 58, 86);
    doc.text(escapePdfText(reportSubtitle), margin + 58, 101);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - margin - 168, 44, 126, 40, 12, 12, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Broker', pageWidth - margin - 154, 61);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const broker = escapePdfText(brokerName || 'Not specified');
    doc.text(broker.slice(0, 24), pageWidth - margin - 154, 76);

    y = 144;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 56) return;
    doc.addPage();
    drawHeader();
  };

  const drawSummaryCards = () => {
    if (!summaryCards.length) return;
    const cards = summaryCards.slice(0, 4);
    const gap = 12;
    const width = (pageWidth - margin * 2 - gap) / 2;
    const height = 62;
    cards.forEach((card, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + col * (width + gap);
      const yy = y + row * (height + 10);
      doc.setFillColor(248, 251, 255);
      doc.setDrawColor(219, 228, 240);
      doc.roundedRect(x, yy, width, height, 14, 14, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(escapePdfText(card.label.toUpperCase()), x + 14, yy + 18);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      const lines = doc.splitTextToSize(escapePdfText(card.value), width - 28);
      doc.text(lines.slice(0,2), x + 14, yy + 40);
    });
    y += cards.length > 2 ? 144 : 72;
  };

  const drawSection = (heading: string, rows: Array<[string, string]>) => {
    ensureSpace(48);
    doc.setFillColor(232, 240, 255);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 10, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 71, 184);
    doc.setFontSize(12);
    doc.text(escapePdfText(heading), margin + 12, y + 18);
    y += 38;

    const keyWidth = 180;
    const tableWidth = pageWidth - margin * 2;
    rows.forEach(([rawKey, rawValue]) => {
      const key = escapePdfText(rawKey || '-');
      const value = escapePdfText(rawValue || '-');
      const valueLines = doc.splitTextToSize(value, tableWidth - keyWidth - 28);
      const rowHeight = Math.max(24, valueLines.length * 12 + 12);
      ensureSpace(rowHeight + 4);
      doc.setDrawColor(219, 228, 240);
      doc.setFillColor(248, 251, 255);
      doc.rect(margin, y, keyWidth, rowHeight, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(margin + keyWidth, y, tableWidth - keyWidth, rowHeight, 'FD');
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(key, margin + 10, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(valueLines, margin + keyWidth + 10, y + 15);
      y += rowHeight;
    });
    y += 12;
  };

  drawHeader();
  drawSummaryCards();
  sections.forEach((section) => drawSection(section.heading, section.rows));

  ensureSpace(72);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 52, 12, 12, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Disclaimer', margin + 12, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const disclaimer = doc.splitTextToSize('This report is an indicative calculator output only. It is not credit advice, tax advice, or a credit approval. Please verify all figures, lender policies, rates, fees, and government charges before relying on it.', pageWidth - margin * 2 - 24);
  doc.text(disclaimer, margin + 12, y + 31);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin - 44, pageHeight - 18);
  }

  const safeTitle = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  doc.save(`${safeTitle || 'mortgage-report'}.pdf`);
}

function App() {
  const [tab, setTab] = useState<TabKey>('home');

  const [meta, setMeta] = useState({ ...DEFAULTS.meta });
  const [oneProperty, setOneProperty] = useState({ ...DEFAULTS.oneProperty });
  const [twoProperties, setTwoProperties] = useState({ ...DEFAULTS.twoProperties });
  const [refinance, setRefinance] = useState({ ...DEFAULTS.refinance });
  const [borrowing, setBorrowing] = useState({ ...DEFAULTS.borrowing });
  const [compare, setCompare] = useState<Record<'A' | 'B' | 'C', CompareSlot>>({ A: null, B: null, C: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        setMeta({ ...DEFAULTS.meta, ...(saved.meta ?? {}) });
        setOneProperty({ ...DEFAULTS.oneProperty, ...(saved.oneProperty ?? {}) });
        setTwoProperties({ ...DEFAULTS.twoProperties, ...(saved.twoProperties ?? {}) });
        setRefinance({ ...DEFAULTS.refinance, ...(saved.refinance ?? {}) });
        setBorrowing({ ...DEFAULTS.borrowing, ...(saved.borrowing ?? {}) });
        setCompare(saved.compare ?? { A: null, B: null, C: null });
      }
    } catch {
      // ignore bad local data
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const payload = { meta, oneProperty, twoProperties, refinance, borrowing, compare };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [loaded, meta, oneProperty, twoProperties, refinance, borrowing, compare]);

  const oneCalc = useMemo(() => {
    const purchaseType = (oneProperty.purchaseType || 'PPR') as PurchaseType;
    const rate = parseNumber(oneProperty.interestRate);
    const years = parseNumber(oneProperty.loanTerm, 30);
    const inputPrice = parseNumber(oneProperty.housePrice);
    const requestedLvr = parseNumber(oneProperty.desiredLvr) / 100;
    const approvalMax = parseNumber(oneProperty.loanApprovalMax);
    const maxCashContribution = parseNumber(oneProperty.maxCashContribution);
    const maxPurchaseMode = oneProperty.maxPurchaseMode;
    const useGuarantor = purchaseType === 'FHOG' ? false : oneProperty.useGuarantor;
    const enableOopLimit = oneProperty.enableOopLimit;
    const lmiExempt = purchaseType === 'FHOG' || useGuarantor ? false : oneProperty.lmiExempt;
    const exemptCap = parseNumber(oneProperty.exemptCap, 90) / 100;
    const frequency = (oneProperty.repaymentFrequency || 'Monthly') as Frequency;
    const extraPrincipal = parseNumber(oneProperty.extraPrincipal);
    const yearlyIncome = parseNumber(oneProperty.yearlyIncome);
    const livingExpensesMonthly = parseNumber(oneProperty.livingExpensesMonthly);

    const transferFees = 2000;
    const maxBaseLvr = useGuarantor ? 1.05 : 0.95;
    const appliedLvr = Math.min(requestedLvr, maxBaseLvr);
    const lvrCapped = requestedLvr > maxBaseLvr;

    const evaluatePrice = (candidatePrice: number) => {
      const price = Math.max(0, candidatePrice);
      const requiredLoan = price * appliedLvr;
      const finalLoan = approvalMax > 0 ? Math.min(requiredLoan, approvalMax) : requiredLoan;
      const extraCash = approvalMax > 0 ? Math.max(0, requiredLoan - approvalMax) : 0;
      const sd = stampDuty(price, purchaseType);
      const baseLvr = price > 0 ? finalLoan / price : 0;
      const fhogLmiWaived =
        purchaseType === 'FHOG' && price <= 950000 && baseLvr <= 0.95;
      const lmi = useGuarantor ? 0 : fhogLmiWaived ? 0 : lmiCost(price, finalLoan, lmiExempt, exemptCap);
      const loanPlusLmi = finalLoan + lmi;
      const effectiveLvr = price > 0 ? loanPlusLmi / price : 0;
      const repayment = periodicPayment(loanPlusLmi, rate, years, frequency);
      const yearlyRepayments = repayment * FREQUENCIES[frequency] + extraPrincipal;
      const oop = Math.max(0, price - finalLoan + sd + transferFees);
      const monthlyDisposable = yearlyIncome > 0 ? yearlyIncome / 12 - livingExpensesMonthly - (repayment * FREQUENCIES[frequency]) / 12 : 0;
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
        yearlyRepayments,
        oop,
        monthlyDisposable,
      };
    };

    let modeNote = 'Using entered purchase price.';
    let price = inputPrice;

    if (maxPurchaseMode && appliedLvr > 0) {
      if (maxCashContribution > 0) {
        let high = approvalMax > 0 ? approvalMax / Math.max(appliedLvr, 1e-9) + maxCashContribution + transferFees + 250000 : maxCashContribution / Math.max(1 - appliedLvr, 0.05) + transferFees + 250000;
        if (purchaseType === 'FHOG') high = Math.min(high, 950000 * 1.1);
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
        price = Math.round(best);
        modeNote = `Maximum purchase price solved using cash cap of ${formatMoney(maxCashContribution)}.`;
      } else if (approvalMax > 0) {
        price = Math.round(approvalMax / Math.max(appliedLvr, 1e-9));
        modeNote = 'Maximum purchase price solved using the loan approval limit only.';
      } else {
        modeNote = 'Maximum purchase mode is on, but it needs a cash cap and/or approval limit.';
      }
    }

    let result = evaluatePrice(price);
    let oopLimitStatus = 'No limit applied';

    if (enableOopLimit && maxCashContribution > 0 && result.oop > maxCashContribution && !maxPurchaseMode && appliedLvr > 0) {
      const originalPrice = price;
      let low = 0;
      let high = price;
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
      oopLimitStatus = `Capped house price from ${formatMoney(originalPrice)} to ${formatMoney(price)} to fit within ${formatMoney(maxCashContribution)}.`;
    } else if (enableOopLimit && maxCashContribution > 0) {
      oopLimitStatus = `Within limit of ${formatMoney(maxCashContribution)}.`;
    }

    const fhog = fhogStatus(price, result.baseLvr, purchaseType);
    const serviceRatio = yearlyIncome > 0 ? (result.repayment * FREQUENCIES[frequency]) / yearlyIncome : 0;
    const warnings: string[] = [];
    let tone: BannerTone = 'good';
    if (lvrCapped) {
      warnings.push('Requested LVR was capped to the allowed base LVR for this scenario.');
      tone = 'warn';
    }
    if (result.extraCash > 0) {
      warnings.push('Approval limit is below the loan required for the requested LVR, so extra cash is needed.');
      tone = 'warn';
    }
    if (result.effectiveLvr > 0.95) {
      warnings.push('Effective LVR is above 95%, which is a very stretched scenario.');
      tone = 'bad';
    } else if (result.effectiveLvr > 0.9) {
      warnings.push('Effective LVR is above 90%, so buffers and valuation risk should be reviewed carefully.');
      tone = 'warn';
    }
    if (serviceRatio > 0.35) {
      warnings.push('Repayments exceed roughly 35% of entered gross annual income.');
      if (tone === 'good') tone = 'warn';
    }
    if (!warnings.length) warnings.push('Scenario looks internally consistent on the current assumptions.');

    return {
      warning: warnings.join(' '),
      tone,
      modeNote,
      oopLimitStatus,
      summary: {
        deposit: result.oop,
        lvr: result.effectiveLvr,
        loan: result.loanPlusLmi,
        repay: result.repayment,
      },
      payload: {
        'Scenario': oneProperty.scenarioName,
        'Purchase type': purchaseType,
        'House price': formatMoney(price),
        'Required loan': formatMoney(result.requiredLoan),
        'Final loan': formatMoney(result.finalLoan),
        'Stamp duty': formatMoney(result.stampDuty),
        'LMI': formatMoney(result.lmi),
        'Loan + LMI': formatMoney(result.loanPlusLmi),
        'Base LVR': formatPercent(result.baseLvr),
        'Effective LVR': formatPercent(result.effectiveLvr),
        'Repayment': `${formatMoney(result.repayment)} per ${paymentLabel(frequency)}`,
        'Yearly repayments': formatMoney(result.yearlyRepayments),
        'Out of pocket': formatMoney(result.oop),
        'FHOG status': fhog,
        'Mode note': modeNote,
        'OOP status': oopLimitStatus,
      },
      fhog,
      result,
      price,
    };
  }, [oneProperty]);

  const twoCalc = useMemo(() => {
    const rate = parseNumber(twoProperties.interestRate);
    const years = parseNumber(twoProperties.loanTerm, 30);
    const currMortgage = parseNumber(twoProperties.currentMortgage);
    const currValue = parseNumber(twoProperties.currentValue);
    const secondPrice = parseNumber(twoProperties.secondPrice);
    const crossCollat = twoProperties.crossCollat;
    const desiredLvr = parseNumber(twoProperties.desiredLvr) / 100;
    const withdraw80 = twoProperties.withdraw80;
    const currentRent = parseNumber(twoProperties.currentRent);
    const newRent = parseNumber(twoProperties.newRent);
    const approvalMax = parseNumber(twoProperties.approvalMax);
    const lmiExempt = twoProperties.lmiExempt;
    const exemptCap = parseNumber(twoProperties.exemptCap, 90) / 100;
    const yearlyIncome = parseNumber(twoProperties.yearlyIncome);

    if (desiredLvr >= 1) {
      return {
        warning: 'Desired consolidated LVR is 100% or more. Reduce it below 100%.',
        tone: 'bad' as BannerTone,
        summary: { deposit: 0, lvr: desiredLvr, loan: 0, repay: 0 },
        payload: { Error: 'Invalid LVR' } as ComparePayload,
      };
    }

    const equity = currValue - currMortgage;
    const currentLvr = currValue > 0 ? currMortgage / currValue : 0;
    const mortgageAfterDraw = withdraw80 ? 0.8 * currValue : currMortgage;
    const equityWithdrawn = withdraw80 ? mortgageAfterDraw - currMortgage : 0;

    const stamp = stampDuty(secondPrice, 'Investment');
    const transferFees = 2000;
    const totalAssets = currValue + secondPrice;
    const totalConsolidatedLoan = desiredLvr * totalAssets;
    const newLoanRequired = Math.max(0, totalConsolidatedLoan - mortgageAfterDraw);
    const actualNewLoan = approvalMax > 0 ? Math.min(newLoanRequired, approvalMax) : newLoanRequired;
    const newAssetLvr = secondPrice > 0 ? actualNewLoan / secondPrice : 0;

    const lmiBaseLoan = crossCollat ? totalConsolidatedLoan : actualNewLoan;
    const lmiBaseValue = crossCollat ? totalAssets : secondPrice;
    const lmi = lmiCost(lmiBaseValue, lmiBaseLoan, lmiExempt, exemptCap);
    const loanPlusLmi = totalConsolidatedLoan + lmi;
    const oop = Math.max(0, secondPrice + stamp + transferFees - (actualNewLoan + Math.max(0, equityWithdrawn)));
    const extraCash = Math.max(0, newLoanRequired - approvalMax);

    const monthlyPiCurrent = periodicPayment(mortgageAfterDraw, rate, years, 'Monthly');
    const monthlyPiNew = periodicPayment(actualNewLoan + lmi, rate, years, 'Monthly');
    const totalMonthlyPi = monthlyPiCurrent + monthlyPiNew;
    const monthlyOffset = totalMonthlyPi - (currentRent + newRent);

    const yearlyRates =
      272 +
      210 +
      190 +
      416 +
      (currValue - 100000) * 0.000173 +
      (secondPrice - 100000) * 0.000173 +
      ((currValue - 100000) * 0.05) * 0.05 +
      ((secondPrice - 100000) * 0.05) * 0.05;
    const yearlyPm = (currentRent + newRent) * 0.055 * 12;
    const yearlyLandTax = annualLandTax(currValue + secondPrice);
    const yearlyInsurance = 1500;
    const waterService = (21.26 + 122.58 + 31.51 + 22.63) * 2 * 4;
    const yearlyOutgoings = yearlyRates + yearlyPm + yearlyLandTax + yearlyInsurance + waterService;
    const monthlyOutgoings = yearlyOutgoings / 12;
    const monthlyWithOutgoings = monthlyOffset + monthlyOutgoings;

    const totalYearlyExpenses = currentRent * 12 + newRent * 12 - (totalMonthlyPi * 12 + yearlyOutgoings);
    const negGearing =
      currentRent * 12 +
      newRent * 12 -
      ((interestComponent(mortgageAfterDraw, rate, 'Monthly') + interestComponent(actualNewLoan + lmi, rate, 'Monthly')) * 12 + yearlyOutgoings);

    const taxPayableBase = annualTax(yearlyIncome) + yearlyIncome * 0.02;
    const incomeWithNeg = yearlyIncome + negGearing;
    const taxPayableNeg = annualTax(incomeWithNeg) + incomeWithNeg * 0.02;
    const taxBack = taxPayableBase - taxPayableNeg;

    const totalLvr = totalAssets > 0 ? loanPlusLmi / totalAssets : 0;
    const serviceRatio = yearlyIncome > 0 ? totalMonthlyPi / (yearlyIncome / 12) : 0;

    const warnings: string[] = [];
    let tone: BannerTone = 'good';
    if (desiredLvr > 0.95) {
      warnings.push('Desired consolidated LVR is above 95%. This is a high-leverage scenario.');
      tone = 'bad';
    } else if (desiredLvr > 0.9) {
      warnings.push('Desired consolidated LVR is above 90%. Review buffers, valuation risk, and LMI impacts carefully.');
      tone = 'warn';
    }
    if (extraCash > 0) {
      warnings.push('Approval limit is below the loan required for the requested scenario, so extra cash is needed.');
      if (tone === 'good') tone = 'warn';
    }
    if (serviceRatio > 0.35) {
      warnings.push('Estimated total monthly repayments are above 35% of the entered annual income.');
      if (tone === 'good') tone = 'warn';
    }
    if (monthlyWithOutgoings > 0) {
      warnings.push('After rent and estimated outgoings, this scenario is still cash-flow negative each month.');
      if (tone === 'good') tone = 'warn';
    }
    if (!warnings.length) warnings.push('Scenario looks internally consistent using the current assumptions.');

    return {
      warning: warnings.join(' '),
      tone,
      summary: { deposit: oop, lvr: totalLvr, loan: loanPlusLmi, repay: totalMonthlyPi },
      payload: {
        'Scenario': twoProperties.scenarioName,
        'Equity': formatMoney(equity),
        'Current LVR': formatPercent(currentLvr),
        'Mortgage after draw': formatMoney(mortgageAfterDraw),
        'Equity withdrawn': formatMoney(equityWithdrawn),
        'New loan required': formatMoney(newLoanRequired),
        'Actual new loan': formatMoney(actualNewLoan),
        'New asset LVR': formatPercent(newAssetLvr),
        'Total assets': formatMoney(totalAssets),
        'Total consolidated loan': formatMoney(totalConsolidatedLoan),
        'LMI': formatMoney(lmi),
        'Loan plus LMI': formatMoney(loanPlusLmi),
        'Extra cash': formatMoney(extraCash),
        'Out of pocket': formatMoney(oop),
        'Monthly PI total': formatMoney(totalMonthlyPi),
        'Monthly offset after rent': formatMoney(monthlyOffset),
        'Monthly after outgoings': formatMoney(monthlyWithOutgoings),
        'Yearly outgoings': formatMoney(yearlyOutgoings),
        'Negative gearing': formatMoney(negGearing),
        'Tax back yearly': formatMoney(taxBack),
      },
      details: {
        equity,
        currentLvr,
        mortgageAfterDraw,
        equityWithdrawn,
        newLoanRequired,
        actualNewLoan,
        newAssetLvr,
        totalAssets,
        totalConsolidatedLoan,
        lmi,
        loanPlusLmi,
        extraCash,
        oop,
        totalMonthlyPi,
        monthlyOffset,
        monthlyWithOutgoings,
        totalYearlyExpenses,
        negGearing,
        taxBack,
      },
    };
  }, [twoProperties]);

  const refiCalc = useMemo(() => {
    const currentValue = parseNumber(refinance.currentValue);
    const currentLoan = parseNumber(refinance.currentLoan);
    const currentRate = parseNumber(refinance.currentRate);
    const currentTerm = parseNumber(refinance.currentTerm, 26);
    const currentFreq = (refinance.currentFreq || 'Monthly') as Frequency;
    const newRate = parseNumber(refinance.newRate);
    const newTerm = parseNumber(refinance.newTerm, 26);
    const newFreq = (refinance.newFreq || 'Monthly') as Frequency;
    const discharge = parseNumber(refinance.dischargeFee);
    const application = parseNumber(refinance.applicationFee);
    const legal = parseNumber(refinance.legalFee);
    const valuation = parseNumber(refinance.valuationFee);
    const gov = parseNumber(refinance.govFee);
    const cashback = parseNumber(refinance.cashback);
    const extraBorrow = parseNumber(refinance.extraBorrow);
    const lmiExempt = refinance.lmiExempt;

    if (currentValue > 0 && (currentLoan + extraBorrow) / currentValue >= 1) {
      return {
        warning: 'New refinance LVR is 100% or more before LMI. Reduce borrowing below 100%.',
        tone: 'bad' as BannerTone,
        summary: { deposit: 0, lvr: 1, loan: 0, repay: 0 },
        payload: { Error: 'Invalid LVR' } as ComparePayload,
      };
    }

    const currentEquity = currentValue - currentLoan;
    const currentLvr = currentValue > 0 ? currentLoan / currentValue : 0;
    const baseNewLoan = currentLoan + extraBorrow;
    const lmi = lmiExempt ? 0 : lmiCost(currentValue, baseNewLoan, false, 0.9);
    const newLoanTotal = baseNewLoan + lmi;
    const newLvr = currentValue > 0 ? newLoanTotal / currentValue : 0;

    const currentRepay = periodicPayment(currentLoan, currentRate, currentTerm, currentFreq);
    const newRepay = periodicPayment(newLoanTotal, newRate, newTerm, newFreq);
    const periodDiff = currentFreq === newFreq ? currentRepay - newRepay : null;
    const annualDiff = currentRepay * FREQUENCIES[currentFreq] - newRepay * FREQUENCIES[newFreq];

    const refiCosts = discharge + application + legal + valuation + gov;
    const netCost = refiCosts - cashback;
    const breakeven = netCost <= 0 ? 'Immediate' : annualDiff <= 0 ? 'No break-even' : `${((netCost / annualDiff) * 12).toFixed(1)} months`;

    const interestCurrent = totalInterest(currentLoan, currentRate, currentTerm, currentFreq);
    const interestNew = totalInterest(newLoanTotal, newRate, newTerm, newFreq);
    const interestSaved = interestCurrent - interestNew - netCost;

    const periods1y = Math.min(FREQUENCIES[currentFreq], currentTerm * FREQUENCIES[currentFreq], newTerm * FREQUENCIES[newFreq]);
    const periods3y = Math.min(FREQUENCIES[currentFreq] * 3, currentTerm * FREQUENCIES[currentFreq], newTerm * FREQUENCIES[newFreq]);
    const periods5y = Math.min(FREQUENCIES[currentFreq] * 5, currentTerm * FREQUENCIES[currentFreq], newTerm * FREQUENCIES[newFreq]);

    const benefit1y = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods1y) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods1y) + Math.max(0, netCost));
    const benefit3y = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods3y) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods3y) + Math.max(0, netCost));
    const benefit5y = amortizationInterestOverPeriod(currentLoan, currentRate, currentTerm, currentFreq, periods5y) - (amortizationInterestOverPeriod(newLoanTotal, newRate, newTerm, newFreq, periods5y) + Math.max(0, netCost));

    const warnings: string[] = [];
    let tone: BannerTone = 'good';
    if (newLvr > 0.95) {
      warnings.push('Refinance LVR is above 95%. This is a very high-leverage scenario.');
      tone = 'bad';
    } else if (newLvr > 0.9) {
      warnings.push('Refinance LVR is above 90%. Review LMI and serviceability carefully.');
      tone = 'warn';
    }
    if (breakeven === 'No break-even') {
      warnings.push('On these assumptions, the refinance does not break even.');
      if (tone === 'good') tone = 'warn';
    } else if (breakeven === 'Immediate') {
      warnings.push('Cashback offsets the upfront refinance costs immediately.');
    }
    if (interestSaved > 0) {
      warnings.push('Refinance appears beneficial on the current assumptions.');
    } else {
      warnings.push('Refinance does not currently show a positive lifetime saving on these assumptions.');
      if (tone === 'good') tone = 'warn';
    }

    return {
      warning: warnings.join(' '),
      tone,
      summary: { deposit: netCost, lvr: newLvr, loan: newLoanTotal, repay: newRepay },
      payload: {
        'Scenario': refinance.scenarioName,
        'Current equity': formatMoney(currentEquity),
        'Current LVR': formatPercent(currentLvr),
        'New LVR': formatPercent(newLvr),
        'Current repayment': `${formatMoney(currentRepay)} per ${paymentLabel(currentFreq)}`,
        'New repayment': `${formatMoney(newRepay)} per ${paymentLabel(newFreq)}`,
        'Period difference': periodDiff === null ? 'Different frequencies' : formatMoney(periodDiff),
        'Annual difference': formatMoney(annualDiff),
        'Refi costs': formatMoney(refiCosts),
        'Net cost': formatMoney(netCost),
        'Break-even': breakeven,
        'LMI': formatMoney(lmi),
        '1 year benefit': formatMoney(benefit1y),
        '3 year benefit': formatMoney(benefit3y),
        '5 year benefit': formatMoney(benefit5y),
        'Lifetime interest current': formatMoney(interestCurrent),
        'Lifetime interest new': formatMoney(interestNew),
        'Lifetime interest saved': formatMoney(interestSaved),
      },
      details: { currentEquity, currentLvr, newLvr, currentRepay, newRepay, periodDiff, annualDiff, refiCosts, netCost, breakeven, lmi, benefit1y, benefit3y, benefit5y, interestCurrent, interestNew, interestSaved },
    };
  }, [refinance]);

  const borrowCalc = useMemo(() => {
    const lenderProfile = (borrowing.lenderProfile || 'NAB-style') as LenderProfile;
    const applicantType = (borrowing.applicantType || 'Single') as ApplicantType;
    const dependants = parseNumber(borrowing.dependants);
    const loanPurpose = (borrowing.loanPurpose || 'Owner Occupier') as LoanPurpose;
    const grossIncome1 = parseNumber(borrowing.grossIncome1);
    const grossIncome2 = parseNumber(borrowing.grossIncome2);
    const rentalIncomeMonthly = parseNumber(borrowing.rentalIncomeMonthly);
    const otherIncomeAnnual = parseNumber(borrowing.otherIncomeAnnual);
    const livingExpensesMonthly = parseNumber(borrowing.livingExpensesMonthly);
    const existingLoanRepaymentsMonthly = parseNumber(borrowing.existingLoanRepaymentsMonthly);
    const otherDebtsMonthly = parseNumber(borrowing.otherDebtsMonthly);
    const creditCardLimits = parseNumber(borrowing.creditCardLimits);
    const actualRate = parseNumber(borrowing.actualRate);
    const loanTerm = parseNumber(borrowing.loanTerm, 30);
    const targetLvr = parseNumber(borrowing.targetLvr) / 100;

    const profileCfg = getLenderProfileSettings(lenderProfile);
    const hemFloor = getBankStyleHemMonthly(applicantType, dependants, loanPurpose) * profileCfg.hemMultiplier;
    const livingUsed = Math.max(livingExpensesMonthly, hemFloor);

    const salaryIncomeUsedAnnual = annualNetIncomeForServicing(grossIncome1) + annualNetIncomeForServicing(grossIncome2);
    const shadedRentAnnual = rentalIncomeMonthly * 12 * profileCfg.rentalShadingPct;
    const shadedOtherIncomeAnnual = otherIncomeAnnual * profileCfg.otherIncomeShadingPct;
    const monthlyIncomeUsed = (salaryIncomeUsedAnnual + shadedRentAnnual + shadedOtherIncomeAnnual) / 12;

    const ccCommitment = creditCardLimits * profileCfg.creditCardLoadingPct;
    const monthlyCommitments = livingUsed + existingLoanRepaymentsMonthly + otherDebtsMonthly + ccCommitment;
    const monthlySurplus = monthlyIncomeUsed - monthlyCommitments;
    const assessmentRate = Math.max(actualRate + profileCfg.assessmentBufferPct, profileCfg.assessmentFloorRatePct);

    let borrowingCapacity = 0;
    let assessmentRepaymentCapacity = 0;
    if (monthlySurplus > 0 && loanTerm > 0) {
      assessmentRepaymentCapacity = monthlySurplus * profileCfg.surplusHaircut;
      const oneDollarPayment = periodicPayment(1, assessmentRate, loanTerm, 'Monthly');
      borrowingCapacity = Math.max(0, assessmentRepaymentCapacity / Math.max(1e-9, oneDollarPayment));
    }

    const maxPurchasePrice = targetLvr > 0 ? borrowingCapacity / targetLvr : 0;
    const depositRequired = Math.max(0, maxPurchasePrice - borrowingCapacity);
    const surplusRatio = monthlyIncomeUsed > 0 ? monthlySurplus / monthlyIncomeUsed : 0;

    const warnings: string[] = [];
    let tone: BannerTone = 'good';
    if (livingExpensesMonthly < hemFloor) {
      warnings.push(`Entered living expenses were below the household benchmark, so a HEM-style floor of ${formatMoney(hemFloor)} per month was used.`);
      tone = 'warn';
    }
    warnings.push(`${lenderProfile} converts before-tax salary into a lower servicing income base and applies lender-style assessment settings.`);
    if (creditCardLimits > 0) {
      warnings.push(`Credit card limits are loaded at ${(profileCfg.creditCardLoadingPct * 100).toFixed(1)}% per month in the assessment.`);
      if (tone === 'good') tone = 'info';
    }
    if (rentalIncomeMonthly > 0) {
      warnings.push(`Rental income is shaded to ${(profileCfg.rentalShadingPct * 100).toFixed(0)}% for servicing.`);
      if (tone === 'good') tone = 'info';
    }
    if (targetLvr > 0.9) {
      warnings.push('Target LVR is above 90%, so real lender policy and credit appetite may reduce the usable maximum.');
      tone = 'warn';
    }
    if (monthlySurplus <= 0) {
      warnings.length = 0;
      warnings.push('Monthly surplus is nil or negative after the benchmark expenses and debt commitments, so borrowing capacity is effectively exhausted.');
      tone = 'bad';
    } else if (surplusRatio < 0.15) {
      warnings.push('Serviceability looks tight because only a small share of assessed income remains after benchmark commitments.');
      tone = 'warn';
    }

    return {
      warning: warnings.join(' '),
      tone,
      summary: { deposit: depositRequired, lvr: targetLvr, loan: borrowingCapacity, repay: assessmentRepaymentCapacity },
      payload: {
        'Scenario': borrowing.scenarioName,
        'HEM floor monthly': formatMoney(hemFloor),
        'Living expenses used': formatMoney(livingUsed),
        'Salary income used annual': formatMoney(salaryIncomeUsedAnnual),
        'Shaded rent annual': formatMoney(shadedRentAnnual),
        'Other income used annual': formatMoney(shadedOtherIncomeAnnual),
        'Monthly income used': formatMoney(monthlyIncomeUsed),
        'Credit card commitment': formatMoney(ccCommitment),
        'Monthly commitments': formatMoney(monthlyCommitments),
        'Monthly surplus': formatMoney(monthlySurplus),
        'Assessment rate used': `${assessmentRate.toFixed(2)}%`,
        'Borrowing capacity': formatMoney(borrowingCapacity),
        'Maximum purchase price': formatMoney(maxPurchasePrice),
        'Assessment repayment capacity': formatMoney(assessmentRepaymentCapacity),
        'Target deposit required': formatMoney(depositRequired),
      },
      details: { hemFloor, livingUsed, salaryIncomeUsedAnnual, shadedRentAnnual, shadedOtherIncomeAnnual, monthlyIncomeUsed, ccCommitment, monthlyCommitments, monthlySurplus, assessmentRate, borrowingCapacity, maxPurchasePrice, assessmentRepaymentCapacity, depositRequired },
    };
  }, [borrowing]);

  const saveCompareSlot = (slot: 'A' | 'B' | 'C', source: string, note: string, warning: string, payload: ComparePayload) => {
    setCompare((prev) => ({ ...prev, [slot]: { source, note, warning, payload } }));
  };

  const resetAll = () => {
    setMeta({ ...DEFAULTS.meta });
    setOneProperty({ ...DEFAULTS.oneProperty });
    setTwoProperties({ ...DEFAULTS.twoProperties });
    setRefinance({ ...DEFAULTS.refinance });
    setBorrowing({ ...DEFAULTS.borrowing });
    setCompare({ A: null, B: null, C: null });
  };

  const fullPayload = { meta, oneProperty, twoProperties, refinance, borrowing, compare };

const saveWholeBackup = () => saveJsonFile('loan-web-v32-whole.json', fullPayload);

const saveIndividualTab = (tabKey: 'one' | 'two' | 'refi' | 'borrow') => {
  const payload =
    tabKey === 'one'
      ? { type: 'oneProperty', data: oneProperty }
      : tabKey === 'two'
        ? { type: 'twoProperties', data: twoProperties }
        : tabKey === 'refi'
          ? { type: 'refinance', data: refinance }
          : { type: 'borrowing', data: borrowing };
  saveJsonFile(`loan-web-v32-${payload.type}.json`, payload);
};

const loadIndividualTab = (tabKey: 'one' | 'two' | 'refi' | 'borrow') => {
  loadJsonFile((saved) => {
    if (tabKey === 'one') {
      const incoming = saved.oneProperty ?? (saved.type === 'oneProperty' ? saved.data : saved.data?.oneProperty) ?? saved.data ?? {};
      setOneProperty({ ...DEFAULTS.oneProperty, ...incoming });
      return;
    }
    if (tabKey === 'two') {
      const incoming = saved.twoProperties ?? (saved.type === 'twoProperties' ? saved.data : saved.data?.twoProperties) ?? saved.data ?? {};
      setTwoProperties({ ...DEFAULTS.twoProperties, ...incoming });
      return;
    }
    if (tabKey === 'refi') {
      const incoming = saved.refinance ?? (saved.type === 'refinance' ? saved.data : saved.data?.refinance) ?? saved.data ?? {};
      setRefinance({ ...DEFAULTS.refinance, ...incoming });
      return;
    }
    const incoming = saved.borrowing ?? (saved.type === 'borrowing' ? saved.data : saved.data?.borrowing) ?? saved.data ?? {};
    setBorrowing({ ...DEFAULTS.borrowing, ...incoming });
  });
};

const resetTab = (tabKey: 'one' | 'two' | 'refi' | 'borrow') => {
  if (tabKey === 'one') setOneProperty({ ...DEFAULTS.oneProperty });
  if (tabKey === 'two') setTwoProperties({ ...DEFAULTS.twoProperties });
  if (tabKey === 'refi') setRefinance({ ...DEFAULTS.refinance });
  if (tabKey === 'borrow') setBorrowing({ ...DEFAULTS.borrowing });
};


  const importBackup = () => {
    loadJsonFile((saved) => {
      setMeta({ ...DEFAULTS.meta, ...(saved.meta ?? {}) });
      setOneProperty({ ...DEFAULTS.oneProperty, ...(saved.oneProperty ?? {}) });
      setTwoProperties({ ...DEFAULTS.twoProperties, ...(saved.twoProperties ?? {}) });
      setRefinance({ ...DEFAULTS.refinance, ...(saved.refinance ?? {}) });
      setBorrowing({ ...DEFAULTS.borrowing, ...(saved.borrowing ?? {}) });
      setCompare(saved.compare ?? { A: null, B: null, C: null });
    });
  };

  const exportCurrentPdf = () => {
    const brand = meta.brandName || 'XYZ Finance Specialists';
    const broker = meta.brokerName || 'Jamie';
    if (tab === 'one') {
      exportStyledPdfReport({
        brandName: brand,
        brokerName: broker,
        reportTitle: '1 Property Scenario Report',
        reportSubtitle: oneProperty.scenarioName || 'Untitled scenario',
        summaryCards: [
          { label: 'Out of pocket', value: oneCalc.payload['Out of pocket'] ?? '-' },
          { label: 'Effective LVR', value: oneCalc.payload['Effective LVR'] ?? '-' },
          { label: 'Loan + LMI', value: oneCalc.payload['Loan + LMI'] ?? '-' },
          { label: `Repayment / ${paymentLabel((oneProperty.repaymentFrequency || 'Monthly') as Frequency)}`, value: oneCalc.payload['Repayment'] ?? '-' },
        ],
        sections: [
          { heading: 'Scenario inputs', rows: [
            ['Scenario name', oneProperty.scenarioName || '-'],
            ['Purchase type', oneProperty.purchaseType || '-'],
            ['Interest rate', oneProperty.interestRate ? `${oneProperty.interestRate}%` : '-'],
            ['Loan term', oneProperty.loanTerm ? `${oneProperty.loanTerm} years` : '-'],
            ['Repayment frequency', oneProperty.repaymentFrequency || '-'],
            ['House price', oneProperty.housePrice ? formatMoney(parseNumber(oneProperty.housePrice)) : '-'],
            ['Desired LVR', oneProperty.desiredLvr ? `${oneProperty.desiredLvr}%` : '-'],
            ['Loan approval max', oneProperty.loanApprovalMax ? formatMoney(parseNumber(oneProperty.loanApprovalMax)) : '-'],
            ['Max cash contribution', oneProperty.maxCashContribution ? formatMoney(parseNumber(oneProperty.maxCashContribution)) : '-'],
          ]},
          { heading: 'Calculated outputs', rows: Object.entries(oneCalc.payload) as Array<[string, string]> },
        ],
      });
      return;
    }
    if (tab === 'two') {
      exportStyledPdfReport({
        brandName: brand,
        brokerName: broker,
        reportTitle: '2 Properties Scenario Report',
        reportSubtitle: twoProperties.scenarioName || 'Untitled scenario',
        summaryCards: [
          { label: 'Usable equity', value: twoCalc.payload['Equity'] ?? '-' },
          { label: 'Cash needed', value: twoCalc.payload['Out of pocket'] ?? '-' },
          { label: 'Loan + LMI', value: twoCalc.payload['Loan plus LMI'] ?? '-' },
          { label: 'Repayment / month', value: twoCalc.payload['Monthly PI total'] ?? '-' },
        ],
        sections: [
          { heading: 'Scenario inputs', rows: [
            ['Scenario name', twoProperties.scenarioName || '-'],
            ['Current value', twoProperties.currentValue ? formatMoney(parseNumber(twoProperties.currentValue)) : '-'],
            ['Current mortgage', twoProperties.currentMortgage ? formatMoney(parseNumber(twoProperties.currentMortgage)) : '-'],
            ['Second property price', twoProperties.secondPrice ? formatMoney(parseNumber(twoProperties.secondPrice)) : '-'],
            ['Interest rate', twoProperties.interestRate ? `${twoProperties.interestRate}%` : '-'],
            ['Loan term', twoProperties.loanTerm ? `${twoProperties.loanTerm} years` : '-'],
            ['Cross collateral', twoProperties.crossCollat ? 'Yes' : 'No'],
            ['Withdraw to 80%', twoProperties.withdraw80 ? 'Yes' : 'No'],
          ]},
          { heading: 'Calculated outputs', rows: Object.entries(twoCalc.payload) as Array<[string, string]> },
        ],
      });
      return;
    }
    if (tab === 'refi') {
      exportStyledPdfReport({
        brandName: brand,
        brokerName: broker,
        reportTitle: 'Refinance Scenario Report',
        reportSubtitle: refinance.scenarioName || 'Untitled scenario',
        summaryCards: [
          { label: 'Current repayment', value: refiCalc.payload['Current repayment'] ?? '-' },
          { label: 'New repayment', value: refiCalc.payload['New repayment'] ?? '-' },
          { label: 'Net upfront cost', value: refiCalc.payload['Net cost'] ?? '-' },
          { label: 'Break-even', value: refiCalc.payload['Break-even'] ?? '-' },
        ],
        sections: [
          { heading: 'Scenario inputs', rows: [
            ['Scenario name', refinance.scenarioName || '-'],
            ['Current value', refinance.currentValue ? formatMoney(parseNumber(refinance.currentValue)) : '-'],
            ['Current loan', refinance.currentLoan ? formatMoney(parseNumber(refinance.currentLoan)) : '-'],
            ['Current rate', refinance.currentRate ? `${refinance.currentRate}%` : '-'],
            ['New rate', refinance.newRate ? `${refinance.newRate}%` : '-'],
            ['Current frequency', refinance.currentFreq || '-'],
            ['New frequency', refinance.newFreq || '-'],
            ['Extra borrow', refinance.extraBorrow ? formatMoney(parseNumber(refinance.extraBorrow)) : '-'],
          ]},
          { heading: 'Calculated outputs', rows: Object.entries(refiCalc.payload) as Array<[string, string]> },
        ],
      });
      return;
    }
    if (tab === 'borrow') {
      exportStyledPdfReport({
        brandName: brand,
        brokerName: broker,
        reportTitle: 'Borrowing Capacity Report',
        reportSubtitle: borrowing.scenarioName || 'Untitled scenario',
        summaryCards: [
          { label: 'Borrowing capacity', value: borrowCalc.payload['Borrowing capacity'] ?? '-' },
          { label: 'Max purchase price', value: borrowCalc.payload['Maximum purchase price'] ?? '-' },
          { label: 'Assessment rate', value: borrowCalc.payload['Assessment rate used'] ?? '-' },
          { label: 'Deposit required', value: borrowCalc.payload['Target deposit required'] ?? '-' },
        ],
        sections: [
          { heading: 'Scenario inputs', rows: [
            ['Scenario name', borrowing.scenarioName || '-'],
            ['Lender profile', borrowing.lenderProfile || '-'],
            ['Applicant type', borrowing.applicantType || '-'],
            ['Loan purpose', borrowing.loanPurpose || '-'],
            ['Gross income 1', borrowing.grossIncome1 ? formatMoney(parseNumber(borrowing.grossIncome1)) : '-'],
            ['Gross income 2', borrowing.grossIncome2 ? formatMoney(parseNumber(borrowing.grossIncome2)) : '-'],
            ['Rental income monthly', borrowing.rentalIncomeMonthly ? formatMoney(parseNumber(borrowing.rentalIncomeMonthly)) : '-'],
            ['Living expenses monthly', borrowing.livingExpensesMonthly ? formatMoney(parseNumber(borrowing.livingExpensesMonthly)) : '-'],
          ]},
          { heading: 'Calculated outputs', rows: Object.entries(borrowCalc.payload) as Array<[string, string]> },
        ],
      });
      return;
    }
    if (tab === 'compare') {
      const sections = (['A', 'B', 'C'] as const)
        .filter((slot) => compare[slot])
        .map((slot) => ({
          heading: `Compare slot ${slot} - ${compare[slot]?.note || 'Untitled'}`,
          rows: Object.entries(compare[slot]?.payload ?? {}) as Array<[string, string]>,
        }));
      exportStyledPdfReport({
        brandName: brand,
        brokerName: broker,
        reportTitle: 'Compare Report',
        reportSubtitle: 'Saved scenario comparison',
        summaryCards: [
          { label: 'Slot A', value: compare.A?.source || 'Empty' },
          { label: 'Slot B', value: compare.B?.source || 'Empty' },
          { label: 'Slot C', value: compare.C?.source || 'Empty' },
          { label: 'Saved slots', value: String((['A','B','C'] as const).filter((slot) => compare[slot]).length) },
        ],
        sections: sections.length ? sections : [{ heading: 'Compare', rows: [['Status', 'No compare slots saved yet.']] }],
      });
      return;
    }
    exportStyledPdfReport({
      brandName: brand,
      brokerName: broker,
      reportTitle: 'Whole App Overview',
      reportSubtitle: 'High-level summary',
      summaryCards: [
        { label: '1 Property loan + LMI', value: formatMoney(oneCalc.summary.loan) },
        { label: '2 Properties loan + LMI', value: formatMoney(twoCalc.summary.loan) },
        { label: 'Refinance total loan', value: formatMoney(refiCalc.summary.loan) },
        { label: 'Borrowing capacity', value: formatMoney(borrowCalc.summary.loan) },
      ],
      sections: [
        { heading: 'Branding', rows: [['Brand', meta.brandName || '-'], ['Broker', meta.brokerName || '-']] },
        { heading: 'Quick stats', rows: [
          ['1 Property loan + LMI', formatMoney(oneCalc.summary.loan)],
          ['2 Properties loan + LMI', formatMoney(twoCalc.summary.loan)],
          ['Refinance new total loan', formatMoney(refiCalc.summary.loan)],
          ['Borrowing capacity', formatMoney(borrowCalc.summary.loan)],
        ] },
      ],
    });
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <div className="eyebrow">V3.2 web rebuild</div>
          <h1>{meta.brandName || 'XYZ Finance Specialists'}</h1>
          <p>Modern broker-ready workflow with live calculations, compare slots, browser save state, and a stronger port of your desktop logic.</p>
        </div>
        <div className="header-badge">
          <strong>Broker</strong>
          <div>{meta.brokerName}</div>
        </div>
      </div>

      <div className="tabs">
        {[
          ['home', 'Home'],
          ['one', '1 Property'],
          ['two', '2 Properties'],
          ['refi', 'Refinance'],
          ['borrow', 'Borrowing Capacity'],
          ['compare', 'Compare'],
          ['settings', 'Settings'],
        ].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key as TabKey)}>
            {label}
          </button>
        ))}
      </div>

      <div className="content">
        {tab === 'home' && (
          <div className="grid two-col">
            <section className="panel hero-panel">
              <h2>Now genuinely functional</h2>
              <p>
                This V3.2 version keeps the stronger browser logic and adds styled, branded PDF exports for each tab, with separate whole-app and individual save/load flows.
              </p>
              <div className="hero-tags">
                <span>Live browser state</span>
                <span>Compare scenarios</span>
                <span>Refinance benefits</span>
                <span>2-property modelling</span>
                <span>Broker branding</span>
              </div>
              <div className="button-row">
                <button onClick={saveWholeBackup}>Save whole file</button>
                <button className="secondary" onClick={importBackup}>Load whole file</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF current tab</button>
                <button className="secondary" onClick={resetAll}>Reset all to defaults</button>
              </div>
            </section>
            <section className="panel">
              <h2>What changed in V3</h2>
              <ul className="feature-list">
                <li>1 Property now includes purchase type, stamp duty, FHOG status, LMI, max purchase mode, and out-of-pocket limit handling.</li>
                <li>2 Properties now has actual working calculations and warning logic.</li>
                <li>Refinance now includes break-even and 1 / 3 / 5 year benefit views.</li>
                <li>Borrowing capacity uses lender-style assumptions, HEM floor, rent shading, and credit card loading.</li>
                <li>Branding and scenarios persist in local storage automatically.</li>
                <li>New blank-default workflow for fresh scenarios instead of prefilled examples.</li>
                <li>Import saved JSON backups back into the app and export styled PDF reports for each calculator tab.</li>
              </ul>
            </section>
          </div>
        )}

        {tab === 'one' && (
          <div className="grid two-col">
            <section className="panel">
              <h2>1 Property</h2>
              <div className="field-grid">
                <Field label="Scenario name" value={oneProperty.scenarioName} onChange={(v) => setOneProperty({ ...oneProperty, scenarioName: v })} />
                <SelectField label="Purchase type" value={oneProperty.purchaseType} onChange={(v) => setOneProperty({ ...oneProperty, purchaseType: v as PurchaseType | '' })} options={['PPR', 'FHOG', 'Investment']} />
                <Field label="Interest rate (%)" value={oneProperty.interestRate} onChange={(v) => setOneProperty({ ...oneProperty, interestRate: v })} />
                <Field label="Loan term (years)" value={oneProperty.loanTerm} onChange={(v) => setOneProperty({ ...oneProperty, loanTerm: v })} />
                <Field label="House price" value={oneProperty.housePrice} onChange={(v) => setOneProperty({ ...oneProperty, housePrice: v })} />
                <Field label="Desired LVR (%)" value={oneProperty.desiredLvr} onChange={(v) => setOneProperty({ ...oneProperty, desiredLvr: v })} />
                <Field label="Loan approval max" value={oneProperty.loanApprovalMax} onChange={(v) => setOneProperty({ ...oneProperty, loanApprovalMax: v })} />
                <Field label="Max cash contribution" value={oneProperty.maxCashContribution} onChange={(v) => setOneProperty({ ...oneProperty, maxCashContribution: v })} />
                <SelectField label="Repayment frequency" value={oneProperty.repaymentFrequency} onChange={(v) => setOneProperty({ ...oneProperty, repaymentFrequency: v as Frequency | '' })} options={['Monthly', 'Fortnightly', 'Weekly']} />
                <Field label="Extra principal yearly" value={oneProperty.extraPrincipal} onChange={(v) => setOneProperty({ ...oneProperty, extraPrincipal: v })} />
                <Field label="Yearly income" value={oneProperty.yearlyIncome} onChange={(v) => setOneProperty({ ...oneProperty, yearlyIncome: v })} />
                <Field label="Living expenses monthly" value={oneProperty.livingExpensesMonthly} onChange={(v) => setOneProperty({ ...oneProperty, livingExpensesMonthly: v })} />
                <Field label="LMI exempt cap (%)" value={oneProperty.exemptCap} onChange={(v) => setOneProperty({ ...oneProperty, exemptCap: v })} />
              </div>
              <div className="checkbox-grid">
                <CheckField label="Maximum purchase mode" checked={oneProperty.maxPurchaseMode} onChange={(v) => setOneProperty({ ...oneProperty, maxPurchaseMode: v })} />
                <CheckField label="Use guarantor" checked={oneProperty.useGuarantor} onChange={(v) => setOneProperty({ ...oneProperty, useGuarantor: v })} />
                <CheckField label="Enable out-of-pocket limit" checked={oneProperty.enableOopLimit} onChange={(v) => setOneProperty({ ...oneProperty, enableOopLimit: v })} />
                <CheckField label="LMI exempt" checked={oneProperty.lmiExempt} onChange={(v) => setOneProperty({ ...oneProperty, lmiExempt: v })} />
              </div>
              <div className="button-row">
                <button onClick={() => saveCompareSlot('A', '1 Property', oneProperty.scenarioName || 'Untitled 1 Property', oneCalc.warning, oneCalc.payload)}>Save to Compare A</button>
                <button className="secondary" onClick={() => saveIndividualTab('one')}>Save this tab</button>
                <button className="secondary" onClick={() => loadIndividualTab('one')}>Load this tab</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF this tab</button>
                <button className="secondary" onClick={() => resetTab('one')}>Reset tab</button>
              </div>
            </section>
            <section className="panel">
              <h2>Results</h2>
              <Banner tone={oneCalc.tone} text={oneCalc.warning} />
              <div className="stat-grid">
                <StatCard label="Out of pocket" value={formatMoney(oneCalc.summary.deposit)} tone="good" />
                <StatCard label="Effective LVR" value={formatPercent(oneCalc.summary.lvr)} tone={oneCalc.summary.lvr > 0.95 ? 'bad' : oneCalc.summary.lvr > 0.9 ? 'warn' : 'good'} />
                <StatCard label="Loan + LMI" value={formatMoney(oneCalc.summary.loan)} />
                <StatCard label={`Repayment / ${paymentLabel((oneProperty.repaymentFrequency || 'Monthly') as Frequency)}`} value={formatMoney(oneCalc.summary.repay)} />
              </div>
              <div className="detail-list">
                <div><strong>FHOG status:</strong> {oneCalc.fhog}</div>
                <div><strong>Mode note:</strong> {oneCalc.modeNote}</div>
                <div><strong>OOP status:</strong> {oneCalc.oopLimitStatus}</div>
                {Object.entries(oneCalc.payload).map(([k, v]) => (
                  <div key={k}><strong>{k}:</strong> {v}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'two' && (
          <div className="grid two-col">
            <section className="panel">
              <h2>2 Properties</h2>
              <div className="field-grid">
                <Field label="Scenario name" value={twoProperties.scenarioName} onChange={(v) => setTwoProperties({ ...twoProperties, scenarioName: v })} />
                <Field label="Interest rate (%)" value={twoProperties.interestRate} onChange={(v) => setTwoProperties({ ...twoProperties, interestRate: v })} />
                <Field label="Loan term (years)" value={twoProperties.loanTerm} onChange={(v) => setTwoProperties({ ...twoProperties, loanTerm: v })} />
                <Field label="Current mortgage" value={twoProperties.currentMortgage} onChange={(v) => setTwoProperties({ ...twoProperties, currentMortgage: v })} />
                <Field label="Current value" value={twoProperties.currentValue} onChange={(v) => setTwoProperties({ ...twoProperties, currentValue: v })} />
                <Field label="Second property price" value={twoProperties.secondPrice} onChange={(v) => setTwoProperties({ ...twoProperties, secondPrice: v })} />
                <Field label="Desired consolidated LVR (%)" value={twoProperties.desiredLvr} onChange={(v) => setTwoProperties({ ...twoProperties, desiredLvr: v })} />
                <Field label="Approval max" value={twoProperties.approvalMax} onChange={(v) => setTwoProperties({ ...twoProperties, approvalMax: v })} />
                <Field label="Current rent monthly" value={twoProperties.currentRent} onChange={(v) => setTwoProperties({ ...twoProperties, currentRent: v })} />
                <Field label="New rent monthly" value={twoProperties.newRent} onChange={(v) => setTwoProperties({ ...twoProperties, newRent: v })} />
                <Field label="Yearly income" value={twoProperties.yearlyIncome} onChange={(v) => setTwoProperties({ ...twoProperties, yearlyIncome: v })} />
                <Field label="LMI exempt cap (%)" value={twoProperties.exemptCap} onChange={(v) => setTwoProperties({ ...twoProperties, exemptCap: v })} />
              </div>
              <div className="checkbox-grid">
                <CheckField label="Cross collateralise" checked={twoProperties.crossCollat} onChange={(v) => setTwoProperties({ ...twoProperties, crossCollat: v })} />
                <CheckField label="Withdraw up to 80%" checked={twoProperties.withdraw80} onChange={(v) => setTwoProperties({ ...twoProperties, withdraw80: v })} />
                <CheckField label="LMI exempt" checked={twoProperties.lmiExempt} onChange={(v) => setTwoProperties({ ...twoProperties, lmiExempt: v })} />
              </div>
              <div className="button-row">
                <button onClick={() => saveCompareSlot('B', '2 Properties', twoProperties.scenarioName || 'Untitled 2 Properties', twoCalc.warning, twoCalc.payload)}>Save to Compare B</button>
                <button className="secondary" onClick={() => saveIndividualTab('two')}>Save this tab</button>
                <button className="secondary" onClick={() => loadIndividualTab('two')}>Load this tab</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF this tab</button>
                <button className="secondary" onClick={() => resetTab('two')}>Reset tab</button>
              </div>
            </section>
            <section className="panel">
              <h2>Results</h2>
              <Banner tone={twoCalc.tone} text={twoCalc.warning} />
              <div className="stat-grid">
                <StatCard label="Out of pocket" value={formatMoney(twoCalc.summary.deposit)} tone="good" />
                <StatCard label="Total LVR" value={formatPercent(twoCalc.summary.lvr)} tone={twoCalc.summary.lvr > 0.95 ? 'bad' : twoCalc.summary.lvr > 0.9 ? 'warn' : 'good'} />
                <StatCard label="Loan plus LMI" value={formatMoney(twoCalc.summary.loan)} />
                <StatCard label="Total monthly PI" value={formatMoney(twoCalc.summary.repay)} />
              </div>
              <div className="detail-list">
                {Object.entries(twoCalc.payload).map(([k, v]) => (
                  <div key={k}><strong>{k}:</strong> {v}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'refi' && (
          <div className="grid two-col">
            <section className="panel">
              <h2>Refinance</h2>
              <div className="field-grid">
                <Field label="Scenario name" value={refinance.scenarioName} onChange={(v) => setRefinance({ ...refinance, scenarioName: v })} />
                <Field label="Current property value" value={refinance.currentValue} onChange={(v) => setRefinance({ ...refinance, currentValue: v })} />
                <Field label="Current loan" value={refinance.currentLoan} onChange={(v) => setRefinance({ ...refinance, currentLoan: v })} />
                <Field label="Current rate (%)" value={refinance.currentRate} onChange={(v) => setRefinance({ ...refinance, currentRate: v })} />
                <Field label="Current term (years)" value={refinance.currentTerm} onChange={(v) => setRefinance({ ...refinance, currentTerm: v })} />
                <SelectField label="Current frequency" value={refinance.currentFreq} onChange={(v) => setRefinance({ ...refinance, currentFreq: v as Frequency | '' })} options={['Monthly', 'Fortnightly', 'Weekly']} />
                <Field label="New rate (%)" value={refinance.newRate} onChange={(v) => setRefinance({ ...refinance, newRate: v })} />
                <Field label="New term (years)" value={refinance.newTerm} onChange={(v) => setRefinance({ ...refinance, newTerm: v })} />
                <SelectField label="New frequency" value={refinance.newFreq} onChange={(v) => setRefinance({ ...refinance, newFreq: v as Frequency | '' })} options={['Monthly', 'Fortnightly', 'Weekly']} />
                <Field label="Discharge fee" value={refinance.dischargeFee} onChange={(v) => setRefinance({ ...refinance, dischargeFee: v })} />
                <Field label="Application fee" value={refinance.applicationFee} onChange={(v) => setRefinance({ ...refinance, applicationFee: v })} />
                <Field label="Legal fee" value={refinance.legalFee} onChange={(v) => setRefinance({ ...refinance, legalFee: v })} />
                <Field label="Valuation fee" value={refinance.valuationFee} onChange={(v) => setRefinance({ ...refinance, valuationFee: v })} />
                <Field label="Government fees" value={refinance.govFee} onChange={(v) => setRefinance({ ...refinance, govFee: v })} />
                <Field label="Cashback" value={refinance.cashback} onChange={(v) => setRefinance({ ...refinance, cashback: v })} />
                <Field label="Extra borrow" value={refinance.extraBorrow} onChange={(v) => setRefinance({ ...refinance, extraBorrow: v })} />
              </div>
              <div className="checkbox-grid">
                <CheckField label="LMI exempt" checked={refinance.lmiExempt} onChange={(v) => setRefinance({ ...refinance, lmiExempt: v })} />
              </div>
              <div className="button-row">
                <button onClick={() => saveCompareSlot('C', 'Refinance', refinance.scenarioName || 'Untitled Refinance', refiCalc.warning, refiCalc.payload)}>Save to Compare C</button>
                <button className="secondary" onClick={() => saveIndividualTab('refi')}>Save this tab</button>
                <button className="secondary" onClick={() => loadIndividualTab('refi')}>Load this tab</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF this tab</button>
                <button className="secondary" onClick={() => resetTab('refi')}>Reset tab</button>
              </div>
            </section>
            <section className="panel">
              <h2>Decision guide</h2>
              <Banner tone={refiCalc.tone} text={refiCalc.warning} />
              <div className="stat-grid">
                <StatCard label="Net cost" value={formatMoney(refiCalc.summary.deposit)} tone={refiCalc.summary.deposit > 0 ? 'warn' : 'good'} />
                <StatCard label="New LVR" value={formatPercent(refiCalc.summary.lvr)} tone={refiCalc.summary.lvr > 0.95 ? 'bad' : refiCalc.summary.lvr > 0.9 ? 'warn' : 'good'} />
                <StatCard label="New total loan" value={formatMoney(refiCalc.summary.loan)} />
                <StatCard label={`Repayment / ${paymentLabel((refinance.newFreq || 'Monthly') as Frequency)}`} value={formatMoney(refiCalc.summary.repay)} />
              </div>
              <div className="detail-list">
                {Object.entries(refiCalc.payload).map(([k, v]) => (
                  <div key={k}><strong>{k}:</strong> {v}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'borrow' && (
          <div className="grid two-col">
            <section className="panel">
              <h2>Borrowing Capacity</h2>
              <div className="field-grid">
                <Field label="Scenario name" value={borrowing.scenarioName} onChange={(v) => setBorrowing({ ...borrowing, scenarioName: v })} />
                <SelectField label="Lender profile" value={borrowing.lenderProfile} onChange={(v) => setBorrowing({ ...borrowing, lenderProfile: v as LenderProfile | '' })} options={['NAB-style', 'Conservative', 'Aggressive']} />
                <SelectField label="Applicant type" value={borrowing.applicantType} onChange={(v) => setBorrowing({ ...borrowing, applicantType: v as ApplicantType | '' })} options={['Single', 'Couple']} />
                <Field label="Dependants" value={borrowing.dependants} onChange={(v) => setBorrowing({ ...borrowing, dependants: v })} />
                <SelectField label="Loan purpose" value={borrowing.loanPurpose} onChange={(v) => setBorrowing({ ...borrowing, loanPurpose: v as LoanPurpose | '' })} options={['Owner Occupier', 'Investment']} />
                <Field label="Gross income 1 annual" value={borrowing.grossIncome1} onChange={(v) => setBorrowing({ ...borrowing, grossIncome1: v })} />
                <Field label="Gross income 2 annual" value={borrowing.grossIncome2} onChange={(v) => setBorrowing({ ...borrowing, grossIncome2: v })} />
                <Field label="Rental income monthly" value={borrowing.rentalIncomeMonthly} onChange={(v) => setBorrowing({ ...borrowing, rentalIncomeMonthly: v })} />
                <Field label="Other income annual" value={borrowing.otherIncomeAnnual} onChange={(v) => setBorrowing({ ...borrowing, otherIncomeAnnual: v })} />
                <Field label="Living expenses monthly" value={borrowing.livingExpensesMonthly} onChange={(v) => setBorrowing({ ...borrowing, livingExpensesMonthly: v })} />
                <Field label="Existing loan repayments monthly" value={borrowing.existingLoanRepaymentsMonthly} onChange={(v) => setBorrowing({ ...borrowing, existingLoanRepaymentsMonthly: v })} />
                <Field label="Credit card limits" value={borrowing.creditCardLimits} onChange={(v) => setBorrowing({ ...borrowing, creditCardLimits: v })} />
                <Field label="Other debts monthly" value={borrowing.otherDebtsMonthly} onChange={(v) => setBorrowing({ ...borrowing, otherDebtsMonthly: v })} />
                <Field label="Actual rate (%)" value={borrowing.actualRate} onChange={(v) => setBorrowing({ ...borrowing, actualRate: v })} />
                <Field label="Loan term (years)" value={borrowing.loanTerm} onChange={(v) => setBorrowing({ ...borrowing, loanTerm: v })} />
                <Field label="Target LVR (%)" value={borrowing.targetLvr} onChange={(v) => setBorrowing({ ...borrowing, targetLvr: v })} />
              </div>
              <div className="button-row">
                <button onClick={() => saveCompareSlot('A', 'Borrowing Capacity', borrowing.scenarioName || 'Untitled Borrowing Capacity', borrowCalc.warning, borrowCalc.payload)}>Save to Compare A</button>
                <button className="secondary" onClick={() => saveIndividualTab('borrow')}>Save this tab</button>
                <button className="secondary" onClick={() => loadIndividualTab('borrow')}>Load this tab</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF this tab</button>
                <button className="secondary" onClick={() => resetTab('borrow')}>Reset tab</button>
              </div>
            </section>
            <section className="panel">
              <h2>Capacity summary</h2>
              <Banner tone={borrowCalc.tone} text={borrowCalc.warning} />
              <div className="stat-grid">
                <StatCard label="Target deposit required" value={formatMoney(borrowCalc.summary.deposit)} tone="good" />
                <StatCard label="Target LVR" value={formatPercent(borrowCalc.summary.lvr)} />
                <StatCard label="Borrowing capacity" value={formatMoney(borrowCalc.summary.loan)} />
                <StatCard label="Assessment repayment capacity" value={formatMoney(borrowCalc.summary.repay)} />
              </div>
              <div className="detail-list">
                {Object.entries(borrowCalc.payload).map(([k, v]) => (
                  <div key={k}><strong>{k}:</strong> {v}</div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'compare' && (
          <section className="panel">
            <h2>Compare scenarios</h2>
            <p className="muted">Save scenarios from any calculator tab, then print this page as a simple side-by-side review.</p>
            <div className="compare-grid">
              {(['A', 'B', 'C'] as const).map((slot) => (
                <div className="compare-card" key={slot}>
                  <div className="compare-head">
                    <strong>Slot {slot}</strong>
                    <button className="ghost" onClick={() => setCompare((prev) => ({ ...prev, [slot]: null }))}>Clear</button>
                  </div>
                  {!compare[slot] ? (
                    <p className="muted">Save a scenario from another tab into this slot.</p>
                  ) : (
                    <>
                      <div className="muted">{compare[slot]?.source}</div>
                      <div className="compare-title">{compare[slot]?.note}</div>
                      <Banner tone="info" text={compare[slot]?.warning || ''} />
                      <div className="detail-list compact">
                        {Object.entries(compare[slot]?.payload ?? {}).map(([k, v]) => (
                          <div key={k}><strong>{k}:</strong> {v}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'settings' && (
          <div className="grid two-col">
            <section className="panel">
              <h2>Branding and defaults</h2>
              <div className="field-grid">
                <Field label="Brand name" value={meta.brandName} onChange={(v) => setMeta({ ...meta, brandName: v })} />
                <Field label="Broker name" value={meta.brokerName} onChange={(v) => setMeta({ ...meta, brokerName: v })} />
                <Field label="Property one label" value={meta.propertyOneName} onChange={(v) => setMeta({ ...meta, propertyOneName: v })} />
                <Field label="Property two label" value={meta.propertyTwoName} onChange={(v) => setMeta({ ...meta, propertyTwoName: v })} />
              </div>
              <div className="button-row">
                <button onClick={() => saveWholeBackup()}>Download current data</button>
                <button className="secondary" onClick={importBackup}>Load whole file</button>
                <button className="secondary" onClick={exportCurrentPdf}>Export PDF current tab</button>
                <button className="secondary" onClick={resetAll}>Reset everything</button>
              </div>
            </section>
            <section className="panel">
              <h2>Persistence</h2>
              <Banner tone="good" text="Your settings and current scenarios save automatically in this browser via localStorage." />
              <div className="detail-list">
                <div><strong>Brand:</strong> {meta.brandName || '-'}</div>
                <div><strong>Broker:</strong> {meta.brokerName || '-'}</div>
                <div><strong>Auto-save:</strong> Enabled after page load</div>
                <div><strong>Whole save/load:</strong> Enabled via JSON files</div>
                <div><strong>Individual save/load:</strong> Available inside each calculator tab</div>
                <div><strong>Printable report:</strong> Available for the current tab</div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
