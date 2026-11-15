import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { signOut as signOutOfSupabase } from '@/services/auth';
import { getMyCompany, getProfile } from '@/services/company';
import { toFriendlyMessage } from '@/services/errors';
import { registerForPush, unregisterPush } from '@/services/notifications';
import { supabase } from '@/services/supabase';
import type { Company, Profile } from '@/types';

interface SessionValue {
  /** True until the stored session and the user's profile have been loaded. */
  loading: boolean;
  userId: string | null;
  phoneVerified: boolean;
  hasEmail: boolean;
  profile: Profile | null;
  company: Company | null;
  error: string | null;
  /** Reloads profile and company, e.g. after registering a company. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

interface Account {
  profile: Profile | null;
  company: Company | null;
}

const NO_ACCOUNT: Account = { profile: null, company: null };

interface AccountOutcome {
  account: Account | null;
  error: string | null;
}

/** Loads profile and company. Never rejects: failures come back as a message. */
async function fetchAccount(userId: string | null): Promise<AccountOutcome> {
  if (!userId) return { account: NO_ACCOUNT, error: null };
  try {
    const profile = await getProfile(userId);
    const company = profile?.role === 'company' ? await getMyCompany(userId) : null;
    return { account: { profile, company }, error: null };
  } catch (caught) {
    return { account: null, error: toFriendlyMessage(caught) };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [account, setAccount] = useState<Account>(NO_ACCOUNT);
  const [accountFor, setAccountFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    // Fires once with the stored session on start-up, then on every sign-in and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const applyAccount = useCallback((forUser: string | null, outcome: AccountOutcome) => {
    if (outcome.account) setAccount(outcome.account);
    setError(outcome.error);
    setAccountFor(forUser);
  }, []);

  const refresh = useCallback(async () => {
    applyAccount(userId, await fetchAccount(userId));
  }, [userId, applyAccount]);

  useEffect(() => {
    let active = true;
    void fetchAccount(userId).then((outcome) => {
      if (active) applyAccount(userId, outcome);
    });
    if (userId) void registerForPush(userId);
    return () => {
      active = false;
    };
  }, [userId, applyAccount]);

  const signOut = useCallback(async () => {
    if (userId) await unregisterPush(userId);
    await signOutOfSupabase();
  }, [userId]);

  const value = useMemo<SessionValue>(
    () => ({
      loading: !sessionReady || accountFor !== userId,
      userId,
      phoneVerified: Boolean(session?.user.phone_confirmed_at),
      hasEmail: Boolean(session?.user.email),
      profile: account.profile,
      company: account.company,
      error,
      refresh,
      signOut,
    }),
    [sessionReady, accountFor, userId, session, account, error, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
