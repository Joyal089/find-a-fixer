// Must match trade_list() and suburb_list() in supabase/migrations/0001_schema.sql.
// The server rejects anything not on its own lists, so these are for display only.
import type { JobUrgency, Option } from '@/types';

export const TRADES: readonly Option[] = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'construction', label: 'Construction' },
  { value: 'air_conditioning', label: 'Air conditioning' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'painting', label: 'Painting' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'handyman', label: 'Handyman' },
];

export const SUBURBS: readonly Option[] = [
  'Darwin City',
  'Parap',
  'Fannie Bay',
  'Stuart Park',
  'Nightcliff',
  'Rapid Creek',
  'Casuarina',
  'Leanyer',
  'Karama',
  'Malak',
  'Marrara',
  'Winnellie',
  'Berrimah',
  'Palmerston',
  'Durack',
  'Howard Springs',
  'Humpty Doo',
].map((name) => ({ value: name, label: name }));

export const URGENCIES: readonly Option<JobUrgency>[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'this_week', label: 'This week' },
  { value: 'flexible', label: 'Flexible' },
];

const tradeLabels = new Map(TRADES.map((trade) => [trade.value, trade.label]));
const urgencyLabels = new Map<string, string>(URGENCIES.map((item) => [item.value, item.label]));

export const tradeLabel = (value: string): string => tradeLabels.get(value) ?? value;
export const urgencyLabel = (value: string): string => urgencyLabels.get(value) ?? value;

export const PAGE_SIZE = 15;
export const MAX_JOB_MEDIA = 6;
export const MAX_JOB_VIDEOS = 2;
export const MAX_VIDEO_SECONDS = 30;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_WIDTH = 1600;
