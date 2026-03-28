
import { useEffect, useMemo, useState } from 'react';
import { supabase, supabaseEnabled, type AuthUser } from './supabaseClient';
import { jsPDF } from 'jspdf';
import './styles.css';
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
type UserRole = 'owner' | 'worker';
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

const INPUT_LABELS_TWO: Record<string, string> = {
  scenarioName: 'Scenario name',
  interestRate: 'Interest rate (%)',
  loanTerm: 'Loan term (years)',
  currentMortgage: 'Current mortgage',
  currentValue: 'Current property value',
  secondPrice: 'Second house price',
  crossCollat: 'Cross-collateralisation for LMI',
  desiredLvr: 'Desired consolidated LVR (%)',
  withdraw80: 'Withdraw equity to 80%',
  currentRent: 'Current total monthly rent',
  newRent: 'New property monthly rent',
  approvalMax: 'Loan approval maximum',
  lmiExempt: 'LMI exempt',
  exemptCap: 'LMI exempt cap (%)',
  yearlyIncome: 'Yearly income',
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
  const [startupStep, setStartupStep] = useState<StartupStep>('auth');
  const [profiles, setProfiles] = useState<SavedProfile[]>(() => getStoredProfiles());
  const [profileNameDraft, setProfileNameDraft] = useState(state.caseName || '');
  const [profileSearch, setProfileSearch] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [storageMode, setStorageMode] = useState<'cloud' | 'local'>(supabaseEnabled ? 'cloud' : 'local');
  const [currentProfile, setCurrentProfile] = useState<AppProfile | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeCaseOwnerId, setActiveCaseOwnerId] = useState<string | null>(null);
  const [activeAccessLevel, setActiveAccessLevel] = useState<AccessLevel | null>(null);


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
    }

    if (existing) {
      return existing as AppProfile;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email || '',
          full_name: fallbackName,
          role: 'worker',
          status: 'active',
        },
        { onConflict: 'id' },
      )
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
      if (!effectiveProfile) {
        setProfiles(getStoredProfiles());
        return;
      }

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

      setProfiles(next);
      return;
    }

    setProfiles(getStoredProfiles());
  };


  useEffect(() => {
    let active = true;

    if (!supabaseEnabled) {
      setStorageMode('local');
      setStartupStep(state.meta.brokerName ? 'brokerMenu' : 'auth');
      return () => {
        active = false;
      };
    }

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      const user = data.session?.user ?? null;
      setCurrentUser(user);
      setStorageMode(user ? 'cloud' : 'local');
      if (user) {
        const profile = await ensureProfile(user);
        if (!active) return;
        setCurrentProfile(profile);
        const brokerName = profile?.full_name?.trim() || brokerNameFromUser(user);
        setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName } }));
        setStartupStep('brokerMenu');
        void refreshProfiles(user, profile);
      } else {
        setCurrentProfile(null);
        setStartupStep('auth');
      }
      if (error) setAuthMessage(error.message);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const user = session?.user ?? null;
      setCurrentUser(user);
      setStorageMode(user ? 'cloud' : 'local');
      if (user) {
        void (async () => {
          const profile = await ensureProfile(user);
          if (!active) return;
          setCurrentProfile(profile);
          const brokerName = profile?.full_name?.trim() || brokerNameFromUser(user);
          setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName } }));
          setStartupStep('brokerMenu');
          await refreshProfiles(user, profile);
        })();
      } else {
        setCurrentProfile(null);
        setStartupStep('auth');
      }
    });

    return () => {
      active = false;
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
      if (profile.source === 'cloud') return true;
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
      setAuthMessage('Supabase is not configured yet. Use guest mode for tonight or add the VITE_SUPABASE_* values and redeploy.');
      return;
    }
    const email = authEmail.trim();
    const password = authPassword.trim();
    if (!email || !password) {
      setAuthMessage('Please enter both email and password.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setAuthMessage('Signed in.');
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
    setState((prev) => ({ ...prev, meta: { ...prev.meta, brokerName: 'Guest' } }));
    setProfileSearch('');
    setStartupStep('ready');
  };

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
    setTab('one');
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
    setTab('one');
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
      const editableLoadedCase =
        !!activeCaseId &&
        (currentProfile?.role === 'owner' ||
          activeCaseOwnerId === currentUser.id ||
          activeAccessLevel === 'edit');

      if (editableLoadedCase && activeCaseId) {
        const { error } = await supabase
          .from('broker_cases')
          .update({
            case_name: caseName,
            app_state: nextState,
            updated_at: niceNow(),
          })
          .eq('id', activeCaseId);

        if (error) {
          setAuthMessage(error.message || 'Cloud save failed.');
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
      const { error } = await supabase.from('broker_cases').delete().eq('id', id);
      if (error) {
        setAuthMessage(error.message || 'Delete failed.');
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
      const { error } = await supabase
        .from('broker_cases')
        .update({ case_name: nextName, updated_at: niceNow(), app_state: { ...profile.state, caseName: nextName } })
        .eq('id', id);
      if (error) {
        setAuthMessage(error.message || 'Rename failed.');
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
    const accessLevel: 'view' | 'edit' = rawAccess === 'edit' ? 'edit' : 'view';

    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (targetError) {
      setAuthMessage(targetError.message || 'Could not find that user.');
      return;
    }
    if (!target?.id) {
      setAuthMessage('That user has not signed in yet, so they do not have a profile to share with.');
      return;
    }
    if (target.id === profile.ownerId) {
      setAuthMessage('The case owner already has access.');
      return;
    }

    const { error } = await supabase.from('case_access').upsert(
      {
        case_id: profile.id,
        user_id: target.id,
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
    setProfileSearch('');
    if (supabaseEnabled && currentUser) {
      await supabase.auth.signOut();
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

  const renderTwo = () => {
    const compareRows = Object.entries(twoCalc.outputs).map(([k, v]) => `${k}: ${v}`);
    const warningRows = [
      { label: 'Main warning', value: twoCalc.warnings[0] || 'Please review the points below.' },
      ...twoCalc.warnings.slice(1, 7).map((value, index) => ({ label: `Note ${index + 1}`, value })),
    ];
    return (
      <div className="grid two-col">
        <section className="panel">
          <h2>2 Properties</h2>
          <div className="field-grid">
            {field('Scenario name', state.two.scenarioName, (v) => patchTwo('scenarioName', v as string))}
            {field('Interest rate (%)', state.two.interestRate, (v) => patchTwo('interestRate', v as string), 'number')}
            {field('Loan term (years)', state.two.loanTerm, (v) => patchTwo('loanTerm', v as string), 'number')}
            {field('Current mortgage', state.two.currentMortgage, (v) => patchTwo('currentMortgage', v as string), 'number')}
            {field('Current property value', state.two.currentValue, (v) => patchTwo('currentValue', v as string), 'number')}
            {field('Second house price', state.two.secondPrice, (v) => patchTwo('secondPrice', v as string), 'number')}
            {field('Desired consolidated LVR (%)', state.two.desiredLvr, (v) => patchTwo('desiredLvr', v as string), 'number')}
            {field('Current total monthly rent', state.two.currentRent, (v) => patchTwo('currentRent', v as string), 'number')}
            {field('New property monthly rent', state.two.newRent, (v) => patchTwo('newRent', v as string), 'number')}
            {field('Loan approval maximum', state.two.approvalMax, (v) => patchTwo('approvalMax', v as string), 'number')}
            {field('LMI exempt cap (%)', state.two.exemptCap, (v) => patchTwo('exemptCap', v as string), 'number')}
            {field('Yearly income', state.two.yearlyIncome, (v) => patchTwo('yearlyIncome', v as string), 'number')}
          </div>
          <div className="checkbox-grid">
            <label className="check-field">
              <input type="checkbox" checked={state.two.crossCollat} onChange={(e) => patchTwo('crossCollat', e.target.checked)} /> Cross-collateralisation for LMI
            </label>
            <label className="check-field">
              <input type="checkbox" checked={state.two.withdraw80} onChange={(e) => patchTwo('withdraw80', e.target.checked)} /> Withdraw equity to 80%
            </label>
            <label className="check-field">
              <input type="checkbox" checked={state.two.lmiExempt} onChange={(e) => patchTwo('lmiExempt', e.target.checked)} /> LMI exempt
            </label>
          </div>
          <Actions
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
            onResetTab={() => patch('two', { ...DEFAULTS.twoProperties })}
            compareLabel={twoCalc.deal.text}
            onCompare={(slot) => saveCompare(slot, '2 Properties', compareRows)}
          />
        </section>
        <section className="panel">
          <h2>Results</h2>
          <Banner tone={twoCalc.deal.tone} lines={[twoCalc.deal.text]} />
          <Banner tone={twoCalc.warningTone} lines={twoCalc.warnings} />
          <MetricSection title="At a Glance" items={twoCalc.atAGlance} />
          <DetailSection title="Decision Guide" rows={twoCalc.decisionGuide} />
          <DetailSection title="All Calculated Results" rows={Object.entries(twoCalc.outputs).map(([label, value]) => ({ label, value }))} />
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
        <h2>Branding, Account & Defaults</h2>
        <div className="field-grid">
          {field('Brand name', state.meta.brandName, (v) => patchMeta('brandName', v as string))}
          <label className="field"><span>Signed-in broker</span><input type="text" value={state.meta.brokerName} readOnly /></label>
          <label className="field"><span>Role</span><input type="text" value={currentProfile?.role || (currentUser ? 'worker' : 'guest')} readOnly /></label>
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
        <h2>Deployment notes</h2>
        <ul className="feature-list">
          <li>For cloud sign-in, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your local <code>.env</code> and your host.</li>
          <li>Run the included SQL script once in Supabase to create the <code>profiles</code>, <code>broker_cases</code>, and <code>case_access</code> tables and policies.</li>
          <li>Guest mode still works locally if Supabase is not configured yet.</li>
        </ul>
        {authMessage && <p className="muted">{authMessage}</p>}
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
          <p>Live calculator with sign-in-ready cloud case storage, branded PDFs, and parity-focused summary blocks.</p>
        </div>
        <div className="header-badge">{currentUser?.email ? `Signed in: ${currentUser.email}` : `Broker: ${state.meta.brokerName || '—'}`}</div>
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
        {tab === 'two' && renderTwo()}
        {tab === 'refi' && renderRefi()}
        {tab === 'borrow' && renderBorrow()}
        {tab === 'compare' && renderCompare()}
        {tab === 'settings' && renderSettings()}
      </main>

      {startupStep !== 'ready' && (
        <div className="startup-overlay">
          <div className="startup-card">
            {startupStep === 'auth' && (
              <>
                <div className="eyebrow">Secure access</div>
                <h2>Sign in to unlock cloud-saved cases</h2>
                <p>
                  Use your invited broker credentials to sign in. Guest mode is still available for demos, but public sign-up is disabled.
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
                <button className="startup-link" onClick={continueAsGuest}>
                  Continue as Guest
                </button>
                {authMessage && <p className="muted">{authMessage}</p>}
                {!supabaseEnabled && (
                  <p className="muted">
                    Supabase env vars are missing. Add them before deploying if you want real sign-in tonight.
                  </p>
                )}
              </>
            )}

            {startupStep === 'brokerMenu' && (
              <>
                <div className="eyebrow">Welcome, {state.meta.brokerName || 'Broker'}{currentProfile?.role ? ` (${currentProfile.role})` : ''}</div>
                <h2>Choose how you’d like to continue</h2>
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
                            <small>{new Date(profile.savedAt).toLocaleString()} • {profile.source === 'cloud' ? 'Cloud' : 'Local'}</small>
                          </span>
                          <span>Load</span>
                        </button>
                        <div className="startup-profile-actions">
                          <button className="secondary" onClick={() => void renameProfileById(profile.id)}>Rename</button>
                          <button className="secondary" onClick={() => void duplicateProfileById(profile.id)}>Duplicate</button>
                          <button className="ghost danger" onClick={() => void deleteProfileById(profile.id)}>Delete</button>
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
        </div>
      )}
    </div>
  );
}

export default App;
