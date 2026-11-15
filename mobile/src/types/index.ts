// Row shapes mirror supabase/migrations/0001_schema.sql.

export type UserRole = 'customer' | 'company' | 'admin';
export type CompanyStatus = 'pending' | 'approved' | 'suspended';
export type JobStatus = 'posted' | 'accepted' | 'scheduled' | 'completed' | 'cancelled';
export type JobUrgency = 'emergency' | 'this_week' | 'flexible';
export type QuoteStatus = 'pending' | 'accepted' | 'declined';
export type MediaType = 'photo' | 'video';

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  abn: string | null;
  licence_number: string;
  insurance_provider: string;
  insurance_expiry: string;
  trades: string[];
  service_areas: string[];
  status: CompanyStatus;
  monthly_lead_limit: number;
}

export interface Job {
  id: string;
  customer_id: string;
  category: string;
  title: string;
  description: string;
  suburb: string;
  urgency: JobUrgency;
  status: JobStatus;
  company_id: string | null;
  accepted_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** A job row as listed in feeds, with how many photos/videos are attached. */
export interface JobSummary extends Job {
  mediaCount: number;
  /** Signed link to the first photo, if the job has one. Valid for an hour. */
  thumbnailUrl: string | null;
}

export interface JobContact {
  job_id: string;
  address: string;
  contact_phone: string;
}

export interface Quote {
  id: string;
  job_id: string;
  company_id: string;
  amount_cents: number;
  notes: string | null;
  proposed_time: string;
  status: QuoteStatus;
  created_at: string;
}

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  body: string | null;
  media_path: string | null;
  created_at: string;
}

export interface LeadSummary {
  id: string;
  created_at: string;
  counted: boolean;
  jobTitle: string;
  jobSuburb: string;
}

/** Media chosen on the device, before upload. */
export interface PickedMedia {
  uri: string;
  type: MediaType;
  mimeType: string;
  width: number;
}

/** Stored media with a short-lived signed URL for display. */
export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
}

export interface NewJobInput {
  category: string;
  title: string;
  description: string;
  suburb: string;
  address: string;
  urgency: JobUrgency;
  media: PickedMedia[];
}

export interface CompanyRegistration {
  name: string;
  abn: string;
  licenceNumber: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  trades: string[];
  serviceAreas: string[];
}

export interface Option<T extends string = string> {
  value: T;
  label: string;
}
