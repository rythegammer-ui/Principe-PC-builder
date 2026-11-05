import type { Brief } from '../types';
import { list } from './format';

const BUILDER = new Set(['ryan', 'me', 'i', 'principe', 'shop', 'we', 'us', 'builder']);
const GENERIC = new Set(['customer', 'client', 'them', 'him', 'her', 'buyer', 'guest']);
const RELATIVE = new Set(['mom', 'dad', 'mother', 'father', 'mama', 'papa', 'parent']);

const GAMES: [string, RegExp][] = [
  ['Fortnite', /\bfortnite\b/i],
  ['Warzone', /\bwarzone\b/i],
  ['Call of Duty', /\bcall of duty\b|\bcod\b/i],
  ['Valorant', /\bvalorant\b/i],
  ['Apex Legends', /\bapex\b/i],
  ['Minecraft', /\bminecraft\b/i],
  ['Roblox', /\broblox\b/i],
  ['Cyberpunk', /\bcyberpunk\b/i],
  ['Baldur\'s Gate', /\bbaldur'?s?\s*gate\b/i],
  ['Elden Ring', /\belden ring\b/i],
  ['Grand Theft Auto', /\bgta\b|grand theft auto/i],
  ['Counter-Strike', /\bcounter-strike\b|\bcs2\b/i],
  ['League of Legends', /\bleague of legends\b/i],
  ['Overwatch', /\boverwatch\b/i],
  ['Rocket League', /\brocket league\b/i],
  ['Helldivers', /\bhelldivers\b/i],
  ['Marvel Rivals', /\bmarvel rivals\b/i],
  ['NBA 2K', /\bnba\s*2k\b/i],
  ['EA FC', /\bea fc\b|\bfifa\b/i],
  ['Diablo', /\bdiablo\b/i],
  ['World of Warcraft', /\bworld of warcraft\b|\bwow\b/i],
  ['Rust', /\brust\b/i],
  ['Escape from Tarkov', /\btarkov\b/i],
];

const SOFTWARE: [string, RegExp][] = [
  ['Premiere', /\bpremiere\b/i],
  ['After Effects', /\bafter effects\b/i],
  ['DaVinci Resolve', /\bdavinci(?:\s+resolve)?\b/i],
  ['Photoshop', /\bphotoshop\b/i],
  ['Illustrator', /\billustrator\b/i],
  ['Blender', /\bblender\b/i],
  ['OBS', /\bobs\b/i],
  ['Unreal', /\bunreal\b/i],
  ['Unity', /\bunity\b/i],
  ['SolidWorks', /\bsolidworks\b/i],
  ['Fusion 360', /\bfusion\s*360\b/i],
  ['AutoCAD', /\bautocad\b/i],
  ['Excel', /\bexcel\b/i],
  ['FL Studio', /\bfl studio\b/i],
  ['Ableton', /\bableton\b/i],
];

interface Turn {
  speaker: 'builder' | 'customer';
  name: string;
  text: string;
}

export function emptyBrief(): Brief {
  return {
    customerName: 'New customer',
    contact: '',
    budgetTarget: null,
    budgetCeiling: null,
    resolution: '',
    refreshHz: null,
    games: '',
    software: '',
    uses: '',
    cpuBrand: '',
    gpuBrand: '',
    ramGb: null,
    storage: '',
    formFactor: '',
    color: '',
    rgb: '',
    alreadyOwns: '',
    mustInclude: '',
    preferences: '',
    partWishes: '',
    timeline: '',
    fulfillment: '',
    askThem: '',
    quotes: [],
  };
}

export function extractConversation(raw: string): Brief {
  const text = raw.replace(/\u00a0/g, ' ').trim();
  const brief = emptyBrief();
  if (!text) return brief;

  const turns = parseTurns(text);
  const customerText = turns
    .filter((turn) => turn.speaker === 'customer')
    .map((turn) => turn.text)
    .join('\n');
  const source = customerText || text;

  brief.customerName = customerName(turns, source);
  brief.contact = contactOf(text);
  const budget = budgetOf(source);
  brief.budgetTarget = budget.target;
  brief.budgetCeiling = budget.ceiling;
  brief.resolution = resolutionOf(source);
  brief.refreshHz = refreshOf(source);
  brief.games = matchNames(source, GAMES).join(', ');
  brief.software = matchNames(source, SOFTWARE).join(', ');
  brief.uses = usesOf(source, brief.games, brief.software);
  brief.cpuBrand = cpuBrandOf(source);
  brief.gpuBrand = gpuBrandOf(source);
  brief.ramGb = ramOf(source);
  brief.storage = storageOf(source);
  brief.formFactor = formFactorOf(source);
  brief.color = colorOf(source);
  brief.rgb = rgbOf(source);
  const owned = ownsOf(source);
  const needed = needsOf(source, turns);
  brief.alreadyOwns = owned.join(', ');
  brief.mustInclude = needed.join(', ');
  brief.preferences = preferencesOf(source);
  brief.partWishes = wishesOf(source);
  brief.timeline = timelineOf(source);
  brief.fulfillment = fulfillmentOf(source);
  brief.quotes = quotesOf(turns);
  return brief;
}

export function openQuestions(brief: Brief): string[] {
  const questions: string[] = [];
  const games = list(brief.games);
  const uses = list(brief.uses);
  const gaming = uses.includes('Gaming') || games.length > 0;

  if (brief.budgetTarget == null && brief.budgetCeiling == null) {
    questions.push('No budget in the thread.');
  }
  if (!games.length && !list(brief.software).length && !uses.length) {
    questions.push('What the PC is for isn\'t clear.');
  }
  if (!brief.resolution) {
    if (/\b(monitor|tv)\b/i.test(brief.alreadyOwns)) {
      questions.push('They have a display, but not the resolution or refresh.');
    } else if (gaming) {
      questions.push('No resolution or display target.');
    }
  }
  if (!brief.fulfillment) questions.push('Pickup or shipping isn\'t decided.');
  if (!/\bwindows\b/i.test(`${brief.mustInclude} ${brief.alreadyOwns}`)) {
    questions.push('Windows license wasn\'t discussed.');
  }
  if (!brief.timeline) questions.push('No timeline.');
  return questions;
}

function parseTurns(raw: string): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = trimmed.match(
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+[—–-]\s+\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?$/,
    );
    if (header) {
      current = { speaker: speakerKind(header[1]), name: header[1], text: '' };
      turns.push(current);
      continue;
    }

    const labeled = trimmed.match(/^([A-Za-z][A-Za-z.' ]{0,40}?)\s*[:\-–—]\s+(.+)$/);
    if (labeled && isLikelySpeaker(labeled[1])) {
      current = {
        speaker: speakerKind(labeled[1]),
        name: labeled[1].trim(),
        text: labeled[2].trim(),
      };
      turns.push(current);
      continue;
    }

    if (!current) {
      current = { speaker: 'customer', name: '', text: trimmed };
      turns.push(current);
    } else if (current.text) {
      current.text = `${current.text}\n${trimmed}`;
    } else {
      current.text = trimmed;
    }
  }

  return turns.filter((turn) => turn.text.trim());
}

function isLikelySpeaker(value: string): boolean {
  const name = value.trim();
  if (!name || name.length > 32 || /[0-9$]/.test(name)) return false;
  const words = name.split(/\s+/);
  if (words.length > 4) return false;
  const banned = ['hey', 'hi', 'hello', 'the', 'this', 'that', 'budget', 'need', 'want', 'yes', 'no', 'ok', 'okay', 'thanks', 'thank', 'so', 'and'];
  return !banned.includes(words[0].toLowerCase());
}

function speakerKind(name: string): 'builder' | 'customer' {
  const first = name.trim().toLowerCase().split(/\s+/)[0] ?? '';
  return BUILDER.has(first) || BUILDER.has(name.trim().toLowerCase()) ? 'builder' : 'customer';
}

function customerName(turns: Turn[], source: string): string {
  const child = source.match(/\bfor my (?:son|daughter|kid|boy|girl|child)\s+([A-Z][a-z]+)\b/);
  if (child) return child[1];

  const intro = source.match(/\b(?:my name is|this is|i am|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  const counts = new Map<string, number>();
  for (const turn of turns) {
    if (turn.speaker === 'builder') continue;
    const name = turn.name.trim();
    const key = name.toLowerCase();
    if (!name || GENERIC.has(key) || RELATIVE.has(key) || BUILDER.has(key)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

  if (intro && !GENERIC.has(intro[1].toLowerCase()) && !BUILDER.has(intro[1].toLowerCase())) {
    const fuller = ranked.find(([name]) => name.toLowerCase().startsWith(intro[1].toLowerCase()));
    return fuller?.[0] ?? intro[1];
  }
  if (ranked[0]) return ranked[0][0];
  const relative = turns.find((turn) => RELATIVE.has(turn.name.trim().toLowerCase()));
  if (relative) return relative.name.trim();
  return 'New customer';
}

function contactOf(text: string): string {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-])\d{3}[\s.-]\d{4}/);
  return [phone?.[0], email?.[0]].filter(Boolean).join(' · ');
}

function budgetOf(text: string): { target: number | null; ceiling: number | null } {
  const mentions: { amount: number; role: 'target' | 'ceiling'; index: number }[] = [];
  const remember = (amount: number, role: 'target' | 'ceiling', index: number) => {
    if (amount < 300 || amount > 20000) return;
    if (mentions.some((item) => item.amount === amount && Math.abs(item.index - index) < 8)) return;
    mentions.push({ amount, role, index });
  };

  for (const match of text.matchAll(/\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})\s*(?:-|–|to)\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})/gi)) {
    const low = numberFrom(match[1]);
    const high = numberFrom(match[2]);
    if (low >= 300 && high > low && high <= 20000 && high - low >= 50) {
      remember(low, 'target', match.index ?? 0);
      remember(high, 'ceiling', (match.index ?? 0) + match[0].length);
    }
  }

  for (const match of text.matchAll(/\$\s*(\d{1,3}(?:,\d{3})+|\d{3,5})(?:\.\d{2})?/g)) {
    const index = match.index ?? 0;
    if (!hasBudgetCue(text, index, match[0].length) || isCapacity(text, index, match[0].length)) continue;
    remember(numberFrom(match[1]), roleAround(text, index, match[0].length), index);
  }

  const keyed = /(under|below|max(?:imum)?|no more than|up to|ceiling(?: of)?|budget(?:\s+is|\s+of|\s+was)?|around|about|roughly|~)\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,5})\b/gi;
  for (const match of text.matchAll(keyed)) {
    const index = match.index ?? 0;
    if (isCapacity(text, index, match[0].length)) continue;
    const keyword = match[1].toLowerCase();
    const role = /under|below|max|no more than|up to|ceiling/.test(keyword) ? 'ceiling' : 'target';
    remember(numberFrom(match[2]), role, index);
  }

  for (const match of text.matchAll(/(?<![\w])(\d+(?:\.\d+)?)\s*k\b/gi)) {
    const index = match.index ?? 0;
    if (!isMoneyThousands(text, index)) continue;
    remember(Math.round(Number(match[1]) * 1000), roleAround(text, index, match[0].length), index);
  }

  let target: number | null = null;
  let ceiling: number | null = null;
  for (const mention of mentions.sort((a, b) => a.index - b.index)) {
    if (mention.role === 'ceiling') ceiling = mention.amount;
    else target = mention.amount;
  }
  if (target != null && ceiling != null && ceiling < target) {
    const swap = target;
    target = ceiling;
    ceiling = swap;
  }
  return { target, ceiling };
}

function hasBudgetCue(text: string, index: number, length: number): boolean {
  const window = `${localBefore(text, index, 40)}${text.slice(index + length, index + length + 16)}`.toLowerCase();
  return /budget|around|about|under|below|max|spend|afford|no more|up to|roughly|ceiling|all[- ]in|~/.test(window);
}

function isCapacity(text: string, index: number, length: number): boolean {
  return /^\s*(?:gb|tb|hz|mhz|ghz)\b/i.test(text.slice(index + length, index + length + 8));
}

function roleAround(text: string, index: number, length: number): 'target' | 'ceiling' {
  const before = localBefore(text, index, 40).toLowerCase();
  const after = text.slice(index + length, index + length + 12).toLowerCase();
  if (/under|below|max(?:imum)?|no more than|up to|ceiling/.test(before) || /^\s*max\b/.test(after)) return 'ceiling';
  return 'target';
}

function localBefore(text: string, index: number, span: number): string {
  const slice = text.slice(Math.max(0, index - span), index);
  const cut = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  return cut >= 0 ? slice.slice(cut + 1) : slice;
}

function isMoneyThousands(text: string, index: number): boolean {
  const before = localBefore(text, index, 24).toLowerCase();
  const after = text.slice(index, index + 28).toLowerCase();
  if (/nba\s*$/.test(before)) return false;
  if (/^(?:\d+(?:\.\d+)?)\s*k\b\s*(?:gaming|monitor|tv|resolution|display|video|edit)/i.test(after)) return false;
  return /\$|budget|under|around|about|max|spend|no more|up to|~/.test(before);
}

function numberFrom(raw: string): number {
  return Math.round(Number(raw.replace(/,/g, '')));
}

function resolutionOf(text: string): string {
  if (/\b4k\b|\b2160p\b|ultra\s*hd/i.test(text)) return '4K';
  if (/\b1440p\b|\bqhd\b/i.test(text)) return '1440p';
  if (/\b1080p\b|full\s*hd/i.test(text)) return '1080p';
  if (/\bultrawide\b|\b21:9\b/i.test(text)) return 'ultrawide';
  return '';
}

function refreshOf(text: string): number | null {
  const match = text.match(/\b(60|75|120|144|165|180|240|360)\s*hz\b/i);
  return match ? Number(match[1]) : null;
}

function matchNames(text: string, table: [string, RegExp][]): string[] {
  return table.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function usesOf(text: string, games: string, software: string): string {
  const uses: string[] = [];
  if (/\bpremiere\b|\bafter effects\b|\bdavinci\b|\bvideo edit/i.test(text)) uses.push('Video editing');
  if (/\bblender\b|\bunreal\b|\bunity\b|\bcad\b|\bsolidworks\b|\b3d\b/i.test(text)) uses.push('3D');
  if (/\bstream(?:ing)?\b|\bobs\b/i.test(text)) uses.push('Streaming');
  if (/\bschool(?:work)?\b|\bhomework\b|\bclass(?:es)?\b/i.test(text)) uses.push('School');
  if (/\boffice\b|\bexcel\b|\bspreadsheet\b/i.test(text)) uses.push('Office');
  if (list(games).length || /\bgaming\b|\bgames?\b/i.test(text)) uses.push('Gaming');
  if (!uses.length && list(software).length) uses.push('Creative work');
  return uses.join(', ');
}

function cpuBrandOf(text: string): '' | 'AMD' | 'Intel' {
  const marks: { index: number; brand: 'AMD' | 'Intel' }[] = [];
  for (const match of text.matchAll(/\bintel\b/gi)) marks.push({ index: match.index ?? 0, brand: 'Intel' });
  for (const match of text.matchAll(/\bryzen\b/gi)) marks.push({ index: match.index ?? 0, brand: 'AMD' });
  for (const match of text.matchAll(/\bamd\b/gi)) {
    const window = text.slice(match.index ?? 0, (match.index ?? 0) + 28);
    const before = text.slice(Math.max(0, (match.index ?? 0) - 28), match.index ?? 0);
    if (/\b(cpu|processor|chip)\b/i.test(window) || /\b(cpu|processor|chip)\b/i.test(before)) {
      marks.push({ index: match.index ?? 0, brand: 'AMD' });
    }
  }
  if (!marks.length) return '';
  marks.sort((a, b) => a.index - b.index);
  return marks[marks.length - 1].brand;
}

function gpuBrandOf(text: string): '' | 'NVIDIA' | 'AMD' {
  if (/\bnvidia\b|\bgeforce\b|\brtx\b|\bgtx\b/i.test(text)) return 'NVIDIA';
  if (/\bradeon\b|\brx\s*\d{3,4}\b|\bamd\s*(gpu|card|graphics)\b/i.test(text)) return 'AMD';
  return '';
}

function ramOf(text: string): number | null {
  const direct = text.match(/\b(8|16|32|48|64|96|128)\s*gb(?:\s+of)?\s*(?:ram|memory|ddr\d?)/i);
  if (direct) return Number(direct[1]);
  const flipped = text.match(/\b(?:ram|memory)\s*(?:of|is|at|:)?\s*(8|16|32|48|64|96|128)\s*gb\b/i);
  return flipped ? Number(flipped[1]) : null;
}

function storageOf(text: string): string {
  const pattern = /\b(at least\s+|minimum\s+)?(\d+(?:\.\d+)?)\s*(tb|gb)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const after = text.slice(index + match[0].length, index + match[0].length + 18);
    const before = text.slice(Math.max(0, index - 18), index);
    if (/\bram\b|\bmemory\b|\bddr/i.test(after) || /\b(?:ram|memory)\s*$/i.test(before)) continue;
    const unit = match[3].toLowerCase();
    const size = Number(match[2]);
    if (unit === 'gb' && size <= 128 && !/ssd|nvme|storage|drive/i.test(`${before} ${after}`)) continue;
    return `${match[2]}${unit.toUpperCase()}${match[1] ? '+' : ''}`;
  }
  return '';
}

function formFactorOf(text: string): string {
  if (/\bmini[-\s]?itx\b|\bmitx\b|\bitx\b/i.test(text)) return 'Mini-ITX';
  if (/\bmicro[-\s]?atx\b|\bm-atx\b|\bmatx\b/i.test(text)) return 'Micro-ATX';
  if (/\bsff\b|small form/i.test(text)) return 'Small form';
  if (/\bfull tower\b/i.test(text)) return 'Full tower';
  if (/\bmid tower\b/i.test(text)) return 'Mid tower';
  if (/\batx\b/i.test(text)) return 'ATX';
  return '';
}

function colorOf(text: string): string {
  const pair = text.match(/\b(white|black|pink|red|blue|silver|grey|gray|green)\s+or\s+(white|black|pink|red|blue|silver|grey|gray|green)\b/i);
  if (pair) return `${pair[1].toLowerCase()} or ${pair[2].toLowerCase()}`;
  const single = text.match(/\b(white|black|pink|red|blue|silver|grey|gray|green)\s+(?:case|build|pc|theme|mid|mini|tower)\b/i)
    ?? text.match(/\b(?:case|build|theme)\s+(?:in\s+)?(white|black|pink|red|blue|silver|grey|gray|green)\b/i);
  if (single) return single[1].toLowerCase();
  return '';
}

function rgbOf(text: string): '' | 'yes' | 'subtle' | 'no' {
  if (/\bno rgb\b|\bno lights?\b|\bno lighting\b|\bwithout rgb\b|\bnothing fancy\b/i.test(text)) return 'no';
  if (/\bsubtle rgb\b|\ba little rgb\b|\bsome rgb\b|\bnot a rainbow\b|\bminimal rgb\b|\brgb but\b/i.test(text)) return 'subtle';
  if (/\brgb\b|\blighting\b/i.test(text)) return 'yes';
  return '';
}

const OWNABLES: [string, RegExp][] = [
  ['Monitor', /\bmonitors?\b/i],
  ['Keyboard', /\bkeyboards?\b/i],
  ['Mouse', /\bmouse\b/i],
  ['Headset', /\bheadsets?\b/i],
  ['Microphone', /\bmic\b|\bmicrophone\b/i],
  ['Camera', /\bcameras?\b/i],
  ['Speakers', /\bspeakers?\b/i],
  ['TV', /\btv\b|\btelevision\b/i],
];

function ownsOf(text: string): string[] {
  const found: string[] = [];
  for (const sentence of text.split(/[.\n]/)) {
    const wants = /\b(need|needs|want|wanted|buy|include)\b/i.test(sentence);
    const has = /\b(already|have|own|got|owned)\b/i.test(sentence);
    if (!has || wants) continue;
    for (const [label, pattern] of OWNABLES) {
      if (pattern.test(sentence) && !found.includes(label)) found.push(label);
    }
  }
  return found;
}

function needsOf(text: string, turns: Turn[]): string[] {
  const found: string[] = [];
  const add = (item: string) => {
    if (!found.includes(item)) found.push(item);
  };

  for (const sentence of text.split(/[.\n]/)) {
    const wants = /\b(need|needs|want|wanted|include|with)\b/i.test(sentence);
    const has = /\b(already|have|own|got|owned)\b/i.test(sentence);
    if (!wants || has) continue;
    for (const [label, pattern] of OWNABLES) {
      if (pattern.test(sentence)) add(label);
    }
  }

  if (/\b(need|needs|with|include|want)\b[^.]{0,40}\bwindows\b|\bwindows\s*1[01]\b/i.test(text) && !/\bno windows\b|\balready have windows\b/i.test(text)) {
    add('Windows');
  }

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn.speaker !== 'builder' || !/windows/i.test(turn.text)) continue;
    const reply = turns.slice(index + 1).find((next) => next.speaker === 'customer');
    if (!reply) continue;
    if (/^\s*yes\b/i.test(reply.text)) add('Windows');
    if (/^\s*no\b/i.test(reply.text)) {
      const at = found.indexOf('Windows');
      if (at >= 0) found.splice(at, 1);
    }
  }

  if (/\bwi-?fi\b/i.test(text)) add('Wi-Fi');
  return found;
}

function preferencesOf(text: string): string {
  const prefs: string[] = [];
  if (/\bquiet\b|\bsilent\b|\blow noise\b/i.test(text)) prefs.push('quiet');
  if (/\bbookshelf\b/i.test(text)) prefs.push('has to fit on a bookshelf');
  if (/\btravel\b|\bportable\b/i.test(text)) prefs.push('moves with them');
  return prefs.join(', ');
}

function wishesOf(text: string): string {
  const wishes: string[] = [];
  const add = (wish: string) => {
    if (!wishes.includes(wish)) wishes.push(wish);
  };
  for (const match of text.matchAll(/\b(?:rtx|gtx)\s*(\d{4})\s*(ti|super)?/gi)) {
    add(`RTX ${match[1]}${match[2] ? ` ${capitalize(match[2])}` : ''}`);
  }
  for (const match of text.matchAll(/\b(\d{4})\s*(super|ti)\b/gi)) {
    if (/nvidia|geforce|rtx/i.test(text)) add(`RTX ${match[1]} ${capitalize(match[2])}`);
  }
  for (const match of text.matchAll(/\bryzen\s*([3579])\s*(\d{3,4}\s*x?(?:3d)?)/gi)) {
    add(`Ryzen ${match[1]} ${match[2].replace(/\s+/g, '').toUpperCase()}`);
  }
  return wishes.join(', ');
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function timelineOf(text: string): string {
  const dated = text.match(/\b(?:before|by|ready by)\s+([A-Z][a-z]+(?:\s+\d{1,2})?)/);
  if (dated) return dated[0].charAt(0).toUpperCase() + dated[0].slice(1);
  if (/\bnext weekend\b/i.test(text)) return 'Next weekend';
  if (/\bthis weekend\b/i.test(text)) return 'This weekend';
  if (/\bnext week\b/i.test(text)) return 'Next week';
  if (/\basap\b|as soon as possible|sooner is better|soon as you can/i.test(text)) return 'As soon as it is ready';
  return '';
}

function fulfillmentOf(text: string): '' | 'pickup' | 'ship' {
  const marks: { index: number; value: 'pickup' | 'ship' }[] = [];
  for (const match of text.matchAll(/\bpick(?:\s+\w+){0,2}\s+up\b|\bpickup\b|\bcome get\b/gi)) {
    marks.push({ index: match.index ?? 0, value: 'pickup' });
  }
  for (const match of text.matchAll(/\bship(?:ping)?\b|\bdeliver(?:y)?\b|\bmail it\b/gi)) {
    marks.push({ index: match.index ?? 0, value: 'ship' });
  }
  if (!marks.length) return '';
  marks.sort((a, b) => a.index - b.index);
  return marks[marks.length - 1].value;
}

function quotesOf(turns: Turn[]): string[] {
  const lines = turns
    .filter((turn) => turn.speaker === 'customer')
    .flatMap((turn) => turn.text.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);

  const ranked = lines
    .map((line) => {
      let score = 0;
      if (line.length > 40) score += 2;
      if (/\d/.test(line)) score += 2;
      if (/budget|\$|rgb|4k|1440|ram|nvidia|amd|windows|monitor|fortnite|edit/i.test(line)) score += 3;
      if (line.length < 20) score -= 2;
      return { line, score };
    })
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => (item.line.length > 220 ? `${item.line.slice(0, 217)}…` : item.line));

  return ranked;
}
