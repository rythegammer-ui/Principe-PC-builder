export const STATUSES = [
  { id: 'inquiry', label: 'Inquiry', note: 'Just landed' },
  { id: 'quoted', label: 'Quoted', note: 'Number is out' },
  { id: 'approved', label: 'Approved', note: 'They said build it' },
  { id: 'parts', label: 'Parts', note: 'Ordered or arriving' },
  { id: 'bench', label: 'On the bench', note: 'Being built' },
  { id: 'testing', label: 'Testing', note: 'Burn-in' },
  { id: 'ready', label: 'Ready', note: 'Ready to go' },
  { id: 'hold', label: 'On hold', note: 'Blocked' },
  { id: 'delivered', label: 'Delivered', note: 'Out the door' },
] as const;

export type Status = (typeof STATUSES)[number]['id'];

export const PART_STATUSES = ['needed', 'ordered', 'arrived', 'installed'] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

export const PART_CATEGORIES = [
  'CPU',
  'Cooler',
  'Motherboard',
  'Memory',
  'GPU',
  'Storage',
  'Power supply',
  'Case',
  'Fans',
  'Operating system',
  'Networking',
  'Monitor',
  'Other',
] as const;

export interface Brief {
  customerName: string;
  contact: string;
  budgetTarget: number | null;
  budgetCeiling: number | null;
  resolution: string;
  refreshHz: number | null;
  games: string;
  software: string;
  uses: string;
  cpuBrand: '' | 'AMD' | 'Intel';
  gpuBrand: '' | 'NVIDIA' | 'AMD';
  ramGb: number | null;
  storage: string;
  formFactor: string;
  color: string;
  rgb: '' | 'yes' | 'subtle' | 'no';
  alreadyOwns: string;
  mustInclude: string;
  preferences: string;
  partWishes: string;
  timeline: string;
  fulfillment: '' | 'pickup' | 'ship';
  askThem: string;
  quotes: string[];
}

export interface PartLine {
  id: string;
  category: string;
  name: string;
  price: number | null;
  status: PartStatus;
  link: string;
}

export interface Build {
  id: string;
  ticket: string;
  sample: boolean;
  createdAt: string;
  updatedAt: string;
  status: Status;
  holdReason: string;
  dueDate: string;
  quotedTotal: number | null;
  deposit: number | null;
  labor: number | null;
  notes: string;
  conversation: string;
  brief: Brief;
  prompt: string;
  promptCustom: boolean;
  parts: PartLine[];
}

export interface Persisted {
  version: 1;
  banner: boolean;
  builds: Build[];
}
