
import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import './styles.css';
import {
  DEFAULTS,
  DISCLAIMER,
  calcBorrowing,
  calcOneProperty,
  calcRefinance,
  type AlertTone,
  type ApplicantType,
  type BorrowingInputs,
  type Frequency,
  type LenderProfile,
  type LoanPurpose,
  type OnePropertyInputs,
  type PurchaseType,
  type RefinanceInputs,
} from './calculations';

type TabKey = 'home' | 'one' | 'two' | 'refi' | 'borrow' | 'compare' | 'settings';
type CompareSlot = 'A' | 'B' | 'C';

type SavedState = {
  meta: typeof DEFAULTS.meta;
  one: OnePropertyInputs;
  two: typeof DEFAULTS.twoProperties;
  refi: RefinanceInputs;
  borrow: BorrowingInputs;
  compare: Record<CompareSlot, { title: string; body: string[] } | null>;
  caseName?: string;
};

const STORAGE_KEY = 'loan-web-v34';
const PROFILE_STORAGE_KEY = 'loan-web-profiles-v36';

type LocalProfile = {
  id: string;
  brokerName: string;
  caseName: string;
  savedAt: string;
  state: SavedState;
};
const TAB_KEYS: Array<{ key: TabKey; label: string }> = [
  { key: 'home', label: 'Home' },
  { key: 'one', label: '1 Property' },
  { key: 'two', label: '2 Properties' },
  { key: 'refi', label: 'Refinance' },
  { key: 'borrow', label: 'Borrowing Capacity' },
  { key: 'compare', label: 'Compare' },
  { key: 'settings', label: 'Settings' },
];

const blankState = (): SavedState => ({
  meta: { ...DEFAULTS.meta },
  one: { ...DEFAULTS.oneProperty },
  two: { ...DEFAULTS.twoProperties },
  refi: { ...DEFAULTS.refinance },
  borrow: { ...DEFAULTS.borrowing },
  compare: { A: null, B: null, C: null },
  caseName: '',
});

const field = <T extends string | boolean>(
  label: string,
  value: T,
  onChange: (value: T) => void,
  type: 'text' | 'number' | 'select' = 'text',
  options: string[] = [],
) => {
  if (type === 'select') {
    return (
      <label className="field">
        <span>{label}</span>
        <select value={String(value)} onChange={(e) => onChange(e.target.value as T)}>
          <option value="">Select...</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={String(value)} onChange={(e) => onChange(e.target.value as T)} />
    </label>
  );
};

const niceNow = () => new Date().toISOString();
const makeProfileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function getStoredProfiles(): LocalProfile[] {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredProfiles(profiles: LocalProfile[]) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function Banner({ tone, lines }: { tone: AlertTone; lines: string[] }) {
  return (
    <div className={`banner ${tone}`}>
      <div>{lines[0]}</div>
      {lines.length > 1 && <div className="banner-sub">{lines.slice(1).join(' • ')}</div>}
    </div>
  );
}

function MetricSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string; tone?: AlertTone }>;
}) {
  return (
    <section className="metric-section">
      <div className="section-heading">{title}</div>
      <div className="stat-grid">
        {items.map((item) => (
          <div className={`stat-card ${item.tone ?? 'info'}`} key={`${title}-${item.label}`}>
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailSection({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <section className="detail-section">
      <div className="section-heading alt">{title}</div>
      <div className="detail-list compact">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <strong>{row.label}:</strong> {row.value}
          </div>
        ))}
      </div>
    </section>
  );
}

function Actions({
  onSaveTab,
  onLoadTab,
  onPdf,
  onResetTab,
  compareLabel,
  onCompare,
}: {
  onSaveTab: () => void;
  onLoadTab: () => void;
  onPdf: () => void;
  onResetTab: () => void;
  compareLabel: string;
  onCompare: (slot: CompareSlot) => void;
}) {
  return (
    <div className="button-row">
      <button onClick={() => onCompare('A')}>Save to Compare A</button>
      <button className="secondary" onClick={() => onCompare('B')}>
        Save to Compare B
      </button>
      <button className="secondary" onClick={() => onCompare('C')}>
        Save to Compare C
      </button>
      <button className="secondary" onClick={onSaveTab}>
        Save this tab
      </button>
      <button className="secondary" onClick={onLoadTab}>
        Load this tab
      </button>
      <button className="secondary" onClick={onPdf}>
        Export PDF this tab
      </button>
      <button className="secondary" onClick={onResetTab}>
        Reset tab
      </button>
      <span className="toolbar-note">{compareLabel}</span>
    </div>
  );
}

const INPUT_LABELS_ONE: Record<string, string> = {
  scenarioName: 'Scenario name',
  purchaseType: 'Purchase type',
  interestRate: 'Interest rate (%)',
  loanTerm: 'Loan term (years)',
  housePrice: 'House price',
  desiredLvr: 'Desired LVR (%)',
  loanApprovalMax: 'Loan approval max',
  maxCashContribution: 'Max cash contribution',
  maxPurchaseMode: 'Maximum purchase mode',
  useGuarantor: 'Use guarantor',
  enableOopLimit: 'Enable out-of-pocket limit',
  lmiExempt: 'LMI exempt',
  exemptCap: 'LMI exempt cap (%)',
  repaymentFrequency: 'Repayment frequency',
  extraPrincipal: 'Extra principal yearly',
  yearlyIncome: 'Yearly income',
  livingExpensesMonthly: 'Living expenses monthly',
};

const INPUT_LABELS_REFI: Record<string, string> = {
  scenarioName: 'Scenario name',
  currentValue: 'Current property value',
  currentLoan: 'Current loan',
  currentRate: 'Current rate (%)',
  currentTerm: 'Current term',
  currentFreq: 'Current frequency',
  newRate: 'New rate (%)',
  newTerm: 'New term',
  newFreq: 'New frequency',
  dischargeFee: 'Discharge fee',
  applicationFee: 'Application fee',
  legalFee: 'Legal fee',
  valuationFee: 'Valuation fee',
  govFee: 'Government fee',
  cashback: 'Cashback',
  extraBorrow: 'Extra borrow',
  lmiExempt: 'LMI exempt',
};

const INPUT_LABELS_BORROW: Record<string, string> = {
  scenarioName: 'Scenario name',
  lenderProfile: 'Lender profile',
  applicantType: 'Applicant type',
  dependants: 'Dependants',
  loanPurpose: 'Loan purpose',
  grossIncome1: 'Gross income 1',
  grossIncome2: 'Gross income 2',
  rentalIncomeMonthly: 'Rental income monthly',
  otherIncomeAnnual: 'Other income annual',
  livingExpensesMonthly: 'Living expenses monthly',
  existingLoanRepaymentsMonthly: 'Existing loan repayments monthly',
  creditCardLimits: 'Credit card limits',
  otherDebtsMonthly: 'Other debts monthly',
  actualRate: 'Actual rate (%)',
  assessmentBufferPct: 'Assessment buffer (%)',
  assessmentFloorRatePct: 'Assessment floor rate (%)',
  loanTerm: 'Loan term',
  targetLvr: 'Target LVR (%)',
  rentalShadingPct: 'Rental shading (%)',
  otherIncomeShadingPct: 'Other income shading (%)',
  creditCardLoadingPct: 'Credit card loading (%/month)',
};

function App() {
  const [state, setState] = useState<SavedState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...blankState(), ...JSON.parse(raw) } : blankState();
    } catch {
      return blankState();
    }
  });
  const [tab, setTab] = useState<TabKey>('one');
  const [brokerDraft, setBrokerDraft] = useState(state.meta.brokerName || '');
  const [startupStep, setStartupStep] = useState<'broker' | 'brokerMenu' | 'brokerLoad' | 'ready'>(
    state.meta.brokerName ? 'ready' : 'broker',
  );
  const [profiles, setProfiles] = useState<LocalProfile[]>(() => getStoredProfiles());
  const [profileNameDraft, setProfileNameDraft] = useState(state.caseName || '');
  const [profileSearch, setProfileSearch] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setProfiles(getStoredProfiles());
  }, []);

  const oneCalc = useMemo(() => calcOneProperty(state.one), [state.one]);
  const refiCalc = useMemo(() => calcRefinance(state.refi), [state.refi]);
  const borrowCalc = useMemo(() => calcBorrowing(state.borrow), [state.borrow]);

  const patch = <K extends keyof SavedState>(key: K, value: SavedState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));
  const patchOne = <K extends keyof OnePropertyInputs>(key: K, value: OnePropertyInputs[K]) =>
    patch('one', { ...state.one, [key]: value });
  const patchRefi = <K extends keyof RefinanceInputs>(key: K, value: RefinanceInputs[K]) =>
    patch('refi', { ...state.refi, [key]: value });
  const patchBorrow = <K extends keyof BorrowingInputs>(key: K, value: BorrowingInputs[K]) =>
    patch('borrow', { ...state.borrow, [key]: value });
  const patchMeta = <K extends keyof typeof DEFAULTS.meta>(key: K, value: (typeof DEFAULTS.meta)[K]) =>
    patch('meta', { ...state.meta, [key]: value });

  const brokerProfiles = profiles
    .filter((profile) => profile.brokerName === (state.meta.brokerName || ''))
    .filter((profile) => {
      const q = profileSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        profile.caseName.toLowerCase().includes(q) ||
        profile.savedAt.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  const enterBrokerMode = () => {
    const brokerName = brokerDraft.trim();
    if (!brokerName) return;
    setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName } }));
    setStartupStep('brokerMenu');
    setProfileSearch('');
  };

  const continueAsGuest = () => {
    setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName: 'Guest' } }));
    setBrokerDraft('Guest');
    setProfileSearch('');
    setStartupStep('ready');
  };

  const createNewCase = () => {
    const brokerName = state.meta.brokerName || brokerDraft.trim() || 'Guest';
    const fresh = blankState();
    fresh.meta.brandName = state.meta.brandName;
    fresh.meta.propertyOneName = state.meta.propertyOneName;
    fresh.meta.propertyTwoName = state.meta.propertyTwoName;
    fresh.meta.brokerName = brokerName;
    setState(fresh);
    setProfileNameDraft('');
    setProfileSearch('');
    setTab('one');
    setStartupStep('ready');
  };

  const loadProfileById = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const next = { ...blankState(), ...profile.state, caseName: profile.caseName };
    next.meta = { ...blankState().meta, ...profile.state.meta, brokerName: profile.brokerName };
    setState(next);
    setBrokerDraft(profile.brokerName);
    setProfileNameDraft(profile.caseName || '');
    setProfileSearch('');
    setTab('one');
    setStartupStep('ready');
  };

  const saveProfiles = (next: LocalProfile[]) => {
    setProfiles(next);
    saveStoredProfiles(next);
  };

  const saveToProfile = () => {
    if ((state.meta.brokerName || '') === 'Guest') return;
    const brokerName = (state.meta.brokerName || '').trim();
    if (!brokerName) return;
    const caseName = (
      profileNameDraft ||
      state.caseName ||
      state.one.scenarioName ||
      state.refi.scenarioName ||
      state.borrow.scenarioName ||
      'Untitled Case'
    ).trim();
    const profile: LocalProfile = {
      id: makeProfileId(),
      brokerName,
      caseName,
      savedAt: niceNow(),
      state: { ...state, caseName },
    };
    const next = [
      profile,
      ...profiles.filter((item) => !(item.brokerName === brokerName && item.caseName === caseName))
    ];
    saveProfiles(next);
    setState((prev) => ({ ...prev, caseName }));
    setProfileNameDraft(caseName);
  };

  const deleteProfileById = (id: string) => {
    const next = profiles.filter((profile) => profile.id !== id);
    saveProfiles(next);
  };

  const renameProfileById = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const nextName = window.prompt('Rename saved case', profile.caseName)?.trim();
    if (!nextName) return;
    const next = profiles.map((item) =>
      item.id === id
        ? { ...item, caseName: nextName, savedAt: niceNow(), state: { ...item.state, caseName: nextName } }
        : item,
    );
    saveProfiles(next);
    if (state.caseName === profile.caseName && state.meta.brokerName === profile.brokerName) {
      setState((prev) => ({ ...prev, caseName: nextName }));
      setProfileNameDraft(nextName);
    }
  };

  const duplicateProfileById = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const nextName = window.prompt('Duplicate case as', `${profile.caseName} Copy`)?.trim();
    if (!nextName) return;
    const duplicate: LocalProfile = {
      ...profile,
      id: makeProfileId(),
      caseName: nextName,
      savedAt: niceNow(),
      state: { ...profile.state, caseName: nextName },
    };
    saveProfiles([duplicate, ...profiles]);
  };

  const changeBroker = () => {
    setBrokerDraft('');
    setProfileSearch('');
    setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName: '' } }));
    setStartupStep('broker');
  };

  const saveJson = (name: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadJson = (callback: (data: any) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      callback(JSON.parse(text));
    };
    input.click();
  };

  const saveTab = (key: 'one' | 'refi' | 'borrow') => saveJson(`${key}-tab.json`, state[key]);
  const loadTab = (key: 'one' | 'refi' | 'borrow') =>
    loadJson((data) => patch(key, { ...state[key], ...data } as any));
  const saveWhole = () => saveJson('loan-web-whole.json', state);
  const loadWhole = () => loadJson((data) => { const next = { ...blankState(), ...data }; setState(next); setProfileNameDraft(next.caseName || ''); });

  const exportPdfStyled = ({
    title,
    subtitle,
    atAGlance,
    decisionRows,
    warningRows,
    inputRows,
    outputRows,
    detailTop = [],
  }: {
    title: string;
    subtitle: string;
    atAGlance: Array<{ label: string; value: string }>;
    decisionRows: Array<{ label: string; value: string }>;
    warningRows: Array<{ label: string; value: string }>;
    inputRows: Array<{ label: string; value: string }>;
    outputRows: Array<{ label: string; value: string }>;
    detailTop?: Array<{ label: string; value: string }>;
  }) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 14;
    const right = 196;
    let y = 18;

    const addPageIfNeeded = (needed = 12) => {
      if (y + needed > 274) {
        addFooter();
        doc.addPage();
        y = 18;
        addHeader(false);
      }
    };

    const addFooter = () => {
      const page = doc.getNumberOfPages();
      doc.setDrawColor(203, 213, 225);
      doc.line(left, 287, right, 287);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page}`, right, 292, { align: 'right' });
      doc.text(state.meta.brandName || 'XYZ Finance Specialists', left, 292);
    };

    const addHeader = (firstPage = true) => {
      doc.setFillColor(18, 32, 51);
      doc.roundedRect(left, y - 6, right - left, firstPage ? 26 : 18, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(firstPage ? 18 : 14);
      doc.text(state.meta.brandName || 'XYZ Finance Specialists', left + 6, y + (firstPage ? 4 : 1));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Broker: ${state.meta.brokerName || 'Jamie'}`, right - 6, y + (firstPage ? 4 : 1), { align: 'right' });
      if (firstPage) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(title, left + 6, y + 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const subLines = doc.splitTextToSize(subtitle, 168);
        doc.text(subLines, left + 6, y + 18);
        y += 32;
      } else {
        y += 22;
      }
      doc.setTextColor(20, 20, 20);
    };

    const addSectionBar = (label: string, fill: [number, number, number]) => {
      addPageIfNeeded(12);
      doc.setFillColor(...fill);
      doc.roundedRect(left, y, right - left, 9, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(label, left + 4, y + 5.8);
      doc.setTextColor(20, 20, 20);
      y += 12;
    };

    const addMetricCards = (items: Array<{ label: string; value: string }>) => {
      const colGap = 4;
      const cardW = (right - left - colGap) / 2;
      const cardH = 20;
      for (let i = 0; i < items.length; i += 2) {
        addPageIfNeeded(cardH + 3);
        const row = items.slice(i, i + 2);
        row.forEach((item, idx) => {
          const x = left + idx * (cardW + colGap);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(x, y, cardW, cardH, 3, 3, 'FD');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(String(item.label).toUpperCase(), x + 4, y + 5.6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          const valueLines = doc.splitTextToSize(String(item.value), cardW - 8);
          doc.text(valueLines, x + 4, y + 13);
        });
        y += cardH + 4;
      }
    };

    const addInsightPanel = (rows: Array<{ label: string; value: string }>, fill: [number, number, number], border: [number, number, number]) => {
      rows.forEach((row) => {
        const wrapped = doc.splitTextToSize(String(row.value), 116);
        const height = Math.max(10, 6 + wrapped.length * 4.5);
        addPageIfNeeded(height + 3);
        doc.setFillColor(...fill);
        doc.setDrawColor(...border);
        doc.roundedRect(left, y, right - left, height, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${row.label}:`, left + 4, y + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.text(wrapped, left + 44, y + 5.5);
        y += height + 3;
      });
    };

    const addKvTable = (rows: Array<{ label: string; value: string }>) => {
      rows.forEach((row) => {
        const valueLines = doc.splitTextToSize(String(row.value), 104);
        const lineCount = Math.max(1, valueLines.length);
        const rowH = 5 + lineCount * 4.2;
        addPageIfNeeded(rowH + 1);
        doc.setDrawColor(226, 232, 240);
        doc.rect(left, y, 76, rowH);
        doc.rect(left + 76, y, right - left - 76, rowH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(String(row.label), left + 3, y + 5.2);
        doc.setFont('helvetica', 'normal');
        doc.text(valueLines, left + 79, y + 5.2);
        y += rowH;
      });
      y += 3;
    };

    const addDisclaimer = () => {
      addPageIfNeeded(40);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      const boxH = 34;
      doc.roundedRect(left, y, right - left, boxH, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Important Information', left + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.7);
      const text = doc.splitTextToSize(
        'This report is indicative only and is provided for general information purposes. All figures, estimates, and calculations are based on user inputs, assumptions, and calculator logic, and may not reflect actual lender outcomes.\n\nThis document does not constitute financial advice, credit advice, or a formal loan assessment. Actual borrowing capacity, lending terms, and approval outcomes depend on full review by a licensed lender or broker, including verification of income, expenses, liabilities, assets, and credit history.\n\nPre-approval or formal approval from a bank or lender is the only reliable confirmation of borrowing capacity and loan eligibility. Final lender policy, valuation outcomes, and personal circumstances may materially change the result.',
        right - left - 8,
      );
      doc.text(text, left + 4, y + 11);
      y += boxH + 4;
    };

    addHeader(true);

    if (detailTop.length) {
      addSectionBar('Detailed Breakdown', [51, 65, 85]);
      addKvTable(detailTop);
    }

    addSectionBar('At a Glance', [15, 118, 110]);
    addMetricCards(atAGlance);

    addSectionBar('Decision Guide', [30, 64, 175]);
    addInsightPanel(decisionRows, [248, 250, 252], [191, 219, 254]);

    if (warningRows.length) {
      addSectionBar('Warnings & Notes', [180, 83, 9]);
      addInsightPanel(warningRows, [255, 251, 235], [245, 158, 11]);
    }

    addSectionBar('Inputs Used', [71, 85, 105]);
    addKvTable(inputRows);

    addSectionBar('All Calculated Results', [71, 85, 105]);
    addKvTable(outputRows);

    addDisclaimer();
    addFooter();

    doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  };

  const onePdfInputRows = () => {
    const entries = Object.entries(state.one)
      .filter(([, value]) => String(value).trim() !== '')
      .filter(([key]) => !(state.one.purchaseType === 'FHOG' && ['useGuarantor', 'lmiExempt', 'exemptCap'].includes(key)))
      .map(([key, value]) => ({ label: INPUT_LABELS_ONE[key] || key, value: String(value) }));
    if (state.one.scenarioName?.trim()) entries.unshift({ label: 'Scenario name', value: state.one.scenarioName.trim() });
    return entries;
  };

  const refiPdfInputRows = () =>
    Object.entries(state.refi)
      .filter(([, value]) => String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_REFI[key] || key, value: String(value) }));

  const borrowPdfInputRows = () =>
    Object.entries(state.borrow)
      .filter(([, value]) => String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_BORROW[key] || key, value: String(value) }));

  const saveCompare = (slot: CompareSlot, title: string, rows: string[]) => {
    patch('compare', { ...state.compare, [slot]: { title, body: rows } });
  };

  const renderHome = () => (
    <div className="grid two-col">
      <section className="panel hero-panel">
        <div className="eyebrow">Version 3.4 styled PDF parity</div>
        <h2>{state.meta.brandName || 'XYZ Finance Specialists'}</h2>
        <p>
          This revision keeps the current solver logic while making the PDF layout much closer to the Python desktop report:
          header block, section bars, metric cards, decision guide, warnings panel, inputs used, all calculated results, and
          a proper information box at the bottom.
        </p>
        <div className="hero-tags">
          <span>Branded header</span>
          <span>Metric cards</span>
          <span>Warnings panel</span>
          <span>Table layout parity</span>
        </div>
      </section>
      <section className="panel">
        <h2>What changed</h2>
        <ul className="feature-list">
          <li>PDF now uses the Python-style section order and separator bars.</li>
          <li>At a Glance exports as summary cards instead of plain rows.</li>
          <li>Decision Guide and Warnings & Notes export in bordered insight panels.</li>
          <li>Inputs Used and All Calculated Results export in table-style rows.</li>
        </ul>
      </section>
    </div>
  );

  const renderOne = () => {
    const compareRows = Object.entries(oneCalc.outputs).map(([k, v]) => `${k}: ${v}`);
    const warningRows = [
      { label: 'Main warning', value: oneCalc.warnings[0] || 'Please review the points below.' },
      ...oneCalc.warnings.slice(1, 7).map((value, index) => ({ label: `Note ${index + 1}`, value })),
    ];
    return (
      <div className="grid two-col">
        <section className="panel">
          <h2>1 Property</h2>
          <div className="field-grid">
            {field('Scenario name', state.one.scenarioName, (v) => patchOne('scenarioName', v as string))}
            {field('Purchase type', state.one.purchaseType, (v) => patchOne('purchaseType', v as PurchaseType | ''), 'select', ['PPR', 'FHOG', 'Investment'])}
            {field('Interest rate (%)', state.one.interestRate, (v) => patchOne('interestRate', v as string), 'number')}
            {field('Loan term (years)', state.one.loanTerm, (v) => patchOne('loanTerm', v as string), 'number')}
            {field('House price (leave blank to auto-solve)', state.one.housePrice, (v) => patchOne('housePrice', v as string), 'number')}
            {field('Desired LVR (%)', state.one.desiredLvr, (v) => patchOne('desiredLvr', v as string), 'number')}
            {field('Loan approval max', state.one.loanApprovalMax, (v) => patchOne('loanApprovalMax', v as string), 'number')}
            {field('Max cash contribution', state.one.maxCashContribution, (v) => patchOne('maxCashContribution', v as string), 'number')}
            {field('Repayment frequency', state.one.repaymentFrequency, (v) => patchOne('repaymentFrequency', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
            {field('Extra principal yearly', state.one.extraPrincipal, (v) => patchOne('extraPrincipal', v as string), 'number')}
            {field('Yearly income', state.one.yearlyIncome, (v) => patchOne('yearlyIncome', v as string), 'number')}
            {field('Living expenses monthly', state.one.livingExpensesMonthly, (v) => patchOne('livingExpensesMonthly', v as string), 'number')}
            {field('LMI exempt cap (%)', state.one.exemptCap, (v) => patchOne('exemptCap', v as string), 'number')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field">
              <input type="checkbox" checked={state.one.maxPurchaseMode} onChange={(e) => patchOne('maxPurchaseMode', e.target.checked)} /> Maximum purchase mode
            </label>
            <label className="check-field">
              <input type="checkbox" checked={state.one.useGuarantor} onChange={(e) => patchOne('useGuarantor', e.target.checked)} /> Use guarantor
            </label>
            <label className="check-field">
              <input type="checkbox" checked={state.one.enableOopLimit} onChange={(e) => patchOne('enableOopLimit', e.target.checked)} /> Enable out-of-pocket limit
            </label>
            <label className="check-field">
              <input type="checkbox" checked={state.one.lmiExempt} onChange={(e) => patchOne('lmiExempt', e.target.checked)} /> LMI exempt
            </label>
          </div>
          <Actions
            onSaveTab={() => saveTab('one')}
            onLoadTab={() => loadTab('one')}
            onPdf={() =>
              exportPdfStyled({
                title: '1 Property',
                subtitle: state.one.scenarioName?.trim() || oneCalc.deal.text || 'Review assumptions and inputs.',
                atAGlance: oneCalc.atAGlance.map((x) => ({ label: x.label, value: x.value })),
                decisionRows: oneCalc.decisionGuide,
                warningRows,
                inputRows: onePdfInputRows(),
                outputRows: Object.entries(oneCalc.outputs)
                  .filter(([, value]) => String(value).trim() !== '' && String(value).trim() !== '-')
                  .map(([label, value]) => ({ label, value })),
              })
            }
            onResetTab={() => patch('one', { ...DEFAULTS.oneProperty })}
            compareLabel={oneCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, '1 Property', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={oneCalc.deal.tone} lines={[oneCalc.deal.text, oneCalc.description]} />
          <Banner tone={oneCalc.warningTone} lines={oneCalc.warnings} />
          <MetricSection title="At a Glance" items={oneCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={oneCalc.decisionGuide} />
          <DetailSection title="All Calculated Results" rows={Object.entries(oneCalc.outputs).map(([label, value]) => ({ label, value }))} />
        </section>
      </div>
    );
  };

  const renderRefi = () => {
    const compareRows = Object.entries(refiCalc.outputs).map(([k, v]) => `${k}: ${v}`);
    const warningRows = [
      { label: 'Main warning', value: refiCalc.warnings[0] || 'Please review the points below.' },
      ...refiCalc.warnings.slice(1, 7).map((value, index) => ({ label: `Note ${index + 1}`, value })),
    ];
    return (
      <div className="grid two-col">
        <section className="panel">
          <h2>Refinance</h2>
          <div className="field-grid">
            {field('Scenario name', state.refi.scenarioName, (v) => patchRefi('scenarioName', v as string))}
            {field('Current property value', state.refi.currentValue, (v) => patchRefi('currentValue', v as string), 'number')}
            {field('Current loan', state.refi.currentLoan, (v) => patchRefi('currentLoan', v as string), 'number')}
            {field('Current rate (%)', state.refi.currentRate, (v) => patchRefi('currentRate', v as string), 'number')}
            {field('Current term', state.refi.currentTerm, (v) => patchRefi('currentTerm', v as string), 'number')}
            {field('Current frequency', state.refi.currentFreq, (v) => patchRefi('currentFreq', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
            {field('New rate (%)', state.refi.newRate, (v) => patchRefi('newRate', v as string), 'number')}
            {field('New term', state.refi.newTerm, (v) => patchRefi('newTerm', v as string), 'number')}
            {field('New frequency', state.refi.newFreq, (v) => patchRefi('newFreq', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
            {field('Discharge fee', state.refi.dischargeFee, (v) => patchRefi('dischargeFee', v as string), 'number')}
            {field('Application fee', state.refi.applicationFee, (v) => patchRefi('applicationFee', v as string), 'number')}
            {field('Legal fee', state.refi.legalFee, (v) => patchRefi('legalFee', v as string), 'number')}
            {field('Valuation fee', state.refi.valuationFee, (v) => patchRefi('valuationFee', v as string), 'number')}
            {field('Government fee', state.refi.govFee, (v) => patchRefi('govFee', v as string), 'number')}
            {field('Cashback', state.refi.cashback, (v) => patchRefi('cashback', v as string), 'number')}
            {field('Extra borrow', state.refi.extraBorrow, (v) => patchRefi('extraBorrow', v as string), 'number')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field">
              <input type="checkbox" checked={state.refi.lmiExempt} onChange={(e) => patchRefi('lmiExempt', e.target.checked)} /> LMI exempt
            </label>
          </div>
          <Actions
            onSaveTab={() => saveTab('refi')}
            onLoadTab={() => loadTab('refi')}
            onPdf={() =>
              exportPdfStyled({
                title: 'Refinance',
                subtitle: state.refi.scenarioName?.trim() || refiCalc.deal.text || 'Review assumptions and inputs.',
                atAGlance: refiCalc.atAGlance.map((x) => ({ label: x.label, value: x.value })),
                decisionRows: refiCalc.decisionGuide,
                warningRows,
                inputRows: refiPdfInputRows(),
                outputRows: Object.entries(refiCalc.outputs)
                  .filter(([, value]) => String(value).trim() !== '' && String(value).trim() !== '-')
                  .map(([label, value]) => ({ label, value })),
              })
            }
            onResetTab={() => patch('refi', { ...DEFAULTS.refinance })}
            compareLabel={refiCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, 'Refinance', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={refiCalc.deal.tone} lines={[refiCalc.deal.text]} />
          <Banner tone={refiCalc.warningTone} lines={refiCalc.warnings} />
          <MetricSection title="At a Glance" items={refiCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={refiCalc.decisionGuide} />
          <DetailSection title="All Calculated Results" rows={Object.entries(refiCalc.outputs).map(([label, value]) => ({ label, value }))} />
        </section>
      </div>
    );
  };

  const renderBorrow = () => {
    const compareRows = Object.entries(borrowCalc.outputs).map(([k, v]) => `${k}: ${v}`);
    const warningRows = [
      { label: 'Main warning', value: borrowCalc.warnings[0] || 'Please review the points below.' },
      ...borrowCalc.warnings.slice(1, 7).map((value, index) => ({ label: `Note ${index + 1}`, value })),
    ];
    return (
      <div className="grid two-col">
        <section className="panel">
          <h2>Borrowing Capacity</h2>
          <div className="field-grid">
            {field('Scenario name', state.borrow.scenarioName, (v) => patchBorrow('scenarioName', v as string))}
            {field('Lender profile', state.borrow.lenderProfile, (v) => patchBorrow('lenderProfile', v as LenderProfile | ''), 'select', ['NAB-style', 'Conservative', 'Aggressive'])}
            {field('Applicant type', state.borrow.applicantType, (v) => patchBorrow('applicantType', v as ApplicantType | ''), 'select', ['Single', 'Couple'])}
            {field('Dependants', state.borrow.dependants, (v) => patchBorrow('dependants', v as string), 'number')}
            {field('Loan purpose', state.borrow.loanPurpose, (v) => patchBorrow('loanPurpose', v as LoanPurpose | ''), 'select', ['Owner Occupier', 'Investment'])}
            {field('Gross income 1', state.borrow.grossIncome1, (v) => patchBorrow('grossIncome1', v as string), 'number')}
            {field('Gross income 2', state.borrow.grossIncome2, (v) => patchBorrow('grossIncome2', v as string), 'number')}
            {field('Rental income monthly', state.borrow.rentalIncomeMonthly, (v) => patchBorrow('rentalIncomeMonthly', v as string), 'number')}
            {field('Other income annual', state.borrow.otherIncomeAnnual, (v) => patchBorrow('otherIncomeAnnual', v as string), 'number')}
            {field('Living expenses monthly', state.borrow.livingExpensesMonthly, (v) => patchBorrow('livingExpensesMonthly', v as string), 'number')}
            {field('Existing loan repayments monthly', state.borrow.existingLoanRepaymentsMonthly, (v) => patchBorrow('existingLoanRepaymentsMonthly', v as string), 'number')}
            {field('Credit card limits', state.borrow.creditCardLimits, (v) => patchBorrow('creditCardLimits', v as string), 'number')}
            {field('Other debts monthly', state.borrow.otherDebtsMonthly, (v) => patchBorrow('otherDebtsMonthly', v as string), 'number')}
            {field('Actual rate (%)', state.borrow.actualRate, (v) => patchBorrow('actualRate', v as string), 'number')}
            {field('Assessment buffer (%)', state.borrow.assessmentBufferPct, (v) => patchBorrow('assessmentBufferPct', v as string), 'number')}
            {field('Assessment floor rate (%)', state.borrow.assessmentFloorRatePct, (v) => patchBorrow('assessmentFloorRatePct', v as string), 'number')}
            {field('Loan term', state.borrow.loanTerm, (v) => patchBorrow('loanTerm', v as string), 'number')}
            {field('Target LVR (%)', state.borrow.targetLvr, (v) => patchBorrow('targetLvr', v as string), 'number')}
            {field('Rental shading (%)', state.borrow.rentalShadingPct, (v) => patchBorrow('rentalShadingPct', v as string), 'number')}
            {field('Other income shading (%)', state.borrow.otherIncomeShadingPct, (v) => patchBorrow('otherIncomeShadingPct', v as string), 'number')}
            {field('Credit card loading (%/month)', state.borrow.creditCardLoadingPct, (v) => patchBorrow('creditCardLoadingPct', v as string), 'number')}
          </div>
          <Actions
            onSaveTab={() => saveTab('borrow')}
            onLoadTab={() => loadTab('borrow')}
            onPdf={() =>
              exportPdfStyled({
                title: 'Borrowing Capacity',
                subtitle: state.borrow.scenarioName?.trim() || borrowCalc.deal.text || 'Review assumptions and inputs.',
                atAGlance: borrowCalc.borrowingSummary.map((x) => ({ label: x.label, value: x.value })),
                decisionRows: borrowCalc.decisionGuide,
                warningRows,
                inputRows: borrowPdfInputRows(),
                outputRows: Object.entries(borrowCalc.outputs)
                  .filter(([, value]) => String(value).trim() !== '' && String(value).trim() !== '-')
                  .map(([label, value]) => ({ label, value })),
              })
            }
            onResetTab={() => patch('borrow', { ...DEFAULTS.borrowing })}
            compareLabel={borrowCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, 'Borrowing Capacity', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={borrowCalc.deal.tone} lines={[borrowCalc.deal.text]} />
          <Banner tone={borrowCalc.warningTone} lines={borrowCalc.warnings} />
          <MetricSection title="Borrowing Summary" items={borrowCalc.borrowingSummary} />
          <DetailSection title="Decision Guide" rows={borrowCalc.decisionGuide} />
          <DetailSection title="All Calculated Results" rows={Object.entries(borrowCalc.outputs).map(([label, value]) => ({ label, value }))} />
        </section>
      </div>
    );
  };

  const renderCompare = () => (
    <section className="panel">
      <h2>Compare</h2>
      <div className="compare-grid">
        {(['A', 'B', 'C'] as CompareSlot[]).map((slot) => (
          <div className="compare-card" key={slot}>
            <div className="compare-head">
              <div className="compare-title">Slot {slot}</div>
              <button className="ghost" onClick={() => saveCompare(slot, '', [])}>
                Clear
              </button>
            </div>
            {state.compare[slot] ? (
              <>
                <div>
                  <strong>{state.compare[slot]?.title}</strong>
                </div>
                <div className="detail-list compact">
                  {state.compare[slot]?.body.slice(0, 12).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </>
            ) : (
              <div className="muted">Save a tab into this slot.</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  const renderSettings = () => (
    <div className="grid two-col">
      <section className="panel">
        <h2>Branding, Profiles & Defaults</h2>
        <div className="field-grid">
          {field('Brand name', state.meta.brandName, (v) => patchMeta('brandName', v as string))}
          <label className="field"><span>Broker name</span><input type="text" value={state.meta.brokerName} readOnly /></label>
          {field('Local profile case name', profileNameDraft, (v) => setProfileNameDraft(v as string))}
          {field('Property one name', state.meta.propertyOneName, (v) => patchMeta('propertyOneName', v as string))}
          {field('Property two name', state.meta.propertyTwoName, (v) => patchMeta('propertyTwoName', v as string))}
        </div>
        <div className="button-row">
          <button onClick={saveWhole}>Save whole file</button>
          <button className="secondary" onClick={loadWhole}>
            Load whole file
          </button>
          {state.meta.brokerName !== 'Guest' && (
            <button className="secondary" onClick={saveToProfile}>
              Save to Profile
            </button>
          )}
          <button className="secondary" onClick={changeBroker}>
            Change Broker / Guest
          </button>
          <button className="secondary" onClick={() => { setState(blankState()); setProfileNameDraft(''); setBrokerDraft(''); setStartupStep('broker'); }}>
            Reset everything
          </button>
        </div>
        {state.meta.brokerName !== 'Guest' && (
          <div className="profile-list">
            <div className="profile-list-title">Saved local profiles for {state.meta.brokerName || 'Broker'}</div>
            <label className="field profile-search-field">
              <span>Search saved cases</span>
              <input type="text" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} placeholder="Search by case name..." />
            </label>
            {brokerProfiles.length ? brokerProfiles.map((profile) => (
              <div className="profile-row" key={profile.id}>
                <div>
                  <div className="profile-name">{profile.caseName}</div>
                  <div className="profile-meta">{new Date(profile.savedAt).toLocaleString()}</div>
                </div>
                <div className="profile-actions">
                  <button className="secondary" onClick={() => loadProfileById(profile.id)}>Load</button>
                  <button className="secondary" onClick={() => renameProfileById(profile.id)}>Rename</button>
                  <button className="secondary" onClick={() => duplicateProfileById(profile.id)}>Duplicate</button>
                  <button className="ghost danger" onClick={() => deleteProfileById(profile.id)}>Delete</button>
                </div>
              </div>
            )) : <div className="muted">No local profiles matched for this broker yet.</div>}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Deployment notes</h2>
        <ul className="feature-list">
          <li>After changing files, test locally with <code>npm run dev</code>.</li>
          <li>Then push to GitHub and run <code>npm run deploy</code> for the gh-pages branch.</li>
          <li>Guest mode skips broker profile storage, but manual tab and file save/load still work.</li>
        </ul>
        <p className="muted">{DISCLAIMER}</p>
      </section>
    </div>
  );


  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Mortgage workflow dashboard</div>
          <h1>{state.meta.brandName || 'XYZ Finance Specialists'}</h1>
          <p>Live GitHub-hosted calculator with per-tab save/load, branded PDFs, and parity-focused summary blocks.</p>
        </div>
        <div className="header-badge">Broker: {state.meta.brokerName || '—'}</div>
      </header>

      <nav className="tabs">
        {TAB_KEYS.map((item) => (
          <button key={item.key} className={`tab ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'home' && renderHome()}
        {tab === 'one' && renderOne()}
        {tab === 'two' && (
          <section className="panel">
            <h2>2 Properties</h2>
            <p>This tab is still simpler than the desktop version. I left it mostly untouched while the parity work focused on 1 Property, Refinance, and Borrowing Capacity first.</p>
          </section>
        )}
        {tab === 'refi' && renderRefi()}
        {tab === 'borrow' && renderBorrow()}
        {tab === 'compare' && renderCompare()}
        {tab === 'settings' && renderSettings()}
      </main>

      {startupStep !== 'ready' && (
        <div className="startup-overlay">
          <div className="startup-card">
            {startupStep === 'broker' && (
              <>
                <div className="eyebrow">Welcome</div>
                <h2>Please enter Broker Name before proceeding</h2>
                <p>
                  Broker mode gives access to local saved profiles. Guest mode skips profile storage but still allows manual save/load in the tabs.
                </p>
                <label className="field startup-field">
                  <span>Broker Name</span>
                  <input
                    autoFocus
                    type="text"
                    value={brokerDraft}
                    onChange={(e) => setBrokerDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && brokerDraft.trim()) enterBrokerMode();
                    }}
                  />
                </label>
                <div className="startup-actions">
                  <button onClick={enterBrokerMode} disabled={!brokerDraft.trim()}>
                    Continue
                  </button>
                </div>
                <button className="startup-link" onClick={continueAsGuest}>
                  Continue as Guest
                </button>
              </>
            )}

            {startupStep === 'brokerMenu' && (
              <>
                <div className="eyebrow">Welcome, {state.meta.brokerName}</div>
                <h2>Choose how you’d like to continue</h2>
                <div className="startup-menu">
                  <button onClick={createNewCase}>Create New Case</button>
                  <button className="secondary" onClick={() => setStartupStep('brokerLoad')}>
                    Load Saved Case
                  </button>
                </div>
                <button className="startup-link" onClick={changeBroker}>
                  Use a different broker name
                </button>
              </>
            )}

            {startupStep === 'brokerLoad' && (
              <>
                <div className="eyebrow">Saved local profiles</div>
                <h2>Load Saved Case</h2>
                <label className="field startup-field">
                  <span>Search saved cases</span>
                  <input
                    type="text"
                    value={profileSearch}
                    onChange={(e) => setProfileSearch(e.target.value)}
                    placeholder="Search by case name..."
                  />
                </label>
                {brokerProfiles.length ? (
                  <div className="startup-profile-list">
                    {brokerProfiles.map((profile) => (
                      <div className="startup-profile-card" key={profile.id}>
                        <button className="startup-profile-row" onClick={() => loadProfileById(profile.id)}>
                          <span>
                            <strong>{profile.caseName}</strong>
                            <small>{new Date(profile.savedAt).toLocaleString()}</small>
                          </span>
                          <span>Load</span>
                        </button>
                        <div className="startup-profile-actions">
                          <button className="secondary" onClick={() => renameProfileById(profile.id)}>Rename</button>
                          <button className="secondary" onClick={() => duplicateProfileById(profile.id)}>Duplicate</button>
                          <button className="ghost danger" onClick={() => deleteProfileById(profile.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No local profiles matched for {state.meta.brokerName} yet.</p>
                )}
                <div className="startup-menu">
                  <button onClick={createNewCase}>Create New Case</button>
                  <button className="secondary" onClick={() => setStartupStep('brokerMenu')}>
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
