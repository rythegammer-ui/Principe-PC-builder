import { useRef, useState } from 'react';
import type { Build, Status } from '../types';
import { STATUSES } from '../types';
import { partSummary } from '../lib/builds';
import { budgetLabel, dueMeta, formatDay, money } from '../lib/format';
import { summarizeUse } from '../lib/prompt';

const BOARD = STATUSES.filter((status) => status.id !== 'delivered');

export function Bench({
  builds,
  today,
  showDelivered,
  onOpen,
  onMove,
}: {
  builds: Build[];
  today: string;
  showDelivered: boolean;
  onOpen: (id: string) => void;
  onMove: (id: string, status: Status) => void;
}) {
  const [over, setOver] = useState<Status | null>(null);
  const dragging = useRef<string | null>(null);
  const columns = showDelivered ? STATUSES : BOARD;

  return (
    <div className="board" aria-label="Build board">
      {columns.map((column) => {
        const cards = builds.filter((build) => build.status === column.id);
        return (
          <section
            key={column.id}
            className={over === column.id ? 'column is-over' : 'column'}
            aria-label={column.label}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.id);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setOver((current) => (current === column.id ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData('text/plain') || dragging.current;
              if (id) onMove(id, column.id);
              dragging.current = null;
              setOver(null);
            }}
          >
            <header className="column-head">
              <div>
                <h2>{column.label}</h2>
                <p>{column.note}</p>
              </div>
              <span>{cards.length}</span>
            </header>
            <div className="column-cards">
              {cards.map((build) => (
                <Card
                  key={build.id}
                  build={build}
                  today={today}
                  onOpen={onOpen}
                  onDragStart={(id) => { dragging.current = id; }}
                />
              ))}
              {cards.length === 0 && <p className="column-empty">Empty</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({
  build,
  today,
  onOpen,
  onDragStart,
}: {
  build: Build;
  today: string;
  onOpen: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  const dragged = useRef(false);
  const due = build.status === 'delivered'
    ? { label: formatDay(build.dueDate), tone: 'ok' as const }
    : dueMeta(build.dueDate, today);
  const progress = partSummary(build.parts);
  const started = build.parts.some((part) => part.status !== 'needed' || part.price != null);
  const figure = build.quotedTotal != null
    ? money(build.quotedTotal)
    : budgetLabel(build.brief.budgetTarget, build.brief.budgetCeiling);

  return (
    <article
      className="card"
      data-status={build.status}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => {
        dragged.current = false;
        event.dataTransfer.setData('text/plain', build.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart(build.id);
      }}
      onDragEnd={() => { dragged.current = true; }}
      onClick={() => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onOpen(build.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(build.id);
        }
      }}
    >
      <div className="card-top">
        <span className="ticket">{build.ticket}</span>
        {due.label && <span className={`due due-${due.tone}`}>{due.label}</span>}
      </div>
      <h3>{build.brief.customerName}</h3>
      <p>{summarizeUse(build.brief)}</p>
      <p className="card-money">{build.quotedTotal != null ? 'Quote' : 'Budget'} {figure}</p>
      {started && <p className="card-parts">{progress.inHouse > 0 ? `${progress.inHouse}/${progress.total} in house` : `${progress.ordered} ordered`}</p>}
      {build.status === 'hold' && build.holdReason && <p className="card-hold">{build.holdReason}</p>}
    </article>
  );
}
