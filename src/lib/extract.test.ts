import { describe, expect, it } from 'vitest';
import {
  CHRIS,
  ELENA,
  JORDAN,
  MARCUS,
  PRIYA,
} from '../data/threads';
import { extractConversation, openQuestions } from './extract';
import { buildPrompt, summarizeUse, textBack } from './prompt';

describe('extractConversation', () => {
  it('reads Jordan\'s gaming thread', () => {
    const brief = extractConversation(JORDAN);
    expect(brief.customerName).toBe('Jordan');
    expect(brief.budgetTarget).toBe(1800);
    expect(brief.budgetCeiling).toBe(2000);
    expect(brief.resolution).toBe('1440p');
    expect(brief.refreshHz).toBe(165);
    expect(brief.games).toBe('Fortnite, Warzone');
    expect(brief.gpuBrand).toBe('NVIDIA');
    expect(brief.color).toBe('white');
    expect(brief.rgb).toBe('subtle');
    expect(brief.alreadyOwns).toBe('Monitor, Keyboard, Mouse');
    expect(brief.mustInclude).toContain('Windows');
    expect(brief.timeline).toBe('Next weekend');
    expect(brief.fulfillment).toBe('pickup');
    expect(summarizeUse(brief)).toBe('1440p gaming · Fortnite, Warzone');
  });

  it('reads Priya\'s editing thread', () => {
    const brief = extractConversation(PRIYA);
    expect(brief.customerName).toBe('Priya Shah');
    expect(brief.budgetTarget).toBeNull();
    expect(brief.budgetCeiling).toBe(2500);
    expect(brief.resolution).toBe('4K');
    expect(brief.games).toContain("Baldur's Gate");
    expect(brief.software).toContain('Premiere');
    expect(brief.software).toContain('After Effects');
    expect(brief.uses).toContain('Video editing');
    expect(brief.ramGb).toBe(64);
    expect(brief.storage).toBe('2TB+');
    expect(brief.cpuBrand).toBe('Intel');
    expect(brief.color).toBe('black');
    expect(brief.rgb).toBe('no');
    expect(brief.preferences).toContain('quiet');
    expect(brief.alreadyOwns).toContain('Monitor');
    expect(brief.fulfillment).toBe('ship');
    expect(brief.timeline).toBe('Before November 20');
  });

  it('reads a parent texting for Marcus', () => {
    const brief = extractConversation(MARCUS);
    expect(brief.customerName).toBe('Marcus');
    expect(brief.budgetCeiling).toBe(800);
    expect(brief.budgetTarget).toBeNull();
    expect(brief.games).toBe('Minecraft, Roblox');
    expect(brief.uses).toContain('School');
    expect(brief.mustInclude).toContain('Monitor');
    expect(brief.rgb).toBe('no');
    expect(brief.fulfillment).toBe('pickup');
    expect(brief.timeline).toBe('As soon as it is ready');
    expect(brief.resolution).toBe('');
    expect(openQuestions(brief)).toContain('No resolution or display target.');
  });

  it('reads Elena\'s small 4K build', () => {
    const brief = extractConversation(ELENA);
    expect(brief.customerName).toBe('Elena Voss');
    expect(brief.budgetTarget).toBe(3000);
    expect(brief.resolution).toBe('4K');
    expect(brief.games).toContain('Cyberpunk');
    expect(brief.cpuBrand).toBe('AMD');
    expect(brief.gpuBrand).toBe('');
    expect(brief.formFactor).toBe('Mini-ITX');
    expect(brief.color).toBe('white or silver');
    expect(brief.mustInclude).toContain('Wi-Fi');
    expect(brief.alreadyOwns).toContain('TV');
    expect(brief.preferences).toContain('bookshelf');
    expect(brief.preferences).toContain('moves with them');
  });

  it('reads Chris\'s hold thread without treating the GPU price as the budget', () => {
    const brief = extractConversation(CHRIS);
    expect(brief.customerName).toBe('Chris Nguyen');
    expect(brief.budgetTarget).toBe(1600);
    expect(brief.resolution).toBe('1440p');
    expect(brief.games).toContain('Valorant');
    expect(brief.software).toContain('OBS');
    expect(brief.software).toContain('DaVinci Resolve');
    expect(brief.gpuBrand).toBe('NVIDIA');
    expect(brief.partWishes).toBe('RTX 4070 Super');
    expect(brief.ramGb).toBe(32);
    expect(brief.color).toBe('black');
    expect(brief.formFactor).toBe('Mid tower');
    expect(brief.alreadyOwns).toBe('Microphone, Camera');
    expect(openQuestions(brief)).toContain('Pickup or shipping isn\'t decided.');
  });

  it('does not turn NBA 2K or a part price into the budget', () => {
    const brief = extractConversation('Sam: I play NBA 2K. The card I saw was $550. Budget around $1,200.');
    expect(brief.games).toContain('NBA 2K');
    expect(brief.budgetTarget).toBe(1200);
    expect(brief.budgetCeiling).toBeNull();
  });

  it('reads a short school build without keeping another customer\'s specs', () => {
    const brief = extractConversation('Sam: Hey, I need a PC for Excel and school, under $700. I already have a monitor. No lights. I can pick it up.');
    expect(brief.customerName).toBe('Sam');
    expect(brief.budgetTarget).toBeNull();
    expect(brief.budgetCeiling).toBe(700);
    expect(brief.games).toBe('');
    expect(brief.software).toBe('Excel');
    expect(brief.uses).toContain('School');
    expect(brief.resolution).toBe('');
    expect(brief.ramGb).toBeNull();
    expect(brief.storage).toBe('');
    expect(brief.formFactor).toBe('');
    expect(brief.rgb).toBe('no');
    expect(brief.alreadyOwns).toContain('Monitor');
    expect(brief.fulfillment).toBe('pickup');
  });

  it('keeps a 4K gaming target separate from a $4k budget', () => {
    const brief = extractConversation('Ava: Budget around 4k for 4K gaming, mostly Cyberpunk.');
    expect(brief.budgetTarget).toBe(4000);
    expect(brief.resolution).toBe('4K');
    expect(brief.games).toContain('Cyberpunk');
  });
});

describe('build prompt', () => {
  it('includes the constraints and refuses invented preferences', () => {
    const brief = extractConversation(JORDAN);
    const prompt = buildPrompt(brief, JORDAN);
    expect(prompt).toContain('Do not invent a preference');
    expect(prompt).toContain('Jordan');
    expect(prompt).toContain('$1,800–$2,000');
    expect(prompt).toContain('Fortnite');
    expect(prompt).toContain('Principe labor');
    expect(prompt).toContain('THREAD');
    expect(prompt).toContain('I can pick it up next weekend');
    expect(textBack(brief)).toContain('Fortnite');
    expect(textBack(brief)).toContain('$1,800');
    expect(textBack(brief)).toContain('monitor');
  });

  it('asks for the missing budget instead of guessing', () => {
    const brief = extractConversation('Taylor: Can you build me something for school?');
    expect(textBack(brief)).toContain('budget');
    expect(openQuestions(brief)).toContain('No budget in the thread.');
  });
});
