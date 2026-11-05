import { CHRIS, ELENA, JORDAN, MARCUS, PRIYA } from './threads';
import type { Build, PartLine } from '../types';
import { extractConversation } from '../lib/extract';
import { addDays } from '../lib/format';
import { starterParts } from '../lib/builds';
import { buildPrompt } from '../lib/prompt';

export function sampleBuilds(today: string): Build[] {
  return [
    ticket(JORDAN, 'PC-104', {
      status: 'bench',
      dueDate: addDays(today, 4),
      quotedTotal: 1850,
      deposit: 600,
      labor: 150,
      notes: 'Glass side. He picks it up next weekend. Do not go over $2,000.',
      parts: {
        CPU: { name: 'Ryzen 5 7600', price: 195, status: 'installed' },
        Cooler: { name: 'Peerless Assassin 120', price: 36, status: 'installed' },
        Motherboard: { name: 'B650M', price: 150, status: 'installed' },
        Memory: { name: '32GB DDR5', price: 95, status: 'arrived' },
        GPU: { name: 'RTX 4070', price: 549, status: 'arrived' },
        Storage: { name: '2TB NVMe', price: 115, status: 'arrived' },
        'Power supply': { name: '750W Gold', price: 99, status: 'arrived' },
        Case: { name: 'White mid tower', price: 110, status: 'arrived' },
        Fans: { name: 'Three white fans', price: 28, status: 'needed' },
        'Operating system': { name: 'Windows 11', price: 139, status: 'needed' },
      },
    }),
    ticket(PRIYA, 'PC-105', {
      status: 'parts',
      dueDate: addDays(today, 11),
      quotedTotal: 2400,
      deposit: 800,
      labor: 200,
      notes: 'Ship it. 64GB is a requirement. She asked for quiet.',
      parts: {
        CPU: { name: 'Intel Core i7', price: 320, status: 'ordered' },
        Cooler: { name: 'Quiet tower cooler', price: 80, status: 'ordered' },
        Motherboard: { name: 'Z790', price: 230, status: 'ordered' },
        Memory: { name: '64GB DDR5', price: 180, status: 'ordered' },
        GPU: { name: 'RTX 4070 Super', price: 590, status: 'ordered' },
        Storage: { name: '2TB NVMe', price: 120, status: 'ordered' },
        'Power supply': { name: '850W Gold', price: 130, status: 'ordered' },
        Case: { name: 'Black quiet case', price: 140, status: 'ordered' },
        Fans: { name: 'Quiet fans', price: 40, status: 'ordered' },
      },
    }),
    ticket(MARCUS, 'PC-106', {
      status: 'ready',
      dueDate: addDays(today, -1),
      quotedTotal: 790,
      deposit: 200,
      labor: 80,
      notes: 'Mom pays the rest at pickup. Keep the cable job tidy.',
      parts: {
        CPU: { name: 'Ryzen 5 5600', price: 120, status: 'installed' },
        Cooler: { name: 'Stock cooler', price: 0, status: 'installed' },
        Motherboard: { name: 'B550', price: 90, status: 'installed' },
        Memory: { name: '16GB DDR4', price: 40, status: 'installed' },
        GPU: { name: 'Radeon RX 6600', price: 180, status: 'installed' },
        Storage: { name: '1TB SSD', price: 60, status: 'installed' },
        'Power supply': { name: '550W', price: 55, status: 'installed' },
        Case: { name: 'Plain black case', price: 50, status: 'installed' },
        Fans: { name: 'Case fans', price: 15, status: 'installed' },
        Monitor: { name: '1080p 100Hz', price: 110, status: 'installed' },
      },
    }),
    ticket(ELENA, 'PC-107', {
      status: 'inquiry',
      dueDate: '',
      quotedTotal: null,
      deposit: null,
      labor: null,
      notes: '',
    }),
    ticket(CHRIS, 'PC-108', {
      status: 'hold',
      dueDate: addDays(today, 14),
      quotedTotal: 1600,
      deposit: null,
      labor: 150,
      holdReason: '4070 Super is out of stock.',
      notes: 'Do not substitute the GPU without texting him.',
      parts: {
        CPU: { name: 'Ryzen 5 7600', price: 195, status: 'ordered' },
        Cooler: { name: 'Tower cooler', price: 35, status: 'ordered' },
        Motherboard: { name: 'B650', price: 150, status: 'ordered' },
        Memory: { name: '32GB DDR5', price: 95, status: 'ordered' },
        GPU: { name: 'RTX 4070 Super', price: null, status: 'needed' },
        Storage: { name: '1TB NVMe', price: 70, status: 'ordered' },
        'Power supply': { name: '650W Gold', price: 90, status: 'ordered' },
        Case: { name: 'Black mid tower', price: 85, status: 'ordered' },
        Fans: { name: 'Case fans', price: 20, status: 'ordered' },
      },
    }),
  ];
}

function ticket(
  conversation: string,
  number: string,
  extra: Omit<Partial<Build>, 'parts'> & { parts?: Record<string, Partial<PartLine>> },
): Build {
  const brief = extractConversation(conversation);
  const now = new Date().toISOString();
  const { parts: partEdits, ...rest } = extra;
  const parts = starterParts(brief).map((part) => ({
    ...part,
    id: `${number}-${part.category}`,
    ...(partEdits?.[part.category] ?? {}),
  }));
  return {
    id: `sample-${number}`,
    ticket: number,
    sample: true,
    createdAt: now,
    updatedAt: now,
    status: 'inquiry',
    holdReason: '',
    dueDate: '',
    quotedTotal: null,
    deposit: null,
    labor: null,
    notes: '',
    conversation,
    brief,
    prompt: buildPrompt(brief, conversation),
    promptCustom: false,
    parts,
    ...rest,
  };
}
