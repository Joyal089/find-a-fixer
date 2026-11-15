import { createClient } from '@supabase/supabase-js';

import type { Period } from './format';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const isConfigured = Boolean(url && key);
export const supabase = createClient(url ?? 'https://not-configured.supabase.co', key ?? 'none');

export const PAGE_SIZE = 20;

export type CompanyStatus = 'pending' | 'approved' | 'suspended';

export interface Company {
  id: string;
  name: string;
  abn: string | null;
  licence_number: string;
  insurance_provider: string;
  insurance_expiry: string;
  trades: string[];
  service_areas: string[];
  status: CompanyStatus;
  monthly_lead_limit: number;
  created_at: string;
}

export interface LeadSummaryRow {
  company_id: string;
  company_name: string;
  leads_total: number;
  leads_counted: number;
}

export interface LeadRow {
  id: string;
  created_at: string;
  counted: boolean;
  admin_note: string | null;
  companies: { name: string } | null;
  jobs: { title: string; suburb: string } | null;
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** True when the signed-in user has the admin role. The database enforces this too. */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  check(error);
  return (data as { role: string } | null)?.role === 'admin';
}

export async function listCompanies(status: CompanyStatus, page: number): Promise<Company[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  check(error);
  return (data ?? []) as Company[];
}

export async function setCompanyStatus(companyId: string, status: CompanyStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_company_status', {
    p_company_id: companyId,
    p_status: status,
  });
  check(error);
}

export async function setLeadLimit(companyId: string, limit: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_lead_limit', {
    p_company_id: companyId,
    p_limit: limit,
  });
  check(error);
}

export async function leadSummary(period: Period): Promise<LeadSummaryRow[]> {
  const { data, error } = await supabase.rpc('admin_lead_summary', {
    p_from: period.from,
    p_to: period.to,
  });
  check(error);
  return (data ?? []) as LeadSummaryRow[];
}

export async function listLeads(period: Period, page: number): Promise<LeadRow[]> {
  const from = page * PAGE_SIZE;
  const { data, error } = await supabase
    .from('leads')
    .select('id, created_at, counted, admin_note, companies(name), jobs(title, suburb)')
    .gte('created_at', period.startIso)
    .lt('created_at', period.endIso)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  check(error);
  return (data ?? []) as unknown as LeadRow[];
}

export async function setLeadCounted(leadId: string, counted: boolean, note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_lead_counted', {
    p_lead_id: leadId,
    p_counted: counted,
    p_note: note,
  });
  check(error);
}
