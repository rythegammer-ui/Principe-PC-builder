import { useEffect, useState } from 'react';
import type { Build, PartLine, PartStatus } from '../types';
import { PART_CATEGORIES, PART_STATUSES, STATUSES } from '../types';
import { blankPart, briefPatch, partSummary, partsCost } from '../lib/builds';
import { extractConversation } from '../lib/extract';
import { budgetLabel, dueMeta, money, parseMoney } from '../lib/format';
import { buildPrompt, summarizeUse, textBack } from '../lib/prompt';
import { QuestionList, SpecFields } from './SpecFields';

const PART_LABEL: Record<PartStatus, string> = {
  needed: 'Needed',
  ordered: 'Ordered',
  arrived: 'Arrived',
  installed: 'Installed',
};

export function BuildSheet({
  build,
  today,
  onClose,
  onPatch,
  onRemove,
  onCopy,
}: {
  build: Build;
  today: string;
  onClose: () => void;
  onPatch: (patch: Partial<Build>) => void;
  onRemove: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [linkOpen, setLinkOpen] = useState<Record<string, boolean>>({});
  const due = dueMeta(build.dueDate, today);
  const cost = partsCost(build.parts);
  const labor = build.labor ?? 0;
  const allIn = cost + labor;
  const over = build.quotedTotal != null && allIn > build.quotedTotal;
  const balance = build.quotedTotal == null ? null : build.quotedTotal - (build.deposit ?? 0);
  const summary = partSummary(build.parts);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function updatePart(id: string, patch: Partial<PartLine>) {
    onPatch({
      parts: build.parts.map((part) => (part.id === id ? { ...part, ...patch } : part)),
    });
  }

  function reread() {
    const brief = extractConversation(build.conversation);
    onPatch({
      brief,
      prompt: buildPrompt(brief, build.conversation),
      promptCustom: false,
    });
  }

  return (
    <>
      <button type="button" className="scrim" aria-label="Close build" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-head">
          <div>
            <p className="ticket">{build.ticket}</p>
            <input
              id="sheet-title"
              className="sheet-name"
              aria-label="Customer name"
              value={build.brief.customerName}
              onChange={(event) => onPatch(briefPatch(build, { ...build.brief, customerName: event.target.value }))}
            />
            <p className="sheet-use">{summarizeUse(build.brief)}</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </header>

        <div className="sheet-status">
          <label className="field">
            <span>Status</span>
            <select
              value={build.status}
              onChange={(event) => onPatch({ status: event.target.value as Build['status'] })}
            >
              {STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Due</span>
            <input
              type="date"
              value={build.dueDate}
              onChange={(event) => onPatch({ dueDate: event.target.value })}
            />
          </label>
          {due.tone === 'overdue' && <p className="due due-overdue sheet-due">{due.label}</p>}
        </div>
        {build.status === 'hold' && (
          <label className="field">
            <span>Why it&apos;s sitting</span>
            <input
              value={build.holdReason}
              placeholder="Waiting on a part"
              onChange={(event) => onPatch({ holdReason: event.target.value })}
            />
          </label>
        )}

        <div className="money-row">
          <MoneyBox label="Quote" value={build.quotedTotal} onChange={(quotedTotal) => onPatch({ quotedTotal })} />
          <MoneyBox label="Deposit" value={build.deposit} onChange={(deposit) => onPatch({ deposit })} />
          <MoneyBox label="Labor" value={build.labor} onChange={(laborValue) => onPatch({ labor: laborValue })} />
          <div className="money-note">
            <span>Balance</span>
            <strong>{balance == null ? '—' : money(balance)}</strong>
            <small>
              {over
                ? `Parts plus labor ${money(allIn)} are over the quote.`
                : `Parts ${money(cost)}${build.labor != null ? ` · labor ${money(labor)}` : ''}`}
            </small>
          </div>
        </div>

        <section>
          <div className="section-head">
            <h2>Parts</h2>
            <span className="quiet">{summary.label || 'Nothing logged'}</span>
          </div>
          <div className="parts">
            {build.parts.map((part) => (
              <div className="part" key={part.id}>
                <select
                  aria-label="Category"
                  value={part.category}
                  onChange={(event) => updatePart(part.id, { category: event.target.value })}
                >
                  {PART_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  {!PART_CATEGORIES.includes(part.category as typeof PART_CATEGORIES[number]) && (
                    <option>{part.category}</option>
                  )}
                </select>
                <input
                  aria-label="Part"
                  value={part.name}
                  placeholder="Part"
                  onChange={(event) => updatePart(part.id, { name: event.target.value })}
                />
                <input
                  aria-label="Price"
                  inputMode="numeric"
                  value={part.price ?? ''}
                  placeholder="$"
                  onChange={(event) => updatePart(part.id, { price: parseMoney(event.target.value) })}
                />
                <select
                  aria-label="Part status"
                  value={part.status}
                  onChange={(event) => updatePart(part.id, { status: event.target.value as PartStatus })}
                >
                  {PART_STATUSES.map((status) => <option key={status} value={status}>{PART_LABEL[status]}</option>)}
                </select>
                <button type="button" className="icon" aria-label={`Remove ${part.category}`} onClick={() => onPatch({ parts: build.parts.filter((item) => item.id !== part.id) })}>
                  ×
                </button>
                {(part.link || linkOpen[part.id]) && (
                  <input
                    className="part-link"
                    aria-label="Link"
                    value={part.link}
                    placeholder="Link"
                    onChange={(event) => updatePart(part.id, { link: event.target.value })}
                  />
                )}
                {!part.link && !linkOpen[part.id] && (
                  <button
                    type="button"
                    className="textish"
                    onClick={() => setLinkOpen((current) => ({ ...current, [part.id]: true }))}
                  >
                    Add a link
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => onPatch({ parts: [...build.parts, blankPart()] })}>
            Add a part
          </button>
        </section>

        <section>
          <h2>Specs</h2>
          <p className="quiet budget-line">From the thread: {budgetLabel(build.brief.budgetTarget, build.brief.budgetCeiling)}</p>
          <SpecFields brief={build.brief} onChange={(brief) => onPatch(briefPatch(build, brief))} />
        </section>

        <section>
          <h2>Still open</h2>
          <QuestionList brief={build.brief} />
        </section>

        <section className="text-back">
          <div className="section-head">
            <h2>Text back</h2>
            <button type="button" className="ghost" onClick={() => onCopy(textBack(build.brief), 'Text copied')}>Copy</button>
          </div>
          <p>{textBack(build.brief)}</p>
        </section>

        <section>
          <div className="section-head">
            <h2>Build prompt</h2>
            <div className="row-actions">
              {build.promptCustom && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onPatch({ prompt: buildPrompt(build.brief, build.conversation), promptCustom: false })}
                >
                  Rewrite from specs
                </button>
              )}
              <button type="button" className="ghost" onClick={() => onCopy(build.prompt, 'Prompt copied')}>Copy prompt</button>
            </div>
          </div>
          <textarea
            className="prompt"
            value={build.prompt}
            onChange={(event) => onPatch({ prompt: event.target.value, promptCustom: true })}
          />
        </section>

        <section>
          <h2>Bench notes</h2>
          <textarea
            rows={3}
            value={build.notes}
            placeholder="What you need to remember at the bench"
            onChange={(event) => onPatch({ notes: event.target.value })}
          />
        </section>

        <section>
          <div className="section-head">
            <h2>Thread</h2>
            <button type="button" className="ghost" onClick={reread}>Read the thread again</button>
          </div>
          <textarea
            className="thread short"
            value={build.conversation}
            onChange={(event) => onPatch({
              conversation: event.target.value,
              prompt: build.promptCustom ? build.prompt : buildPrompt(build.brief, event.target.value),
            })}
          />
          {build.brief.quotes.length > 0 && (
            <div className="quotes">
              {build.brief.quotes.map((quote) => <blockquote key={quote}>{quote}</blockquote>)}
            </div>
          )}
        </section>

        <footer className="sheet-foot">
          <p>Saved on this computer.</p>
          {confirming ? (
            <button type="button" className="danger" onClick={onRemove}>Delete {build.ticket} for good</button>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirming(true)}>Delete this build</button>
          )}
        </footer>
      </aside>
    </>
  );
}

function MoneyBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if (parseMoney(text) === value) return;
    setText(value == null ? '' : String(value));
  }, [text, value]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseMoney(event.target.value));
        }}
      />
    </label>
  );
}
