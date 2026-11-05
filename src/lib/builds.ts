import type { Brief, Build, PartLine, PartStatus, Status } from '../types';
import { PART_STATUSES, STATUSES } from '../types';
import { emptyBrief } from './extract';
import { list } from './format';
import { buildPrompt } from './prompt';

export function uid(): string {
  return crypto.randomUUID();
}

export function nextTicket(builds: Build[]): string {
  const nums = builds
    .map((build) => Number(build.ticket.replace(/\D/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = (nums.length ? Math.max(...nums) : 100) + 1;
  return `PC-${next}`;
}

export function starterParts(brief: Brief): PartLine[] {
  const categories = ['CPU', 'Cooler', 'Motherboard', 'Memory', 'GPU', 'Storage', 'Power supply', 'Case', 'Fans'];
  if (/\bwindows\b/i.test(brief.mustInclude)) categories.push('Operating system');
  if (/wi-fi/i.test(brief.mustInclude)) categories.push('Networking');
  if (/\bmonitor\b/i.test(brief.mustInclude)) categories.push('Monitor');

  return categories.map((category) => ({
    id: uid(),
    category,
    name: suggestedName(category, brief),
    price: null,
    status: 'needed',
    link: '',
  }));
}

export function createBuild(
  existing: Build[],
  input: { conversation: string; brief: Brief; status?: Status },
): Build {
  const now = new Date().toISOString();
  return {
    id: uid(),
    ticket: nextTicket(existing),
    sample: false,
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'inquiry',
    holdReason: '',
    dueDate: '',
    quotedTotal: null,
    deposit: null,
    labor: null,
    notes: '',
    conversation: input.conversation,
    brief: input.brief,
    prompt: buildPrompt(input.brief, input.conversation),
    promptCustom: false,
    parts: starterParts(input.brief),
  };
}

export function briefPatch(build: Build, brief: Brief, promptCustom = build.promptCustom): Pick<Build, 'brief' | 'prompt' | 'promptCustom'> {
  return {
    brief,
    promptCustom,
    prompt: promptCustom ? build.prompt : buildPrompt(brief, build.conversation),
  };
}

export function partSummary(parts: PartLine[]): { inHouse: number; ordered: number; total: number; label: string } {
  const ordered = parts.filter((part) => part.status === 'ordered').length;
  const inHouse = parts.filter((part) => part.status === 'arrived' || part.status === 'installed').length;
  const bits: string[] = [];
  const installed = parts.filter((part) => part.status === 'installed').length;
  const arrived = parts.filter((part) => part.status === 'arrived').length;
  const needed = parts.filter((part) => part.status === 'needed').length;
  if (installed) bits.push(`${installed} installed`);
  if (arrived) bits.push(`${arrived} arrived`);
  if (ordered) bits.push(`${ordered} ordered`);
  if (needed) bits.push(`${needed} still needed`);
  return { inHouse, ordered, total: parts.length, label: bits.join(' · ') };
}

export function partsCost(parts: PartLine[]): number {
  return parts.reduce((sum, part) => sum + (part.price ?? 0), 0);
}

export function blankPart(): PartLine {
  return { id: uid(), category: 'Other', name: '', price: null, status: 'needed', link: '' };
}

function suggestedName(category: string, brief: Brief): string {
  const wishes = list(brief.partWishes);
  if (category === 'GPU') return wishes.find((wish) => /rtx|gtx|rx\s/i.test(wish)) ?? '';
  if (category === 'CPU') return wishes.find((wish) => /ryzen|core i/i.test(wish)) ?? '';
  if (category === 'Memory' && brief.ramGb) return `${brief.ramGb}GB`;
  if (category === 'Storage' && brief.storage) return brief.storage;
  if (category === 'Case') return [brief.color, brief.formFactor].filter(Boolean).join(' ');
  if (category === 'Operating system') return 'Windows 11';
  if (category === 'Networking') return 'Wi-Fi';
  if (category === 'Monitor') return brief.resolution ? `${brief.resolution} monitor` : 'Monitor';
  return '';
}

export function normalizeBuild(input: unknown): Build | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<Build>;
  if (typeof value.id !== 'string' || typeof value.ticket !== 'string') return null;
  const brief = normalizeBrief(value.brief);
  const conversation = typeof value.conversation === 'string' ? value.conversation : '';
  const status = STATUSES.some((item) => item.id === value.status) ? (value.status as Status) : 'inquiry';
  return {
    id: value.id,
    ticket: value.ticket,
    sample: Boolean(value.sample),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    status,
    holdReason: typeof value.holdReason === 'string' ? value.holdReason : '',
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : '',
    quotedTotal: numOrNull(value.quotedTotal),
    deposit: numOrNull(value.deposit),
    labor: numOrNull(value.labor),
    notes: typeof value.notes === 'string' ? value.notes : '',
    conversation,
    brief,
    prompt: typeof value.prompt === 'string' && value.prompt.trim() ? value.prompt : buildPrompt(brief, conversation),
    promptCustom: Boolean(value.promptCustom),
    parts: Array.isArray(value.parts)
      ? value.parts.map(normalizePart).filter((part): part is PartLine => part !== null)
      : starterParts(brief),
  };
}

function normalizeBrief(input: unknown): Brief {
  const blank = emptyBrief();
  if (!input || typeof input !== 'object') return blank;
  const value = input as Partial<Brief>;
  const text = (key: keyof Brief) => (typeof value[key] === 'string' ? (value[key] as string) : (blank[key] as string));
  return {
    ...blank,
    customerName: text('customerName') || 'New customer',
    contact: text('contact'),
    budgetTarget: numOrNull(value.budgetTarget),
    budgetCeiling: numOrNull(value.budgetCeiling),
    resolution: text('resolution'),
    refreshHz: numOrNull(value.refreshHz),
    games: text('games'),
    software: text('software'),
    uses: text('uses'),
    cpuBrand: value.cpuBrand === 'AMD' || value.cpuBrand === 'Intel' ? value.cpuBrand : '',
    gpuBrand: value.gpuBrand === 'NVIDIA' || value.gpuBrand === 'AMD' ? value.gpuBrand : '',
    ramGb: numOrNull(value.ramGb),
    storage: text('storage'),
    formFactor: text('formFactor'),
    color: text('color'),
    rgb: value.rgb === 'yes' || value.rgb === 'subtle' || value.rgb === 'no' ? value.rgb : '',
    alreadyOwns: text('alreadyOwns'),
    mustInclude: text('mustInclude'),
    preferences: text('preferences'),
    partWishes: text('partWishes'),
    timeline: text('timeline'),
    fulfillment: value.fulfillment === 'pickup' || value.fulfillment === 'ship' ? value.fulfillment : '',
    askThem: text('askThem'),
    quotes: Array.isArray(value.quotes) ? value.quotes.filter((quote): quote is string => typeof quote === 'string') : [],
  };
}

function normalizePart(input: unknown): PartLine | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Partial<PartLine>;
  const status = (PART_STATUSES as readonly string[]).includes(value.status as string)
    ? (value.status as PartStatus)
    : 'needed';
  return {
    id: typeof value.id === 'string' ? value.id : uid(),
    category: typeof value.category === 'string' && value.category ? value.category : 'Other',
    name: typeof value.name === 'string' ? value.name : '',
    price: numOrNull(value.price),
    status,
    link: typeof value.link === 'string' ? value.link : '',
  };
}

function numOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
