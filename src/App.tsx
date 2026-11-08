
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseEnabled, type AuthUser } from './supabaseClient';
import { jsPDF } from 'jspdf';
import { AUSTRALIAN_STATES, type AustralianState, type HomeKind } from './duty';
import './styles.css';
import PublicWebsite from './PublicWebsite';
import CalculatorsPage from './CalculatorsPage';
import GuestCalculatorPage, { type GuestTool } from './GuestCalculatorPage';
import BrokerInfoPage from './BrokerInfoPage';
import { SITE_CONFIG } from './site-config';
import { formatMoneyInput, parseMoneyInput } from './money-input';
import {
  DEFAULTS,
  DISCLAIMER,
  calcBorrowing,
  calcOneProperty,
  calcTwoProperties,
  calcRefinance,
  type AlertTone,
  type ApplicantType,
  type BorrowingInputs,
  type Frequency,
  type LenderProfile,
  type LoanPurpose,
  type OnePropertyInputs,
  type PurchaseType,
  type TwoPropertyInputs,
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

type StartupStep = 'auth' | 'brokerMenu' | 'brokerLoad' | 'ready';
type UserRole = 'owner' | 'broker' | 'assistant';
type AccessLevel = 'view' | 'edit' | 'owner';

type AppProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: string;
};

type SavedProfile = {
  id: string;
  brokerName: string;
  caseName: string;
  savedAt: string;
  state: SavedState;
  source: 'local' | 'cloud' | 'shared';
  ownerId?: string;
  ownerEmail?: string;
  accessLevel?: AccessLevel;
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

export function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  return <input type="text" inputMode="decimal" value={focused ? value : formatMoneyInput(value)}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    onChange={(event) => { const next = parseMoneyInput(event.target.value); if (next !== null) onChange(next); }} />;
}

const field = <T extends string | boolean>(
  label: string,
  value: T,
  onChange: (value: T) => void,
  type: 'text' | 'number' | 'money' | 'select' = 'text',
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
  if (type === 'money') return <label className="field"><span>{label}</span><MoneyInput value={String(value)} onChange={(next) => onChange(next as T)} /></label>;
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} inputMode={type === 'number' ? 'decimal' : undefined} value={String(value)} onChange={(e) => onChange(e.target.value as T)} />
    </label>
  );
};

const niceNow = () => new Date().toISOString();
const makeProfileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const brokerNameFromUser = (user: AuthUser | null, fallback = 'Broker') => {
  const fullName =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim();
  if (fullName) return fullName;
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) return fallback;
  const local = email.split('@')[0] || fallback;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

function getStoredProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredProfiles(profiles: SavedProfile[]) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function Banner({ tone, lines }: { tone: AlertTone; lines: string[] }) {
  return (
    <div className={`banner ${tone}`}>
      <div>{lines[0]}</div>
      {lines.length > 1 && <ul className="banner-list">{lines.slice(1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
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

export function Actions({
  guest,
  onSaveTab,
  onLoadTab,
  onPdf,
  onResetTab,
  resultsReady = true,
  compareLabel,
  onCompare,
}: {
  guest: boolean;
  onSaveTab: () => void;
  onLoadTab: () => void;
  onPdf: () => void;
  onResetTab: () => void;
  resultsReady?: boolean;
  compareLabel: string;
  onCompare: (slot: CompareSlot) => void;
}) {
  if (guest) return <div className="button-row"><button className="secondary" onClick={onResetTab}>Reset calculator</button></div>;
  return (
    <div className="button-row">
      <button disabled={!resultsReady} onClick={() => onCompare('A')}>Save to Compare A</button>
      <button className="secondary" disabled={!resultsReady} onClick={() => onCompare('B')}>
        Save to Compare B
      </button>
      <button className="secondary" disabled={!resultsReady} onClick={() => onCompare('C')}>
        Save to Compare C
      </button>
      <button className="secondary" onClick={onSaveTab}>
        Save this tab
      </button>
      <button className="secondary" onClick={onLoadTab}>
        Load this tab
      </button>
      <button className="secondary" onClick={onPdf} disabled={!resultsReady}>
        Export PDF
      </button>
      <button className="secondary" onClick={onResetTab}>
        Reset tab
      </button>
      <span className="toolbar-note">{resultsReady ? compareLabel : 'Complete the required inputs to export or compare.'}</span>
    </div>
  );
}

const INPUT_LABELS_ONE: Record<string, string> = {
  scenarioName: 'Scenario name',
  purchaseType: 'Purchase type',
  state: 'State or territory',
  homeKind: 'Property type',
  firstHomeReliefOptOut: 'First-home duty relief switched off',
  ntPackageEligible: 'NT house-and-land package exemption assumed eligible',
  lmiBasis: 'LMI waiver basis',
  schemeArea: '5% Scheme area',
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

const INPUT_LABELS_TWO: Record<string, string> = {
  scenarioName: 'Scenario name',
  interestRate: 'Interest rate (%)',
  loanTerm: 'Loan term (years)',
  currentMortgage: 'Current mortgage',
  currentValue: 'Current property value',
  secondPrice: 'Second house price',
  state: 'New property state or territory',
  secondPurpose: 'New property use',
  crossCollat: 'Cross-collateralisation for LMI',
  desiredLvr: 'Desired consolidated LVR (%)',
  withdraw80: 'Withdraw equity to 80%',
  currentRent: 'Current total monthly rent',
  newRent: 'New property monthly rent',
  approvalMax: 'Loan approval maximum',
  lmiExempt: 'LMI exempt',
  exemptCap: 'LMI exempt cap (%)',
  yearlyIncome: 'Yearly income',
  annualPropertyCosts: 'Annual property costs',
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
  lenderProfile: 'Illustrative assumption profile',
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
  helpRepaymentsMonthly: 'HELP repayments monthly',
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
  const [showPublicWebsite, setShowPublicWebsite] = useState(true);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);
  const [startupStep, setStartupStep] = useState<StartupStep>('auth');
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => getStoredProfiles());
  const [profileNameDraft, setProfileNameDraft] = useState(state.caseName || '');
  const [profileSearch, setProfileSearch] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const [storageMode, setStorageMode] = useState<'cloud' | 'local'>(supabaseEnabled ? 'cloud' : 'local');
  const [currentProfile, setCurrentProfile] = useState<AppProfile | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCaseOwnerId, setActiveCaseOwnerId] = useState<string | null>(null);
  const [activeAccessLevel, setActiveAccessLevel] = useState<AccessLevel | null>(null);

  const isCalculatorsPage = typeof window !== 'undefined' && /^\/calculators\/?$/.test(window.location.pathname);
  const isServicesPage = typeof window !== 'undefined' && /^\/how-we-can-help\/?$/.test(window.location.pathname);
  const isApproachPage = typeof window !== 'undefined' && /^\/our-approach\/?$/.test(window.location.pathname);
  useEffect(() => { document.title = isCalculatorsPage ? `Calculators | ${SITE_CONFIG.businessName}` : isServicesPage ? `How we can help | ${SITE_CONFIG.businessName}` : isApproachPage ? `Our approach | ${SITE_CONFIG.businessName}` : `${SITE_CONFIG.businessName} | Home Loans & Mortgage Broking`; }, [isCalculatorsPage, isServicesPage, isApproachPage]);
  useEffect(() => {
    if (!showPublicWebsite) return;
    const anchor = window.location.hash.slice(1);
    if (!anchor || anchor.startsWith('calculator-') || anchor === 'broker-login') return;
    const frame = window.requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [showPublicWebsite, isCalculatorsPage]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setProfiles(getStoredProfiles());
  }, []);

  const ensureProfile = async (user: AuthUser): Promise<AppProfile | null> => {
    if (!supabaseEnabled) return null;

    const fallbackName = brokerNameFromUser(user);
    const selectCols = 'id, email, full_name, role, status';

    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select(selectCols)
      .eq('id', user.id)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      setAuthMessage(existingError.message || 'Could not load your profile.');
      return null;
    }

    if (existing) {
      return existing as AppProfile;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        full_name: fallbackName,
        role: 'broker',
        status: 'active',
      })
      .select(selectCols)
      .single();

    if (insertError) {
      setAuthMessage(insertError.message || 'Could not create your profile.');
      return null;
    }

    return inserted as AppProfile;
  };

  const refreshProfiles = async (userOverride?: AuthUser | null, profileOverride?: AppProfile | null) => {
    const user = userOverride === undefined ? currentUser : userOverride;
    const profile = profileOverride === undefined ? currentProfile : profileOverride;

    if (supabaseEnabled && user) {
      const effectiveProfile = profile ?? (await ensureProfile(user));
      if (!effectiveProfile) return;

      const ownerNameFallback = effectiveProfile.full_name?.trim() || brokerNameFromUser(user);
      const next: SavedProfile[] = [];
      const ownerIds = new Set<string>();

      if (effectiveProfile.role === 'owner') {
        const { data, error } = await supabase
          .from('broker_cases')
          .select('id, owner_id, case_name, app_state, updated_at')
          .order('updated_at', { ascending: false });

        if (error) {
          setAuthMessage(error.message || 'Cloud case sync failed.');
        } else if (Array.isArray(data)) {
          data.forEach((row: any) => {
            ownerIds.add(String(row.owner_id || ''));
            next.push({
              id: row.id,
              brokerName: row.app_state?.meta?.brokerName || ownerNameFallback,
              caseName: row.case_name || 'Untitled Case',
              savedAt: row.updated_at || niceNow(),
              state: { ...blankState(), ...(row.app_state || {}), caseName: row.case_name || 'Untitled Case' },
              source: 'cloud',
              ownerId: row.owner_id,
              accessLevel: 'owner',
            });
          });
        }
      } else {
        const { data: ownData, error: ownError } = await supabase
          .from('broker_cases')
          .select('id, owner_id, case_name, app_state, updated_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false });

        if (ownError) {
          setAuthMessage(ownError.message || 'Cloud case sync failed.');
        } else if (Array.isArray(ownData)) {
          ownData.forEach((row: any) => {
            ownerIds.add(String(row.owner_id || ''));
            next.push({
              id: row.id,
              brokerName: row.app_state?.meta?.brokerName || ownerNameFallback,
              caseName: row.case_name || 'Untitled Case',
              savedAt: row.updated_at || niceNow(),
              state: { ...blankState(), ...(row.app_state || {}), caseName: row.case_name || 'Untitled Case' },
              source: 'cloud',
              ownerId: row.owner_id,
              accessLevel: 'owner',
            });
          });
        }

        const { data: sharedData, error: sharedError } = await supabase
          .from('case_access')
          .select('access_level, broker_cases!inner(id, owner_id, case_name, app_state, updated_at)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (sharedError) {
          setAuthMessage(sharedError.message || 'Shared case sync failed.');
        } else if (Array.isArray(sharedData)) {
          sharedData.forEach((row: any) => {
            const caseRow = Array.isArray(row.broker_cases) ? row.broker_cases[0] : row.broker_cases;
            if (!caseRow) return;
            ownerIds.add(String(caseRow.owner_id || ''));
            next.push({
              id: caseRow.id,
              brokerName: caseRow.app_state?.meta?.brokerName || 'Shared Case',
              caseName: caseRow.case_name || 'Untitled Case',
              savedAt: caseRow.updated_at || niceNow(),
              state: { ...blankState(), ...(caseRow.app_state || {}), caseName: caseRow.case_name || 'Untitled Case' },
              source: 'shared',
              ownerId: caseRow.owner_id,
              accessLevel: row.access_level === 'edit' ? 'edit' : 'view',
            });
          });
        }
      }

      if (ownerIds.size) {
        const ids = Array.from(ownerIds).filter(Boolean);
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ids);

        const ownerMap = new Map<string, string>();
        (ownerProfiles || []).forEach((row: any) => {
          ownerMap.set(row.id, row.full_name || row.email || row.id);
        });

        next.forEach((profileRow) => {
          if (profileRow.ownerId) {
            profileRow.ownerEmail = ownerMap.get(profileRow.ownerId) || profileRow.ownerId;
            if (effectiveProfile.role === 'owner' && profileRow.ownerId !== user.id) {
              profileRow.brokerName = profileRow.ownerEmail || profileRow.brokerName;
            }
          }
        });
      }

      if (authUserIdRef.current === user.id) setProfiles(next);
      return;
    }

    setProfiles(getStoredProfiles());
  };


  useEffect(() => {
    let active = true;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!supabaseEnabled) {
      setStorageMode('local');
      return;
    }

    // Defer database requests until after Supabase releases its auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      const user = session?.user ?? null;
      setAuthReady(true);
      if (event === 'SIGNED_IN' && user && authUserIdRef.current === user.id) return;
      const request = ++generation;
      if (timer) clearTimeout(timer);
      authUserIdRef.current = user?.id ?? null;
      setCurrentUser(user);
      setStorageMode(user ? 'cloud' : 'local');
      if (!user) {
        setCurrentProfile(null);
        setProfiles([]);
        setStartupStep('auth');
        return;
      }
      setAuthMessage('');
      timer = setTimeout(() => {
        void (async () => {
          try {
            const profile = await ensureProfile(user);
            if (!active || generation !== request) return;
            setCurrentProfile(profile);
            const brokerName = profile?.full_name?.trim() || brokerNameFromUser(user);
            setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName } }));
            setStartupStep('brokerMenu');
            if (profile) await refreshProfiles(user, profile);
          } catch (error) {
            if (active && generation === request) {
              setAuthMessage(error instanceof Error ? error.message : 'Could not load your account.');
              setStartupStep('brokerMenu');
            }
          }
        })();
      }, 0);
    });
    return () => {
      active = false;
      generation++;
      if (timer) clearTimeout(timer);
      authUserIdRef.current = null;
      subscription.unsubscribe();
    };
  }, []);

  const oneCalc = useMemo(() => calcOneProperty(state.one), [state.one]);
  const twoCalc = useMemo(() => calcTwoProperties(state.two), [state.two]);
  const refiCalc = useMemo(() => calcRefinance(state.refi), [state.refi]);
  const borrowCalc = useMemo(() => calcBorrowing(state.borrow), [state.borrow]);

  const patch = <K extends keyof SavedState>(key: K, value: SavedState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));
  const patchOne = <K extends keyof OnePropertyInputs>(key: K, value: OnePropertyInputs[K]) =>
    patch('one', { ...state.one, [key]: value });
  const patchTwo = <K extends keyof TwoPropertyInputs>(key: K, value: TwoPropertyInputs[K]) =>
    patch('two', { ...state.two, [key]: value });
  const patchRefi = <K extends keyof RefinanceInputs>(key: K, value: RefinanceInputs[K]) =>
    patch('refi', { ...state.refi, [key]: value });
  const patchBorrow = <K extends keyof BorrowingInputs>(key: K, value: BorrowingInputs[K]) =>
    patch('borrow', { ...state.borrow, [key]: value });
  const patchMeta = <K extends keyof typeof DEFAULTS.meta>(key: K, value: (typeof DEFAULTS.meta)[K]) =>
    patch('meta', { ...state.meta, [key]: value });

  const brokerProfiles = profiles
    .filter((profile) => {
      if (profile.source !== 'local') return true;
      return profile.brokerName === (state.meta.brokerName || '');
    })
    .filter((profile) => {
      const q = profileSearch.trim().toLowerCase();
      if (!q) return true;
      return profile.caseName.toLowerCase().includes(q) || profile.savedAt.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  const handleAuthSubmit = async () => {
    if (!supabaseEnabled) {
      setAuthMessage('Supabase is not configured yet. Use the calculators as a guest or check the account configuration.');
      return;
    }
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      setAuthMessage('Please enter both email and password.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthPassword('');
    } catch (error: any) {
      setAuthMessage(error?.message || 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };


  const continueAsGuest = () => {
    setCurrentUser(null);
    setCurrentProfile(null);
    setActiveCaseId(null);
    setActiveCaseOwnerId(null);
    setActiveAccessLevel(null);
    setStorageMode('local');
    setState((prev) => {
      if (prev.meta.brokerName === 'Guest') return prev;
      // Keep a recovery copy and avoid showing a previous broker's case to a guest on this browser.
      try { localStorage.setItem(`${STORAGE_KEY}-previous-workspace`, JSON.stringify(prev)); } catch { /* storage may be unavailable */ }
      const fresh = blankState();
      fresh.meta.brandName = SITE_CONFIG.businessName;
      fresh.meta.brokerName = 'Guest';
      return fresh;
    });
    setProfileSearch('');
    setStartupStep('ready');
  };

  const openPublicCalculator = (key: 'one' | 'two' | 'refi' | 'borrow', navigate = true) => {
    if (!authReady) return;
    if (navigate) window.history.pushState(null, '', `#calculator-${key}`);
    setShowPublicWebsite(false);
    setTab(key);
    if (currentUser) setStartupStep('ready');
    else continueAsGuest();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  const openBrokerSignIn = (navigate = true) => {
    if (!authReady) return;
    if (navigate) window.history.pushState(null, '', '#broker-login');
    setShowPublicWebsite(false);
    setStartupStep(currentUser ? 'brokerMenu' : 'auth');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };


  useEffect(() => {
    if (!authReady) return;
    const syncPageWithAddress = () => {
      const hash = window.location.hash;
      const tool = hash.match(/^#calculator-(one|two|refi|borrow)$/)?.[1] as 'one' | 'two' | 'refi' | 'borrow' | undefined;
      if (tool) openPublicCalculator(tool, false);
      else if (hash === '#broker-login') openBrokerSignIn(false);
      else setShowPublicWebsite(true);
    };
    syncPageWithAddress();
    window.addEventListener('popstate', syncPageWithAddress);
    return () => window.removeEventListener('popstate', syncPageWithAddress);
  }, [authReady, currentUser?.id]);


  const createNewCase = () => {
    const brokerName = currentProfile?.full_name?.trim() || (currentUser ? brokerNameFromUser(currentUser) : state.meta.brokerName || 'Guest');
    const fresh = blankState();
    fresh.meta.brandName = state.meta.brandName;
    fresh.meta.propertyOneName = state.meta.propertyOneName;
    fresh.meta.propertyTwoName = state.meta.propertyTwoName;
    fresh.meta.brokerName = brokerName;
    setState(fresh);
    setProfileNameDraft('');
    setProfileSearch('');
    setActiveCaseId(null);
    setActiveCaseOwnerId(null);
    setActiveAccessLevel(null);
    setTab('home');
    setStartupStep('ready');
  };

  const loadProfileById = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const next = { ...blankState(), ...profile.state, caseName: profile.caseName };
    next.meta = {
      ...blankState().meta,
      ...profile.state.meta,
      brokerName:
        profile.source === 'shared'
          ? currentProfile?.full_name?.trim() || state.meta.brokerName
          : profile.brokerName,
    };
    setState(next);
    setProfileNameDraft(profile.caseName || '');
    setProfileSearch('');
    setActiveCaseId(profile.id);
    setActiveCaseOwnerId(profile.ownerId || null);
    setActiveAccessLevel(profile.accessLevel || (profile.source === 'shared' ? 'view' : 'owner'));
    setTab('home');
    setStartupStep('ready');
  };


  const saveProfilesLocal = (next: SavedProfile[]) => {
    setProfiles(next);
    saveStoredProfiles(next.filter((item) => item.source === 'local'));
  };

  const canEditCloudCase = (profile: SavedProfile) =>
    !!currentUser &&
    profile.source !== 'local' &&
    (currentProfile?.role === 'owner' ||
      profile.ownerId === currentUser.id ||
      profile.accessLevel === 'edit');

  const canManageSharing = (profile: SavedProfile) =>
    !!currentUser &&
    profile.source !== 'local' &&
    (currentProfile?.role === 'owner' || profile.ownerId === currentUser.id);


  const saveToProfile = async () => {
    const caseName = (
      profileNameDraft ||
      state.caseName ||
      state.one.scenarioName ||
      state.two.scenarioName ||
      state.refi.scenarioName ||
      state.borrow.scenarioName ||
      'Untitled Case'
    ).trim();

    const nextState = { ...state, caseName };

    if (supabaseEnabled && currentUser) {
      if (activeCaseId && activeAccessLevel === 'view' && currentProfile?.role !== 'owner') {
        setAuthMessage('This case is view-only. Duplicate it to save your own copy.');
        return;
      }
      const editableLoadedCase =
        !!activeCaseId &&
        (currentProfile?.role === 'owner' ||
          activeCaseOwnerId === currentUser.id ||
          activeAccessLevel === 'edit');

      if (editableLoadedCase && activeCaseId) {
        const { data: savedCase, error } = await supabase
          .from('broker_cases')
          .update({
            case_name: caseName,
            app_state: nextState,
            updated_at: niceNow(),
          })
          .eq('id', activeCaseId)
          .select('id')
          .maybeSingle();

        if (error || !savedCase) {
          setAuthMessage(error?.message || 'The case was not saved. Check your access and try again.');
          return;
        }

        setState((prev) => ({ ...prev, caseName }));
        setProfileNameDraft(caseName);
        await refreshProfiles(currentUser, currentProfile);
        return;
      }

      const payload = {
        owner_id: currentUser.id,
        case_name: caseName,
        app_state: nextState,
        updated_at: niceNow(),
      };

      const { error } = await supabase.from('broker_cases').upsert(payload, {
        onConflict: 'owner_id,case_name',
      });

      if (error) {
        setAuthMessage(error.message || 'Cloud save failed.');
        return;
      }

      if (activeCaseId && activeAccessLevel === 'view') {
        setAuthMessage('View-only shared case saved as your own copy.');
      }

      setActiveCaseId(null);
      setActiveCaseOwnerId(currentUser.id);
      setActiveAccessLevel('owner');
      setState((prev) => ({ ...prev, caseName }));
      setProfileNameDraft(caseName);
      await refreshProfiles(currentUser, currentProfile);
      return;
    }

    if ((state.meta.brokerName || '') === 'Guest') return;
    const brokerName = (state.meta.brokerName || '').trim() || 'Guest';
    const profile: SavedProfile = {
      id: makeProfileId(),
      brokerName,
      caseName,
      savedAt: niceNow(),
      state: nextState,
      source: 'local',
      accessLevel: 'owner',
    };
    const next = [profile, ...profiles.filter((item) => !(item.source === 'local' && item.brokerName === brokerName && item.caseName === caseName))];
    saveProfilesLocal(next);
    setState((prev) => ({ ...prev, caseName }));
    setProfileNameDraft(caseName);
  };


  const deleteProfileById = async (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    if (profile.source !== 'local' && supabaseEnabled && currentUser) {
      const canDelete =
        currentProfile?.role === 'owner' || profile.ownerId === currentUser.id;
      if (!canDelete) {
        setAuthMessage('You do not have permission to delete this case.');
        return;
      }
      const { data: deletedCase, error } = await supabase.from('broker_cases').delete().eq('id', id).select('id').maybeSingle();
      if (error || !deletedCase) {
        setAuthMessage(error?.message || 'The case was not deleted. Check your access and try again.');
        return;
      }
      await refreshProfiles(currentUser, currentProfile);
      return;
    }
    const next = profiles.filter((profile) => profile.id !== id);
    saveProfilesLocal(next);
  };


  const renameProfileById = async (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const nextName = window.prompt('Rename saved case', profile.caseName)?.trim();
    if (!nextName) return;

    if (profile.source !== 'local' && supabaseEnabled && currentUser) {
      if (!canEditCloudCase(profile)) {
        setAuthMessage('You do not have permission to rename this case.');
        return;
      }
      const { data: renamedCase, error } = await supabase
        .from('broker_cases')
        .update({ case_name: nextName, updated_at: niceNow(), app_state: { ...profile.state, caseName: nextName } })
        .eq('id', id).select('id').maybeSingle();
      if (error || !renamedCase) {
        setAuthMessage(error?.message || 'The case was not renamed. Check your access and try again.');
        return;
      }
      if (state.caseName === profile.caseName) {
        setState((prev) => ({ ...prev, caseName: nextName }));
        setProfileNameDraft(nextName);
      }
      await refreshProfiles(currentUser, currentProfile);
      return;
    }

    const next = profiles.map((item) =>
      item.id === id
        ? { ...item, caseName: nextName, savedAt: niceNow(), state: { ...item.state, caseName: nextName } }
        : item,
    );
    saveProfilesLocal(next);
    if (state.caseName === profile.caseName && state.meta.brokerName === profile.brokerName) {
      setState((prev) => ({ ...prev, caseName: nextName }));
      setProfileNameDraft(nextName);
    }
  };


  const duplicateProfileById = async (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const nextName = window.prompt('Duplicate case as', `${profile.caseName} Copy`)?.trim();
    if (!nextName) return;

    if (profile.source !== 'local' && supabaseEnabled && currentUser) {
      const { error } = await supabase.from('broker_cases').insert({
        owner_id: currentUser.id,
        case_name: nextName,
        app_state: { ...profile.state, caseName: nextName },
      });
      if (error) {
        setAuthMessage(error.message || 'Duplicate failed.');
        return;
      }
      await refreshProfiles(currentUser, currentProfile);
      return;
    }

    const duplicate: SavedProfile = {
      ...profile,
      id: makeProfileId(),
      caseName: nextName,
      savedAt: niceNow(),
      state: { ...profile.state, caseName: nextName },
      source: 'local',
      accessLevel: 'owner',
    };
    saveProfilesLocal([duplicate, ...profiles]);
  };

  const shareCaseById = async (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile || !currentUser || !supabaseEnabled) return;
    if (!canManageSharing(profile)) {
      setAuthMessage('You do not have permission to share this case.');
      return;
    }

    const email = window.prompt('Share this case with which internal user email?')?.trim().toLowerCase();
    if (!email) return;

    const rawAccess = window.prompt('Access level: type "view" or "edit"', 'view')?.trim().toLowerCase();
    if (!rawAccess) return;
    if (rawAccess !== 'view' && rawAccess !== 'edit') {
      setAuthMessage('Enter view or edit as the access level.');
      return;
    }
    const accessLevel: 'view' | 'edit' = rawAccess;

    const { data: targetId, error: targetError } = await supabase
      .rpc('find_share_recipient', { target_email: email });

    if (targetError) {
      setAuthMessage(targetError.message || 'Could not find that user.');
      return;
    }
    if (!targetId) {
      setAuthMessage('That user has not signed in yet, so they do not have a profile to share with.');
      return;
    }
    if (targetId === profile.ownerId) {
      setAuthMessage('The case owner already has access.');
      return;
    }

    const { error } = await supabase.from('case_access').upsert(
      {
        case_id: profile.id,
        user_id: targetId,
        access_level: accessLevel,
        granted_by: currentUser.id,
      },
      { onConflict: 'case_id,user_id' },
    );

    if (error) {
      setAuthMessage(error.message || 'Share failed.');
      return;
    }

    setAuthMessage(`Shared "${profile.caseName}" with ${email} as ${accessLevel}.`);
  };


  const signOutOrChangeAccount = async () => {
    window.history.replaceState(null, '', '#broker-login');
    setProfileSearch('');
    if (supabaseEnabled && currentUser) {
      const { error } = await supabase.auth.signOut();
      if (error) { setAuthMessage(error.message); return; }
    }
    setCurrentUser(null);
    setCurrentProfile(null);
    setActiveCaseId(null);
    setActiveCaseOwnerId(null);
    setActiveAccessLevel(null);
    setStorageMode('local');
    setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName: '' } }));
    setStartupStep('auth');
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

  const saveTab = (key: 'one' | 'two' | 'refi' | 'borrow') => saveJson(`${key}-tab.json`, state[key]);
  const loadTab = (key: 'one' | 'two' | 'refi' | 'borrow') =>
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
      doc.text(state.meta.brandName || SITE_CONFIG.businessName, left, 292);
    };

    const addHeader = (firstPage = true) => {
      doc.setFillColor(18, 32, 51);
      doc.roundedRect(left, y - 6, right - left, firstPage ? 26 : 18, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(firstPage ? 18 : 14);
      doc.text(state.meta.brandName || SITE_CONFIG.businessName, left + 6, y + (firstPage ? 4 : 1));
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
      .filter(([key, value]) => key !== 'firstHomeEligible' && String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_ONE[key] || key, value: key === 'purchaseType' && value === 'FHOG' ? 'First home buyer' : String(value) }));
    if (state.one.scenarioName?.trim()) entries.unshift({ label: 'Scenario name', value: state.one.scenarioName.trim() });
    return entries;
  };

  const twoPdfInputRows = () =>
    Object.entries(state.two)
      .filter(([, value]) => String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_TWO[key] || key, value: String(value) }));

  const refiPdfInputRows = () =>
    Object.entries(state.refi)
      .filter(([, value]) => String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_REFI[key] || key, value: String(value) }));

  const borrowPdfInputRows = () =>
    Object.entries(state.borrow)
      .filter(([, value]) => String(value).trim() !== '')
      .map(([key, value]) => ({ label: INPUT_LABELS_BORROW[key] || key, value: key === 'lenderProfile' && value ? `${value === 'NAB-style' ? 'Baseline' : String(value)} (illustrative)` : String(value) }));

  const saveCompare = (slot: CompareSlot, title: string, rows: string[]) => {
    patch('compare', { ...state.compare, [slot]: { title, body: rows } });
  };

  const renderHome = () => (
    <div className="home-layout">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="eyebrow">YOUR SCENARIO WORKSPACE</div>
          <h2>Make the next move<br /><span>with more clarity.</span></h2>
          <p>Explore the numbers, compare your options and build a clearer picture for every client.</p>
          <button className="hero-action" onClick={() => setTab('one')}>Start a property scenario <span aria-hidden="true">↗</span></button>
        </div>
        <div className="home-hero-aside" aria-hidden="true"><span>THE BIG PICTURE</span><strong>One decision.<br />More possibilities.</strong><div className="hero-orbit">↗</div></div>
      </section>
      <div className="home-heading"><div><div className="eyebrow">YOUR TOOLS</div><h2>What are you working on?</h2></div><p>Choose a starting point. You can compare scenarios as you go.</p></div>
      <div className="workflow-grid">
        {([
          ['one', '01', 'Buying a property', 'Estimate a purchase or explore your maximum price.'],
          ['two', '02', 'Adding a property', 'Explore a second purchase alongside an existing property.'],
          ['refi', '03', 'Refinancing', 'Compare a new loan with your current arrangements.'],
          ['borrow', '04', 'Borrowing capacity', 'Get an indicative view of income and commitments.'],
        ] as Array<[TabKey, string, string, string]>).map(([key, number, title, description]) => (
          <button className="workflow-card" key={key} onClick={() => setTab(key)}><span className="workflow-number">{number}</span><span className="workflow-arrow" aria-hidden="true">↗</span><strong>{title}</strong><span>{description}</span></button>
        ))}
      </div>
      <p className="home-footnote">Estimates are a starting point. Check eligibility, lender policy and current costs before making decisions.</p>
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
        <section className="panel scenario-panel">
          <div className="scenario-heading"><div><div className="eyebrow">PROPERTY SCENARIO</div><h2>Let's run the numbers.</h2><p>Start with your goal, then add the details you know.</p></div></div>
          <fieldset className="mode-picker"><legend>What would you like to work out?</legend>
            <label className={`mode-option ${!state.one.maxPurchaseMode ? 'selected' : ''}`}><input type="radio" name="purchase-mode" checked={!state.one.maxPurchaseMode} onChange={() => patchOne('maxPurchaseMode', false)} /><span><strong>Estimate a property</strong><small>I have a purchase price in mind</small></span></label>
            <label className={`mode-option ${state.one.maxPurchaseMode ? 'selected' : ''}`}><input type="radio" name="purchase-mode" checked={state.one.maxPurchaseMode} onChange={() => patchOne('maxPurchaseMode', true)} /><span><strong>Find maximum price</strong><small>Work backwards from my limits</small></span></label>
          </fieldset>
          {state.one.maxPurchaseMode && <p className="helper-note">Enter your desired LVR and at least a cash budget or loan approval limit. Entering both gives a fuller estimate; lending approval and serviceability are not assessed.</p>}
          <div className="section-heading"><span>01</span><div><h3>The property</h3><p>Tell us what you are buying.</p></div></div>
          <div className="field-grid">
            {currentUser && field('Scenario name (optional)', state.one.scenarioName, (v) => patchOne('scenarioName', v as string))}
            <label className="field"><span>Purchase type</span><select value={state.one.purchaseType} onChange={(e) => setState((prev) => ({ ...prev, one: { ...prev.one, purchaseType: e.target.value as PurchaseType | '', firstHomeReliefOptOut: false, ntPackageEligible: false } }))}>
              <option value="">Select...</option><option value="PPR">Owner occupier</option><option value="FHOG">First home buyer</option><option value="Investment">Investment</option>
            </select></label>
            {field('Property state / territory', state.one.state || 'VIC', (v) => setState((prev) => ({ ...prev, one: { ...prev.one, state: v as AustralianState, firstHomeReliefOptOut: false, ntPackageEligible: false, schemeArea: '' } })), 'select', AUSTRALIAN_STATES)}
            {field('Property type', state.one.homeKind || 'Established', (v) => setState((prev) => ({ ...prev, one: { ...prev.one, homeKind: v as HomeKind, firstHomeReliefOptOut: false, ntPackageEligible: false } })), 'select', ['Established', 'New'])}
            {!state.one.maxPurchaseMode && field('Purchase price ($)', state.one.housePrice, (v) => patchOne('housePrice', v as string), 'money')}
          </div>
          {state.one.purchaseType === 'FHOG' && <div className="relief-note"><strong>First-home duty relief is automatic</strong><p>We apply the selected state's rules where available, assuming the buyers qualify. Check the conditions for this purchase.</p><label><input type="checkbox" checked={!!state.one.firstHomeReliefOptOut} onChange={(e) => patchOne('firstHomeReliefOptOut', e.target.checked)} /> Buyers are not eligible — turn off first-home relief</label></div>}
          <div className="section-heading"><span>02</span><div><h3>Loan and deposit</h3><p>Set the loan structure and available funds.</p></div></div>
          <div className="field-grid">
            {field('Desired LVR (%)', state.one.desiredLvr, (v) => patchOne('desiredLvr', v as string), 'number')}
            <label className="lmi-option"><input type="checkbox" checked={state.one.lmiExempt} onChange={(e) => patchOne('lmiExempt', e.target.checked)} /><span><strong>LMI exemption / waiver</strong><small>First home scheme or professional waiver</small></span></label>
            {state.one.lmiExempt && field('LMI waiver basis', state.one.lmiBasis || 'Lender / professional waiver', (v) => patchOne('lmiBasis', v as OnePropertyInputs['lmiBasis']), 'select', ['Lender / professional waiver', '5% Deposit Scheme'])}
            {state.one.lmiExempt && state.one.lmiBasis !== '5% Deposit Scheme' && field('Maximum LVR for waiver (%)', state.one.exemptCap ?? '95', (v) => patchOne('exemptCap', v as string), 'number')}
            {state.one.lmiExempt && state.one.lmiBasis === '5% Deposit Scheme' && field('Scheme price-cap area', state.one.schemeArea || '', (v) => patchOne('schemeArea', v as OnePropertyInputs['schemeArea']), 'select', ['Capital / eligible regional centre', 'Other areas'])}
            {field('Available cash for deposit and costs ($)', state.one.maxCashContribution, (v) => patchOne('maxCashContribution', v as string), 'money')}
            {field('Loan approval limit ($)', state.one.loanApprovalMax, (v) => patchOne('loanApprovalMax', v as string), 'money')}
            {currentUser && field('Interest rate (%)', state.one.interestRate, (v) => patchOne('interestRate', v as string), 'number')}
            {currentUser && field('Loan term (years)', state.one.loanTerm, (v) => patchOne('loanTerm', v as string), 'number')}
            {currentUser && field('Repayment frequency', state.one.repaymentFrequency, (v) => patchOne('repaymentFrequency', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
            {currentUser && field('Extra principal per year ($)', state.one.extraPrincipal, (v) => patchOne('extraPrincipal', v as string), 'money')}
          </div>
          {state.one.lmiExempt && state.one.lmiBasis !== '5% Deposit Scheme' && <p className="helper-note" role="status">{oneCalc.invalidWaiverCap ? 'Enter a waiver maximum LVR between 0% and 100% to calculate this scenario.' : oneCalc.waiverLimitsLvr ? `Your desired LVR stays at ${oneCalc.outputs['Requested LVR']}; this scenario uses ${oneCalc.outputs['Applied / Capped LVR']} to stay within the waiver limit.` : 'The calculation stays within the waiver maximum. Turn off the waiver to explore a higher LVR with estimated LMI.'}</p>}
          {currentUser && <>
          <div className="section-heading"><span>03</span><div><h3>Income and extras</h3><p>Optional details for a fuller picture.</p></div></div>
          <div className="field-grid">
            {field('Gross yearly income before tax ($)', state.one.yearlyIncome, (v) => patchOne('yearlyIncome', v as string), 'money')}
            {field('Monthly living expenses ($)', state.one.livingExpensesMonthly, (v) => patchOne('livingExpensesMonthly', v as string), 'money')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field"><input type="checkbox" checked={state.one.useGuarantor} onChange={(e) => patchOne('useGuarantor', e.target.checked)} /> Use guarantor</label>
            {!state.one.maxPurchaseMode && <label className="check-field"><input type="checkbox" checked={state.one.enableOopLimit} onChange={(e) => patchOne('enableOopLimit', e.target.checked)} /> Limit price to available cash</label>}
            {state.one.state === 'NT' && state.one.purchaseType !== 'Investment' && state.one.homeKind === 'New' && <label className="check-field"><input type="checkbox" checked={!!state.one.ntPackageEligible} onChange={(e) => patchOne('ntPackageEligible', e.target.checked)} /> Apply eligible NT house-and-land package exemption</label>}
          </div>
          </>}
          {!currentUser && state.one.state === 'NT' && state.one.purchaseType !== 'Investment' && state.one.homeKind === 'New' && <div className="checkbox-grid"><label className="check-field"><input type="checkbox" checked={!!state.one.ntPackageEligible} onChange={(e) => patchOne('ntPackageEligible', e.target.checked)} /> Apply eligible NT house-and-land package exemption</label></div>}
          {!currentUser && <details className="advanced-options"><summary>Advanced options <span>Repayments, income and extras</span></summary><p>Enter a rate and term to estimate repayments. Any values entered here continue to apply when this section is closed.</p><div className="field-grid">
            {field('Scenario name (optional)', state.one.scenarioName, (v) => patchOne('scenarioName', v as string))}
            {field('Interest rate (%)', state.one.interestRate, (v) => patchOne('interestRate', v as string), 'number')}
            {field('Loan term (years)', state.one.loanTerm, (v) => patchOne('loanTerm', v as string), 'number')}
            {field('Repayment frequency', state.one.repaymentFrequency, (v) => patchOne('repaymentFrequency', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
            {field('Extra principal per year ($)', state.one.extraPrincipal, (v) => patchOne('extraPrincipal', v as string), 'money')}
          </div>
          <div className="field-grid">
            {field('Gross yearly income before tax ($)', state.one.yearlyIncome, (v) => patchOne('yearlyIncome', v as string), 'money')}
            {field('Monthly living expenses ($)', state.one.livingExpensesMonthly, (v) => patchOne('livingExpensesMonthly', v as string), 'money')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field"><input type="checkbox" checked={state.one.useGuarantor} onChange={(e) => patchOne('useGuarantor', e.target.checked)} /> Use guarantor</label>
            {!state.one.maxPurchaseMode && <label className="check-field"><input type="checkbox" checked={state.one.enableOopLimit} onChange={(e) => patchOne('enableOopLimit', e.target.checked)} /> Limit price to available cash</label>}
          </div>
          </details>}
          <p className="muted scenario-note">Estimates include an assumed $2,000 in transfer fees and an indicative LMI estimate; actual costs vary. Duty uses standard residential rules as at 2 November 2026. Check eligibility and dates; land, mixed eligibility, foreign surcharges and special concessions need separate assessment. Confirm any LMI waiver with the lender and check the scheme postcode and valuation.</p>
          <Actions
            guest={!currentUser}
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
            resultsReady={oneCalc.isComplete}
            onResetTab={() => patch('one', { ...DEFAULTS.oneProperty })}
            compareLabel={oneCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, '1 Property', compareRows)}
          />
        </section>
        <section className="panel results-panel">
          <div className="eyebrow">YOUR ESTIMATE</div><h2>Results at a glance</h2>
          <Banner tone={oneCalc.deal.tone} lines={[oneCalc.deal.text, oneCalc.description]} />
          <Banner tone={oneCalc.warningTone} lines={oneCalc.warnings} />
          {oneCalc.isComplete ? <><MetricSection title="At a Glance" items={oneCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={oneCalc.decisionGuide} />
          <details className="results-details"><summary>View all calculated results</summary><DetailSection title="All Calculated Results" rows={Object.entries(oneCalc.outputs).map(([label, value]) => ({ label, value }))} /></details></> : <p className="helper-note">{oneCalc.invalidWaiverCap ? 'Enter a valid maximum LVR for the waiver to see an estimate.' : 'Select a purchase type and enter a desired LVR and a property price or maximum-price limit.'}</p>}
        </section>
      </div>
    );
  };

  const renderTwo = () => {
    const compareRows = Object.entries(twoCalc.outputs).map(([k, v]) => `${k}: ${v}`);
    const warningRows = [
      { label: 'Main warning', value: twoCalc.warnings[0] || 'Please review the points below.' },
      ...twoCalc.warnings.slice(1, 7).map((value, index) => ({ label: `Note ${index + 1}`, value })),
    ];
    return (
      <div className="grid two-col">
        <section className="panel scenario-panel">
          <div className="scenario-heading"><div className="eyebrow">PROPERTY PORTFOLIO</div><h2>Plan your next property.</h2><p>Explore equity, lending and cash flow across two properties.</p></div>
          <div className="section-heading"><span>01</span><div><h3>Existing property</h3><p>Start with the value and mortgage today.</p></div></div>
          <div className="field-grid">
            {currentUser && field('Scenario name (optional)', state.two.scenarioName, (v) => patchTwo('scenarioName', v as string))}
            {field('Current property value ($)', state.two.currentValue, (v) => patchTwo('currentValue', v as string), 'money')}
            {field('Current mortgage balance ($)', state.two.currentMortgage, (v) => patchTwo('currentMortgage', v as string), 'money')}
            {currentUser && field('Current property rent per month ($)', state.two.currentRent, (v) => patchTwo('currentRent', v as string), 'money')}
          </div>
          <div className="checkbox-grid"><label className="check-field"><input type="checkbox" checked={state.two.withdraw80} onChange={(e) => patchTwo('withdraw80', e.target.checked)} /> Release available equity up to 80% LVR</label></div>
          <div className="section-heading"><span>02</span><div><h3>New property</h3><p>Enter the price, location and expected rent.</p></div></div>
          <div className="field-grid">
            {field('Purchase price ($)', state.two.secondPrice, (v) => patchTwo('secondPrice', v as string), 'money')}
            <label className="field"><span>New property use</span><select value={state.two.secondPurpose || 'Investment'} onChange={(e) => patchTwo('secondPurpose', e.target.value as 'Investment' | 'PPR')}><option value="Investment">Investment</option><option value="PPR">Owner occupier</option></select></label>
            {field('New property state / territory', state.two.state || 'VIC', (v) => patchTwo('state', v as AustralianState), 'select', AUSTRALIAN_STATES)}
            {currentUser && field('New property rent per month ($)', state.two.newRent, (v) => patchTwo('newRent', v as string), 'money')}
            {currentUser && field('Annual property costs for both ($)', state.two.annualPropertyCosts ?? '', (v) => patchTwo('annualPropertyCosts', v as string), 'money')}
          </div>
          {currentUser && <p className="helper-note">Include rates, land tax, insurance, management and other costs in the annual amount. Leave blank if unknown; cash flow after costs will stay unavailable.</p>}
          <div className="section-heading"><span>03</span><div><h3>Loan structure</h3><p>These assumptions apply to both loans.</p></div></div>
          <div className="field-grid">
            {field('Target combined LVR (%)', state.two.desiredLvr, (v) => patchTwo('desiredLvr', v as string), 'number')}
            {currentUser && field('New loan approval limit ($)', state.two.approvalMax, (v) => patchTwo('approvalMax', v as string), 'money')}
            {field('Interest rate for both loans (%)', state.two.interestRate, (v) => patchTwo('interestRate', v as string), 'number')}
            {field('Loan term for both loans (years)', state.two.loanTerm, (v) => patchTwo('loanTerm', v as string), 'number')}
            {currentUser && field('Gross annual income (optional) ($)', state.two.yearlyIncome, (v) => patchTwo('yearlyIncome', v as string), 'money')}
            {state.two.lmiExempt && field('Maximum LVR for LMI waiver (%)', state.two.exemptCap, (v) => patchTwo('exemptCap', v as string), 'number')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field"><input type="checkbox" checked={state.two.crossCollat} onChange={(e) => patchTwo('crossCollat', e.target.checked)} /> Model cross-collateralised LMI</label>
            <label className="check-field"><input type="checkbox" checked={state.two.lmiExempt} onChange={(e) => patchTwo('lmiExempt', e.target.checked)} /> Assume an eligible LMI waiver</label>
          </div>
          {!currentUser && <p className="helper-note">Blank rents are treated as $0 and a blank approval limit does not cap the loan. Add rent, property costs and any loan limit in Advanced options for a fuller picture.</p>}
          {!currentUser && <details className="advanced-options"><summary>Advanced options <span>Rent, costs and loan limits</span></summary><p>Include rates, land tax, insurance, management and other property costs. Leave costs blank if unknown; cash flow after costs will remain unavailable. Entered values still apply when this section is closed.</p><div className="field-grid">
            {field('Scenario name (optional)', state.two.scenarioName, (v) => patchTwo('scenarioName', v as string))}
            {field('Current property rent per month ($)', state.two.currentRent, (v) => patchTwo('currentRent', v as string), 'money')}
            {field('New property rent per month ($)', state.two.newRent, (v) => patchTwo('newRent', v as string), 'money')}
            {field('Annual property costs for both ($)', state.two.annualPropertyCosts ?? '', (v) => patchTwo('annualPropertyCosts', v as string), 'money')}
            {field('New loan approval limit ($)', state.two.approvalMax, (v) => patchTwo('approvalMax', v as string), 'money')}
            {field('Gross annual income (optional) ($)', state.two.yearlyIncome, (v) => patchTwo('yearlyIncome', v as string), 'money')}
          </div></details>}
          <p className="muted scenario-note">A simplified purchase estimate, not a bank approval. Purchase costs, loan structure, tax and lender policy require independent review.</p>
          <Actions
            guest={!currentUser}
            onSaveTab={() => saveTab('two')}
            onLoadTab={() => loadTab('two')}
            onPdf={() =>
              exportPdfStyled({
                title: '2 Properties',
                subtitle: state.two.scenarioName?.trim() || twoCalc.deal.text || 'Review assumptions and inputs.',
                atAGlance: twoCalc.atAGlance.map((x) => ({ label: x.label, value: x.value })),
                decisionRows: twoCalc.decisionGuide,
                warningRows,
                inputRows: twoPdfInputRows(),
                outputRows: Object.entries(twoCalc.outputs)
                  .filter(([, value]) => String(value).trim() !== '' && String(value).trim() !== '-')
                  .map(([label, value]) => ({ label, value })),
              })
            }
            resultsReady={twoCalc.isComplete}
            onResetTab={() => patch('two', { ...DEFAULTS.twoProperties })}
            compareLabel={twoCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, '2 Properties', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={twoCalc.deal.tone} lines={[twoCalc.deal.text]} />
          <Banner tone={twoCalc.warningTone} lines={twoCalc.warnings} />
          {twoCalc.isComplete ? <>
          <MetricSection title="At a Glance" items={twoCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={twoCalc.decisionGuide} />
          <details className="results-details"><summary>View all calculated results</summary><DetailSection title="All Calculated Results" rows={Object.entries(twoCalc.outputs).map(([label, value]) => ({ label, value }))} /></details></> : <p className="helper-note">Your estimate will appear once the required inputs are complete.</p>}
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
        <section className="panel scenario-panel">
          <div className="scenario-heading"><div className="eyebrow">LOAN REVIEW</div><h2>Compare your refinance.</h2><p>Review repayments, costs and loan terms side by side.</p></div>
          <div className="section-heading"><span>01</span><div><h3>Your current loan</h3><p>Use the remaining term, not the original term.</p></div></div>
          <div className="field-grid">
            {currentUser && field('Scenario name', state.refi.scenarioName, (v) => patchRefi('scenarioName', v as string))}
            {field('Current property value ($)', state.refi.currentValue, (v) => patchRefi('currentValue', v as string), 'money')}
            {field('Current loan ($)', state.refi.currentLoan, (v) => patchRefi('currentLoan', v as string), 'money')}
            {field('Current rate (%)', state.refi.currentRate, (v) => patchRefi('currentRate', v as string), 'number')}
            {field('Current remaining term (years)', state.refi.currentTerm, (v) => patchRefi('currentTerm', v as string), 'number')}
            {field('Current frequency', state.refi.currentFreq, (v) => patchRefi('currentFreq', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
          </div><div className="section-heading"><span>02</span><div><h3>Proposed loan</h3><p>Enter the offer you want to compare.</p></div></div><div className="field-grid">
            {field('New rate (%)', state.refi.newRate, (v) => patchRefi('newRate', v as string), 'number')}
            {field('New term (years)', state.refi.newTerm, (v) => patchRefi('newTerm', v as string), 'number')}
            {field('New frequency', state.refi.newFreq, (v) => patchRefi('newFreq', v as Frequency | ''), 'select', ['Monthly', 'Fortnightly', 'Weekly'])}
          </div>{currentUser && <div className="section-heading"><span>03</span><div><h3>Switching costs</h3><p>Include any early break fee in the discharge amount.</p></div></div>}<div className="field-grid">
            {currentUser && field('Discharge / break fee ($)', state.refi.dischargeFee, (v) => patchRefi('dischargeFee', v as string), 'money')}
            {currentUser && field('Application fee ($)', state.refi.applicationFee, (v) => patchRefi('applicationFee', v as string), 'money')}
            {currentUser && field('Legal fee ($)', state.refi.legalFee, (v) => patchRefi('legalFee', v as string), 'money')}
            {currentUser && field('Valuation fee ($)', state.refi.valuationFee, (v) => patchRefi('valuationFee', v as string), 'money')}
            {currentUser && field('Government fee ($)', state.refi.govFee, (v) => patchRefi('govFee', v as string), 'money')}
            {currentUser && field('Cashback ($)', state.refi.cashback, (v) => patchRefi('cashback', v as string), 'money')}
            {currentUser && field('Extra borrowing ($)', state.refi.extraBorrow, (v) => patchRefi('extraBorrow', v as string), 'money')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field">
              <input type="checkbox" checked={state.refi.lmiExempt} onChange={(e) => patchRefi('lmiExempt', e.target.checked)} /> LMI exempt
            </label>
          </div>
          {!currentUser && <p className="helper-note">Blank switching costs and cashback are treated as $0. Add known fees or cashback in Advanced options; they can change the comparison.</p>}
          {!currentUser && <details className="advanced-options"><summary>Advanced options <span>Fees, cashback and extra borrowing</span></summary><p>Include any break fee in the discharge amount. Entered values still apply when this section is closed.</p><div className="field-grid">
            {field('Scenario name', state.refi.scenarioName, (v) => patchRefi('scenarioName', v as string))}
            {field('Discharge / break fee ($)', state.refi.dischargeFee, (v) => patchRefi('dischargeFee', v as string), 'money')}
            {field('Application fee ($)', state.refi.applicationFee, (v) => patchRefi('applicationFee', v as string), 'money')}
            {field('Legal fee ($)', state.refi.legalFee, (v) => patchRefi('legalFee', v as string), 'money')}
            {field('Valuation fee ($)', state.refi.valuationFee, (v) => patchRefi('valuationFee', v as string), 'money')}
            {field('Government fee ($)', state.refi.govFee, (v) => patchRefi('govFee', v as string), 'money')}
            {field('Cashback ($)', state.refi.cashback, (v) => patchRefi('cashback', v as string), 'money')}
            {field('Extra borrowing ($)', state.refi.extraBorrow, (v) => patchRefi('extraBorrow', v as string), 'money')}
          </div></details>}
          <p className="muted scenario-note">Assumes rates remain constant and fees are paid upfront. LMI is an estimate. A lower repayment can reflect a longer loan term.</p>
          <Actions
            guest={!currentUser}
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
            resultsReady={refiCalc.isComplete}
            onResetTab={() => patch('refi', { ...DEFAULTS.refinance })}
            compareLabel={refiCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, 'Refinance', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={refiCalc.deal.tone} lines={[refiCalc.deal.text]} />
          <Banner tone={refiCalc.warningTone} lines={refiCalc.warnings} />
          {refiCalc.isComplete ? <>
          <MetricSection title="At a Glance" items={refiCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={refiCalc.decisionGuide} />
          <details className="results-details"><summary>View all calculated results</summary><DetailSection title="All Calculated Results" rows={Object.entries(refiCalc.outputs).map(([label, value]) => ({ label, value }))} /></details></> : <p className="helper-note">Your estimate will appear once the required inputs are complete.</p>}
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
        <section className="panel scenario-panel">
          <div className="scenario-heading"><div className="eyebrow">SERVICEABILITY ESTIMATE</div><h2>Explore borrowing capacity.</h2><p>A starting point using transparent assumptions—not a lender assessment.</p></div>
          <div className="section-heading"><span>01</span><div><h3>Applicants and income</h3><p>Annual gross income and monthly rental income.</p></div></div>
          <div className="field-grid">
            {currentUser && field('Scenario name', state.borrow.scenarioName, (v) => patchBorrow('scenarioName', v as string))}
            {currentUser && <label className="field"><span>Illustrative assumptions profile</span><select value={state.borrow.lenderProfile} onChange={(e) => patchBorrow('lenderProfile', e.target.value as LenderProfile | '')}><option value="">Select...</option><option value="NAB-style">Baseline (illustrative)</option><option value="Conservative">Conservative (illustrative)</option><option value="Aggressive">Aggressive (illustrative)</option></select></label>}
            {field('Applicant type', state.borrow.applicantType, (v) => patchBorrow('applicantType', v as ApplicantType | ''), 'select', ['Single', 'Couple'])}
            {field('Dependants', state.borrow.dependants, (v) => patchBorrow('dependants', v as string), 'number')}
            {field('Loan purpose', state.borrow.loanPurpose, (v) => patchBorrow('loanPurpose', v as LoanPurpose | ''), 'select', ['Owner Occupier', 'Investment'])}
            {field('Gross income 1 ($)', state.borrow.grossIncome1, (v) => patchBorrow('grossIncome1', v as string), 'money')}
            {(currentUser || state.borrow.applicantType === 'Couple' || !!state.borrow.grossIncome2) && field('Gross income 2 ($)', state.borrow.grossIncome2, (v) => patchBorrow('grossIncome2', v as string), 'money')}
            {currentUser && field('Rental income monthly ($)', state.borrow.rentalIncomeMonthly, (v) => patchBorrow('rentalIncomeMonthly', v as string), 'money')}
            {currentUser && field('Other income annual ($)', state.borrow.otherIncomeAnnual, (v) => patchBorrow('otherIncomeAnnual', v as string), 'money')}
          </div><div className="section-heading"><span>02</span><div><h3>Expenses and debts</h3><p>Include all relevant monthly commitments.</p></div></div><div className="field-grid">
            {field('Living expenses monthly ($)', state.borrow.livingExpensesMonthly, (v) => patchBorrow('livingExpensesMonthly', v as string), 'money')}
            {currentUser && field('Existing loan repayments monthly ($)', state.borrow.existingLoanRepaymentsMonthly, (v) => patchBorrow('existingLoanRepaymentsMonthly', v as string), 'money')}
            {currentUser && field('Credit card limits ($)', state.borrow.creditCardLimits, (v) => patchBorrow('creditCardLimits', v as string), 'money')}
            {currentUser && field('Other debts monthly ($)', state.borrow.otherDebtsMonthly, (v) => patchBorrow('otherDebtsMonthly', v as string), 'money')}
            {currentUser && field('HELP / study loan repayment monthly ($)', state.borrow.helpRepaymentsMonthly ?? '', (v) => patchBorrow('helpRepaymentsMonthly', v as string), 'money')}
          </div><div className="section-heading"><span>03</span><div><h3>Loan assumptions</h3><p>Set the proposed rate, term and LVR.</p></div></div><div className="field-grid">
            {field('Actual rate (%)', state.borrow.actualRate, (v) => patchBorrow('actualRate', v as string), 'number')}
            {field('Loan term (years)', state.borrow.loanTerm, (v) => patchBorrow('loanTerm', v as string), 'number')}
            {field('Target LVR (%)', state.borrow.targetLvr, (v) => patchBorrow('targetLvr', v as string), 'number')}
          </div>{currentUser && <details className="results-details"><summary>Advanced assessment assumptions</summary><p className="muted">These are editable approximations, not a lender's actual policy.</p><div className="field-grid">
            {field('Assessment buffer (%)', state.borrow.assessmentBufferPct, (v) => patchBorrow('assessmentBufferPct', v as string), 'number')}
            {field('Assessment floor rate (%)', state.borrow.assessmentFloorRatePct, (v) => patchBorrow('assessmentFloorRatePct', v as string), 'number')}
            {field('Rental shading (%)', state.borrow.rentalShadingPct, (v) => patchBorrow('rentalShadingPct', v as string), 'number')}
            {field('Other income shading (%)', state.borrow.otherIncomeShadingPct, (v) => patchBorrow('otherIncomeShadingPct', v as string), 'number')}
            {field('Credit card loading (%/month)', state.borrow.creditCardLoadingPct, (v) => patchBorrow('creditCardLoadingPct', v as string), 'number')}
          </div></details>}
          {!currentUser && <p className="helper-note">Have existing loans, credit cards, HELP or other debts? Add them in Advanced options. Blank debts are treated as $0 and can overstate how much you may be able to borrow.</p>}
          {!currentUser && <details className="advanced-options"><summary>Advanced options <span>Other income, debts and assessment</span></summary><p>Enter existing loans at the lender-assessed repayment. Add all credit card limits, HELP and other commitments; values entered still apply when this section is closed.</p><div className="field-grid">
            {field('Scenario name', state.borrow.scenarioName, (v) => patchBorrow('scenarioName', v as string))}
            <label className="field"><span>Illustrative assumptions profile</span><select value={state.borrow.lenderProfile} onChange={(e) => patchBorrow('lenderProfile', e.target.value as LenderProfile | '')}><option value="">Select...</option><option value="NAB-style">Baseline (illustrative)</option><option value="Conservative">Conservative (illustrative)</option><option value="Aggressive">Aggressive (illustrative)</option></select></label>
            {field('Rental income monthly ($)', state.borrow.rentalIncomeMonthly, (v) => patchBorrow('rentalIncomeMonthly', v as string), 'money')}
            {field('Other income annual ($)', state.borrow.otherIncomeAnnual, (v) => patchBorrow('otherIncomeAnnual', v as string), 'money')}
            {field('Existing loan repayments monthly ($)', state.borrow.existingLoanRepaymentsMonthly, (v) => patchBorrow('existingLoanRepaymentsMonthly', v as string), 'money')}
            {field('Credit card limits ($)', state.borrow.creditCardLimits, (v) => patchBorrow('creditCardLimits', v as string), 'money')}
            {field('Other debts monthly ($)', state.borrow.otherDebtsMonthly, (v) => patchBorrow('otherDebtsMonthly', v as string), 'money')}
            {field('HELP / study loan repayment monthly ($)', state.borrow.helpRepaymentsMonthly ?? '', (v) => patchBorrow('helpRepaymentsMonthly', v as string), 'money')}
          </div><h3>Assessment assumptions</h3><p>These are editable approximations, not a lender’s actual policy. A blank profile uses the baseline assumptions.</p><div className="field-grid">
            {field('Assessment buffer (%)', state.borrow.assessmentBufferPct, (v) => patchBorrow('assessmentBufferPct', v as string), 'number')}
            {field('Assessment floor rate (%)', state.borrow.assessmentFloorRatePct, (v) => patchBorrow('assessmentFloorRatePct', v as string), 'number')}
            {field('Rental shading (%)', state.borrow.rentalShadingPct, (v) => patchBorrow('rentalShadingPct', v as string), 'number')}
            {field('Other income shading (%)', state.borrow.otherIncomeShadingPct, (v) => patchBorrow('otherIncomeShadingPct', v as string), 'number')}
            {field('Credit card loading (%/month)', state.borrow.creditCardLoadingPct, (v) => patchBorrow('creditCardLoadingPct', v as string), 'number')}
          </div></details>}
          <p className="muted scenario-note">Illustrative resident tax and living-cost benchmarks; enter assessed existing loans and HELP separately. The purchase-price estimate assumes the required deposit and excludes purchase costs.</p>
          <Actions
            guest={!currentUser}
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
            resultsReady={borrowCalc.isComplete}
            onResetTab={() => patch('borrow', { ...DEFAULTS.borrowing })}
            compareLabel={borrowCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, 'Borrowing Capacity', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={borrowCalc.deal.tone} lines={[borrowCalc.deal.text]} />
          <Banner tone={borrowCalc.warningTone} lines={borrowCalc.warnings} />
          {borrowCalc.isComplete ? <>
          <MetricSection title="Borrowing Summary" items={borrowCalc.borrowingSummary} />
          <DetailSection title="Decision Guide" rows={borrowCalc.decisionGuide} />
          <details className="results-details"><summary>View all calculated results</summary><DetailSection title="All Calculated Results" rows={Object.entries(borrowCalc.outputs).map(([label, value]) => ({ label, value }))} /></details></> : <p className="helper-note">Your estimate will appear once the required inputs are complete.</p>}
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
                  {state.compare[slot]?.body.slice(0, 12).map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                  {(state.compare[slot]?.body.length ?? 0) > 12 && <details className="results-details"><summary>Show remaining results</summary>{state.compare[slot]?.body.slice(12).map((line, index) => <div key={index}>{line}</div>)}</details>}
                </div>
              </>
            ) : (
              <div className="muted">Choose a calculation tab and save a scenario here to compare it.</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );

  const renderSettings = () => (
    <div className="grid two-col">
      <section className="panel">
        <h2>Branding, Account & Defaults</h2>
        <div className="field-grid">
          {field('Brand name', state.meta.brandName, (v) => patchMeta('brandName', v as string))}
          <label className="field"><span>Signed-in broker</span><input type="text" value={state.meta.brokerName} readOnly /></label>
          <label className="field"><span>Role</span><input type="text" value={currentProfile?.role || (currentUser ? 'broker' : 'guest')} readOnly /></label>
          <label className="field"><span>Storage mode</span><input type="text" value={storageMode === 'cloud' ? 'Cloud (Supabase)' : 'Local browser only'} readOnly /></label>
          <label className="field"><span>Account email</span><input type="text" value={currentUser?.email || 'Guest / not signed in'} readOnly /></label>
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
              Save to Cloud / Profile
            </button>
          )}
          <button className="secondary" onClick={() => void signOutOrChangeAccount()}>
            Sign out / Change account
          </button>
          <button className="secondary" onClick={() => { setState(blankState()); setProfileNameDraft(''); setStartupStep('auth'); }}>
            Reset everything
          </button>
        </div>
        {activeAccessLevel === 'view' && currentProfile?.role !== 'owner' && (
          <p role="status">This case is view-only. Duplicate it to save your own copy.</p>
        )}
        {state.meta.brokerName !== 'Guest' && (
          <div className="profile-list">
            <div className="profile-list-title">
              {currentProfile?.role === 'owner' ? 'All cloud cases' : 'My cloud cases and shared cases'}
            </div>
            <label className="field profile-search-field">
              <span>Search saved cases</span>
              <input type="text" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} placeholder="Search by case name..." />
            </label>
            {brokerProfiles.length ? brokerProfiles.map((profile) => (
              <div className="profile-row" key={profile.id}>
                <div>
                  <div className="profile-name">{profile.caseName}</div>
                  <div className="profile-meta">
                    {new Date(profile.savedAt).toLocaleString()}
                    {profile.source !== 'local' ? ` • ${profile.source === 'shared' ? 'Shared' : 'Cloud'}` : ' • Local'}
                    {profile.source !== 'local' && profile.ownerEmail ? ` • Owner: ${profile.ownerEmail}` : ''}
                    {profile.accessLevel ? ` • Access: ${profile.accessLevel}` : ''}
                  </div>
                </div>
                <div className="profile-actions">
                  <button className="secondary" onClick={() => loadProfileById(profile.id)}>Load</button>
                  {(profile.source === 'local' || canEditCloudCase(profile)) && (
                    <button className="secondary" onClick={() => renameProfileById(profile.id)}>Rename</button>
                  )}
                  <button className="secondary" onClick={() => duplicateProfileById(profile.id)}>Duplicate</button>
                  {profile.source !== 'local' && canManageSharing(profile) && (
                    <button className="secondary" onClick={() => void shareCaseById(profile.id)}>Share</button>
                  )}
                  {(profile.source === 'local' || currentProfile?.role === 'owner' || profile.ownerId === currentUser?.id) && (
                    <button className="ghost danger" onClick={() => deleteProfileById(profile.id)}>Delete</button>
                  )}
                </div>
              </div>
            )) : <div className="muted">No saved cases matched yet.</div>}
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Using this workspace</h2>
        <p className="muted">Calculator results are indicative and can change when the inputs or assumptions change.</p>
        <ul className="feature-list"><li>Save a whole file to keep a copy on your device.</li><li>Signed-in users can access their permitted cloud cases.</li><li>Guest calculations remain in this browser and are not saved to a cloud profile.</li></ul>
        {authMessage && <p className="muted">{authMessage}</p>}
        <p className="muted">{DISCLAIMER}</p>
      </section>
    </div>
  );


  if (showPublicWebsite) return isCalculatorsPage
    ? <CalculatorsPage onOpenCalculator={openPublicCalculator} onBrokerSignIn={() => openBrokerSignIn()} authReady={authReady} />
    : isServicesPage || isApproachPage
    ? <BrokerInfoPage page={isServicesPage ? 'services' : 'approach'} onBrokerSignIn={() => openBrokerSignIn()} authReady={authReady} />
    : <PublicWebsite onBrokerSignIn={() => openBrokerSignIn()} authReady={authReady} />;

  if (startupStep !== 'ready') return (
    <div className="broker-access-page">
      <header className="broker-access-header"><a href="/" className="broker-access-brand">{SITE_CONFIG.businessName}<span>BROKER WORKSPACE</span></a><a href="/" className="broker-back-link">← Back to website</a></header>
      <main className="broker-access-content"><div className="broker-access-intro"><div className="broker-access-label">YOUR WORKSPACE</div><h1>A little more clarity,<br/><em>every day.</em></h1><p>Sign in to manage your cases and pick up where you left off.</p><a href="/calculators/">Looking for the public calculators? →</a></div>
          <div className="startup-card">
            {startupStep === 'auth' && (
              <>
                <div className="eyebrow">Secure access</div>
                <h2>Sign in to unlock cloud-saved cases</h2>
                <p>
                  Sign in with your invited account to access cloud-saved cases. The calculators are available without signing in.
                </p>
                <label className="field startup-field">
                  <span>Email</span>
                  <input
                    autoFocus
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && authEmail.trim() && authPassword.trim()) void handleAuthSubmit();
                    }}
                  />
                </label>
                <label className="field startup-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && authEmail.trim() && authPassword.trim()) void handleAuthSubmit();
                    }}
                  />
                </label>
                <div className="startup-actions">
                  <button onClick={() => void handleAuthSubmit()} disabled={authBusy || !authEmail.trim() || !authPassword.trim()}>
                    {authBusy ? 'Working...' : 'Sign In'}
                  </button>
                </div>
                {authMessage && <p className="muted">{authMessage}</p>}
                {!supabaseEnabled && (
                  <p className="muted">
                    Account sign-in is not configured on this version of the website.
                  </p>
                )}
              </>
            )}

            {startupStep === 'brokerMenu' && (
              <>
                <div className="eyebrow">Welcome, {state.meta.brokerName || 'Broker'}{currentProfile?.role ? ` (${currentProfile.role})` : ''}</div>
                <h2>Choose how you’d like to continue</h2>
                {authMessage && <p role="alert">{authMessage}</p>}
                <div className="startup-menu">
                  <button onClick={createNewCase}>Create New Case</button>
                  <button className="secondary" onClick={() => {
                    void refreshProfiles();
                    setStartupStep('brokerLoad');
                  }}>
                    Load Saved Case
                  </button>
                </div>
                <button className="startup-link" onClick={() => void signOutOrChangeAccount()}>
                  {currentUser ? 'Sign out' : 'Use guest mode'}
                </button>
              </>
            )}

            {startupStep === 'brokerLoad' && (
              <>
                <div className="eyebrow">{storageMode === 'cloud' ? 'Cloud-saved cases' : 'Local saved profiles'}</div>
                <h2>Load Saved Case</h2>
                {authMessage && <p role="alert">{authMessage}</p>}
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
                            <small>{new Date(profile.savedAt).toLocaleString()} • {profile.source === 'shared' ? 'Shared' : profile.source === 'cloud' ? 'Cloud' : 'Local'}{profile.accessLevel ? ` • ${profile.accessLevel}` : ''}</small>
                          </span>
                          <span>Load</span>
                        </button>
                        <div className="startup-profile-actions">
                          {(profile.source === 'local' || canEditCloudCase(profile)) && <button className="secondary" onClick={() => void renameProfileById(profile.id)}>Rename</button>}
                          <button className="secondary" onClick={() => void duplicateProfileById(profile.id)}>Duplicate</button>
                          {(profile.source === 'local' || currentProfile?.role === 'owner' || profile.ownerId === currentUser?.id) && <button className="ghost danger" onClick={() => void deleteProfileById(profile.id)}>Delete</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No saved cases matched yet.</p>
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
      </main>
    </div>
  );

  if (!currentUser && (tab === 'one' || tab === 'two' || tab === 'refi' || tab === 'borrow')) return (
    <GuestCalculatorPage tool={tab} authReady={authReady} onBrokerSignIn={() => openBrokerSignIn()} onSelectTool={(next: GuestTool) => {
      if (window.location.hash !== `#calculator-${next}` || window.location.pathname !== '/calculators/') window.history.pushState(null, '', `/calculators/#calculator-${next}`);
      setTab(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }}>
      {tab === 'one' && renderOne()}
      {tab === 'two' && renderTwo()}
      {tab === 'refi' && renderRefi()}
      {tab === 'borrow' && renderBorrow()}
    </GuestCalculatorPage>
  );

  return (
    <div className="app-shell">
      <button className="website-return" onClick={() => { window.history.pushState(null, '', isCalculatorsPage ? '/calculators/#top' : '/#top'); setShowPublicWebsite(true); window.scrollTo({ top: 0, behavior: 'auto' }); }}>← {isCalculatorsPage ? 'Back to calculators' : 'Back to website'}</button>
      <header className="topbar">
        <div>
          <div className="eyebrow">{currentUser ? 'Mortgage workflow dashboard' : 'FREE HOME LOAN CALCULATORS'}</div>
          <h1>{currentUser ? (state.meta.brandName || SITE_CONFIG.businessName) : 'Explore your numbers'}</h1>
          <p>{currentUser ? 'Explore lending scenarios, compare options and prepare client summaries.' : 'Choose a calculator and explore different scenarios at your own pace.'}</p>
        </div>
        <div className="header-badge">{currentUser?.email ? `Signed in: ${currentUser.email}` : 'No account required'}</div>
      </header>

      <nav className={`tabs ${!currentUser ? 'guest-tabs' : ''}`} aria-label="Calculator navigation">
        {TAB_KEYS.filter((item) => !!currentUser || ['one', 'two', 'refi', 'borrow'].includes(item.key)).map((item) => (
          <button key={item.key} className={`tab ${tab === item.key ? 'active' : ''}`} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </nav>

      {!currentUser && <aside className="calculator-disclaimer" aria-label="Important information about these calculators"><strong>Important: about your estimate</strong><p>These calculators provide general estimates to help you explore scenarios. Results depend on the information and assumptions used, can contain errors and do not consider all of your circumstances. They are not loan approval or personal financial advice. Rates, lender policies, taxes, fees and eligibility can change; actual outcomes may differ.</p><p>Do not rely on an estimate to make a financial product decision. Consider advice from an appropriately licensed professional and confirm the details with your lender and relevant authorities. Your rights under Australian law are not excluded.</p><p>Entries are stored in this browser on this device, so take care when using a shared computer.</p></aside>}
      <main className="content">
        {currentUser && tab === 'home' && renderHome()}
        {tab === 'one' && renderOne()}
        {tab === 'two' && renderTwo()}
        {tab === 'refi' && renderRefi()}
        {tab === 'borrow' && renderBorrow()}
        {currentUser && tab === 'compare' && renderCompare()}
        {currentUser && tab === 'settings' && renderSettings()}
      </main>


    </div>
  );
}

export default App;
