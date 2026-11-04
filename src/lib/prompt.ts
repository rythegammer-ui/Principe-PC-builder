import type { Brief } from '../types';
import { openQuestions } from './extract';
import { budgetLabel, list, money } from './format';

export function summarizeUse(brief: Brief): string {
  const games = list(brief.games);
  const software = list(brief.software);
  const uses = list(brief.uses);
  const roles = uses.filter((use) => use !== 'Gaming').slice(0, 2);
  const gaming = uses.includes('Gaming') || games.length > 0;
  const role = roles.join(' & ').toLowerCase();
  const head = [brief.resolution, role || (gaming ? 'gaming' : '')].filter(Boolean).join(' ');
  const tail = [...games.slice(0, 2), ...software.slice(0, 1)].join(', ');
  if (head && tail) return `${head} · ${tail}`;
  return head || tail || 'Specs still open';
}

export function textBack(brief: Brief): string {
  const first = brief.customerName && brief.customerName !== 'New customer'
    ? brief.customerName.split(' ')[0]
    : '';
  const hello = first ? `${first} — ` : '';
  const questions = openQuestions(brief);
  const thin = brief.budgetTarget == null && brief.budgetCeiling == null && !list(brief.games).length && !list(brief.software).length;

  if (thin) {
    return `${hello}Got the message. Send me a budget and what the PC is for, and I'll spec it.`.trim();
  }

  const moneyBit = brief.budgetCeiling && brief.budgetTarget == null
    ? `under ${money(brief.budgetCeiling)}`
    : brief.budgetTarget && brief.budgetCeiling
      ? `around ${money(brief.budgetTarget)}, ${money(brief.budgetCeiling)} max`
      : brief.budgetTarget
        ? `around ${money(brief.budgetTarget)}`
        : '';

  const phrase = usePhrase(brief);
  const extras: string[] = [];
  if (brief.gpuBrand) extras.push(brief.gpuBrand === 'NVIDIA' ? 'an NVIDIA card' : 'an AMD card');
  if (brief.cpuBrand) extras.push(`an ${brief.cpuBrand} CPU`);
  if (brief.color || brief.formFactor) {
    extras.push(`a ${[brief.color, brief.formFactor].filter(Boolean).join(' ')} case`);
  }
  if (brief.rgb === 'no') extras.push('no lighting');
  if (brief.rgb === 'subtle') extras.push('subtle lighting');

  let message = `${hello}I'll spec ${phrase}${moneyBit ? ` ${moneyBit}` : ''}`;
  if (extras.length) message += `, with ${joinList(extras)}`;
  message += '.';

  if (/\bmonitor\b/i.test(brief.alreadyOwns)) message += ' You already have the monitor, so I\'ll leave that off.';
  else if (/\bmonitor\b/i.test(brief.mustInclude)) message += ' I\'ll include a monitor.';
  if (/\btv\b/i.test(brief.alreadyOwns)) message += ' I\'ll leave the display off since you already have a TV.';
  if (brief.timeline) message += ` Timing: ${brief.timeline}.`;
  if (questions.some((question) => question.startsWith('No budget') || question.startsWith('What the PC'))) {
    message += ' I still need the open items below before I lock parts.';
  } else {
    message += ' I\'ll send the list once it\'s tight.';
  }
  return message.replace(/\s+/g, ' ').trim();
}

export function buildPrompt(brief: Brief, conversation: string): string {
  const questions = [...openQuestions(brief), ...extraQuestions(brief.askThem)];
  const lines = [
    'You are speccing a custom PC for Principe Computers. Ryan builds the machine, orders the parts, and texts the customer. Use only what the thread supports. If a requirement was not stated, write "not stated" and pick a reliable default. Do not invent a preference and present it as the customer\'s.',
    '',
    'CUSTOMER',
    `- Name: ${shown(brief.customerName)}`,
    `- Contact: ${shown(brief.contact)}`,
    `- Use: ${summarizeUse(brief)}`,
    `- Budget: ${budgetLabel(brief.budgetTarget, brief.budgetCeiling)}`,
    `- Timeline: ${shown(brief.timeline)}`,
    `- Fulfillment: ${brief.fulfillment === 'pickup' ? 'Pickup' : brief.fulfillment === 'ship' ? 'Ship' : 'not stated'}`,
    '',
    'SPECS TO HIT',
    `- Resolution: ${shown(brief.resolution)}`,
    `- Refresh: ${brief.refreshHz ? `${brief.refreshHz}Hz` : 'not stated'}`,
    `- Games: ${shown(brief.games)}`,
    `- Software: ${shown(brief.software)}`,
    `- CPU brand: ${shown(brief.cpuBrand)}`,
    `- GPU brand: ${shown(brief.gpuBrand)}`,
    `- Memory: ${brief.ramGb ? `${brief.ramGb}GB` : 'not stated'}`,
    `- Storage: ${shown(brief.storage)}`,
    `- Form factor: ${shown(brief.formFactor)}`,
    `- Case color: ${shown(brief.color)}`,
    `- Lighting: ${lightingLabel(brief.rgb)}`,
    `- Already owns: ${shown(brief.alreadyOwns)}`,
    `- Must include: ${shown(brief.mustInclude)}`,
    `- Preferences: ${shown(brief.preferences)}`,
    `- Parts they named: ${shown(brief.partWishes)}`,
    '',
    'STILL OPEN',
    ...(questions.length ? questions.map((question) => `- ${question}`) : ['- Nothing blocking. Spec from the facts above.']),
    '',
    'IN THEIR WORDS',
    ...(brief.quotes.length ? brief.quotes.map((quote) => `> ${quote}`) : ['> (no standout line)']),
    '',
    'WHAT TO RETURN',
    '1. The build you would actually assemble. One parts list: CPU, cooler, motherboard, memory, GPU, storage, power supply, case, fans, plus OS, Wi-Fi, or a monitor only if they need them. Exact current product names, a street-price estimate, and why that part fits this customer.',
    '2. A compatibility pass: socket, cooler height and RAM clearance, GPU length, case support, and power supply wattage with at least 30% headroom over the estimated load.',
    '3. Money: parts total, a labor line left as "Principe labor", Windows if needed, and the gap versus the budget. The ceiling is a limit. If you are more than $100 over it, change parts until you are under it and say what got worse.',
    '4. Only when the budget is tight, a second list called "If they can stretch" that spends at most $150 more and names the one thing that money buys.',
    '5. A text Ryan can send, under 80 words, plain language, no spec dump. Start from this draft if it is still accurate:',
    textBack(brief),
    '6. Bench notes: assembly order, BIOS settings that matter for this platform, and a first-boot test (display, temps, memory, storage, and one game or export they actually named).',
    '',
    'JUDGMENT',
    '- Match the resolution and the games or apps they named. Do not spec a flagship GPU for a light game at 1080p.',
    '- Prefer quiet parts when they asked for quiet, and a small case when they asked for small.',
    '- Leave off a monitor, keyboard, or Windows when they already own them.',
    '- If a named part is a bad value or out of step with the budget, say so and offer the part you would order instead.',
    '- Call out anything you are unsure about instead of burying it in the list.',
    '',
    'THREAD',
    conversation.trim() || '(no thread pasted)',
  ];
  return lines.join('\n');
}

function usePhrase(brief: Brief): string {
  const games = list(brief.games).slice(0, 2);
  const software = list(brief.software).slice(0, 2);
  const uses = list(brief.uses);
  let kind = 'build';
  if (uses.includes('Video editing') && uses.includes('Streaming')) kind = 'editing and streaming build';
  else if (uses.includes('Video editing') && (uses.includes('Gaming') || games.length)) kind = 'edit-and-game build';
  else if (uses.includes('Video editing')) kind = 'editing build';
  else if (uses.includes('School') && games.length) kind = 'school and gaming build';
  else if (uses.includes('Streaming')) kind = 'streaming build';
  else if (uses.includes('3D')) kind = '3D build';
  else if (uses.includes('School')) kind = 'school build';
  const resolution = brief.resolution ? `${brief.resolution} ` : '';
  const names = [...games, ...software];
  const forBit = names.length ? ` for ${joinList(names)}` : '';
  return `a ${resolution}${kind}${forBit}`.replace(/\s+/g, ' ');
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function extraQuestions(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function shown(value: string): string {
  return value.trim() ? value.trim() : 'not stated';
}

function lightingLabel(rgb: Brief['rgb']): string {
  if (rgb === 'yes') return 'RGB';
  if (rgb === 'subtle') return 'subtle RGB, not a rainbow';
  if (rgb === 'no') return 'no RGB';
  return 'not stated';
}
