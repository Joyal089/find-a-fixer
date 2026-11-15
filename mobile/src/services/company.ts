import { PAGE_SIZE } from '@/constants/catalogue';
import type { Company, CompanyRegistration, LeadSummary, Profile } from '@/types';

import { throwIfError } from './errors';
import { darwinMonthStartIso } from './logic/time';
import { supabase } from './supabase';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', userId)
    .maybeSingle();
  throwIfError(error);
  return data as Profile | null;
}

export async function getMyCompany(ownerId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();
  throwIfError(error);
  return data as Company | null;
}

/** Creates the company profile as "pending"; an admin must approve it before it sees jobs. */
export async function registerCompany(input: CompanyRegistration): Promise<void> {
  const { error } = await supabase.rpc('register_company', {
    p_name: input.name,
    p_abn: input.abn.replace(/\s/g, ''),
    p_licence_number: input.licenceNumber,
    p_insurance_provider: input.insuranceProvider,
    p_insurance_expiry: input.insuranceExpiry,
    p_trades: input.trades,
    p_service_areas: input.serviceAreas,
  });
  throwIfError(error);
}

/**
 * What counts toward the monthly limit, matching accept_job on the server: charged leads
 * this Darwin calendar month, plus accepted jobs still waiting on a quote decision.
 */
export async function countLeadsThisMonth(companyId: string): Promise<number> {
  const [leads, waiting] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('counted', true)
      .gte('created_at', darwinMonthStartIso(new Date())),
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'accepted'),
  ]);
  throwIfError(leads.error);
  throwIfError(waiting.error);
  return (leads.count ?? 0) + (waiting.count ?? 0);
}

type LeadRow = {
  id: string;
  created_at: string;
  counted: boolean;
  jobs: { title: string; suburb: string } | null;
};

export async function listLeads(companyId: string, page: number): Promise<LeadSummary[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from('leads')
    .select('id, created_at, counted, jobs(title, suburb)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  throwIfError(error);
  return ((data ?? []) as unknown as LeadRow[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    counted: row.counted,
    jobTitle: row.jobs?.title ?? 'Job',
    jobSuburb: row.jobs?.suburb ?? '',
  }));
}
