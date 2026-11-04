import { useEffect, useState } from 'react';
import { JORDAN } from '../data/threads';
import type { Brief, Build } from '../types';
import { createBuild } from '../lib/builds';
import { emptyBrief, extractConversation } from '../lib/extract';
import { buildPrompt, textBack } from '../lib/prompt';
import { QuestionList, SpecFields } from './SpecFields';

export function Studio({
  existing,
  onCreate,
  onCopy,
}: {
  existing: Build[];
  onCreate: (build: Build) => void;
  onCopy: (text: string, label: string) => void;
}) {
  const [conversation, setConversation] = useState('');
  const [brief, setBrief] = useState<Brief>(emptyBrief());
  const [touched, setTouched] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (touched) return;
    setBrief(extractConversation(conversation));
  }, [conversation, touched]);

  const prompt = customPrompt ?? buildPrompt(brief, conversation);
  const ready = conversation.trim().length > 0;

  function reread() {
    setBrief(extractConversation(conversation));
    setTouched(false);
    setCustomPrompt(null);
  }

  function putOnBench() {
    const build = createBuild(existing, { conversation, brief });
    if (customPrompt) {
      build.prompt = customPrompt;
      build.promptCustom = true;
    }
    onCreate(build);
  }

  return (
    <section className="studio">
      <div className="studio-intro">
        <h1>Read a thread</h1>
        <p>
          Paste the texts between you and the customer. Specs come out of the mess,
          then you get a prompt to hand to a model when you actually pick parts.
        </p>
      </div>
      <div className="thread-col">
        <label className="field">
          <span>Conversation</span>
          <textarea
            className="thread"
            value={conversation}
            placeholder={'Jordan: Budget is around $1,800\nRyan: What are you playing?'}
            onChange={(event) => {
              const next = event.target.value;
              const previous = conversation.trim();
              const incoming = next.trim();
              const replaced = previous.length > 0 && incoming !== previous && !incoming.includes(previous) && !previous.includes(incoming);
              if (replaced || incoming.length === 0) {
                setTouched(false);
                setCustomPrompt(null);
                setBrief(extractConversation(next));
              }
              setConversation(next);
            }}
          />
        </label>
        <div className="row-actions">
          <button type="button" className="ghost" onClick={() => { setConversation(JORDAN); setTouched(false); setCustomPrompt(null); }}>
            Try Jordan&apos;s thread
          </button>
          {ready && (
            <button type="button" className="ghost" onClick={reread}>
              Read the thread again
            </button>
          )}
        </div>
      </div>
      <div className="reading">
        {!ready && (
          <div className="reading-empty">
            <p>Paste a thread and the budget, games, and constraints land here.</p>
          </div>
        )}
        {ready && (
          <>
            <h2>What the thread actually says</h2>
            <SpecFields
              brief={brief}
              onChange={(next) => {
                setTouched(true);
                setBrief(next);
                setCustomPrompt(null);
              }}
            />
            <h2>Still open</h2>
            <QuestionList brief={brief} />
            {brief.quotes.length > 0 && (
              <>
                <h2>In their words</h2>
                <div className="quotes">
                  {brief.quotes.map((quote) => <blockquote key={quote}>{quote}</blockquote>)}
                </div>
              </>
            )}
            <div className="text-back">
              <div className="section-head">
                <h2>Text back</h2>
                <button type="button" className="ghost" onClick={() => onCopy(textBack(brief), 'Text copied')}>Copy</button>
              </div>
              <p>{textBack(brief)}</p>
            </div>
            <div className="section-head">
              <h2>Build prompt</h2>
              <button type="button" className="ghost" onClick={() => onCopy(prompt, 'Prompt copied')}>Copy prompt</button>
            </div>
            <p className="quiet">Copy this into the model you use to pick parts. Their words and the limits are already in it.</p>
            <textarea
              className="prompt"
              value={prompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
            />
            <button type="button" className="primary" onClick={putOnBench}>
              Put this build on the bench
            </button>
          </>
        )}
      </div>
    </section>
  );
}
