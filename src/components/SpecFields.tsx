import { useEffect, useState } from 'react';
import type { Brief } from '../types';
import { openQuestions } from '../lib/extract';
import { parseMoney } from '../lib/format';

export function SpecFields({ brief, onChange }: { brief: Brief; onChange: (brief: Brief) => void }) {
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => onChange({ ...brief, [key]: value });

  return (
    <div className="spec-grid">
      <TextField label="Customer" value={brief.customerName} onChange={(value) => set('customerName', value)} />
      <TextField label="Contact" value={brief.contact} onChange={(value) => set('contact', value)} />
      <NumberField label="Budget target" value={brief.budgetTarget} onChange={(value) => set('budgetTarget', value)} />
      <NumberField label="Ceiling" value={brief.budgetCeiling} onChange={(value) => set('budgetCeiling', value)} />
      <TextField label="Resolution" value={brief.resolution} onChange={(value) => set('resolution', value)} />
      <NumberField label="Refresh Hz" value={brief.refreshHz} onChange={(value) => set('refreshHz', value)} />
      <SelectField
        label="CPU"
        value={brief.cpuBrand}
        onChange={(value) => set('cpuBrand', value === 'AMD' || value === 'Intel' ? value : '')}
        options={[['', 'Not stated'], ['AMD', 'AMD'], ['Intel', 'Intel']]}
      />
      <SelectField
        label="GPU"
        value={brief.gpuBrand}
        onChange={(value) => set('gpuBrand', value === 'NVIDIA' || value === 'AMD' ? value : '')}
        options={[['', 'Not stated'], ['NVIDIA', 'NVIDIA'], ['AMD', 'AMD']]}
      />
      <TextField label="Games" value={brief.games} onChange={(value) => set('games', value)} />
      <TextField label="Software" value={brief.software} onChange={(value) => set('software', value)} />
      <TextField label="Uses" value={brief.uses} onChange={(value) => set('uses', value)} />
      <NumberField label="Memory GB" value={brief.ramGb} onChange={(value) => set('ramGb', value)} />
      <TextField label="Storage" value={brief.storage} onChange={(value) => set('storage', value)} />
      <TextField label="Form factor" value={brief.formFactor} onChange={(value) => set('formFactor', value)} />
      <TextField label="Color" value={brief.color} onChange={(value) => set('color', value)} />
      <SelectField
        label="Lighting"
        value={brief.rgb}
        onChange={(value) => set('rgb', value === 'yes' || value === 'subtle' || value === 'no' ? value : '')}
        options={[['', 'Not stated'], ['subtle', 'Subtle'], ['yes', 'RGB'], ['no', 'None']]}
      />
      <SelectField
        label="Handoff"
        value={brief.fulfillment}
        onChange={(value) => set('fulfillment', value === 'pickup' || value === 'ship' ? value : '')}
        options={[['', 'Not stated'], ['pickup', 'Pickup'], ['ship', 'Ship']]}
      />
      <TextField label="Timeline" value={brief.timeline} onChange={(value) => set('timeline', value)} />
      <TextField label="Already owns" value={brief.alreadyOwns} onChange={(value) => set('alreadyOwns', value)} />
      <TextField label="Must include" value={brief.mustInclude} onChange={(value) => set('mustInclude', value)} />
      <TextField label="Preferences" value={brief.preferences} onChange={(value) => set('preferences', value)} />
      <TextField label="Parts they named" value={brief.partWishes} onChange={(value) => set('partWishes', value)} className="wide" />
      <label className="field wide">
        <span>Also ask</span>
        <textarea
          rows={2}
          value={brief.askThem}
          placeholder="One question per line"
          onChange={(event) => set('askThem', event.target.value)}
        />
      </label>
    </div>
  );
}

export function QuestionList({ brief }: { brief: Brief }) {
  const questions = openQuestions(brief);
  if (!questions.length) return <p className="quiet">Nothing in the specs is blocking a list.</p>;
  return (
    <ul className="questions">
      {questions.map((question) => <li key={question}>{question}</li>)}
    </ul>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseMoney(event.target.value));
        }}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, name]) => <option key={option || 'empty'} value={option}>{name}</option>)}
      </select>
    </label>
  );
}
