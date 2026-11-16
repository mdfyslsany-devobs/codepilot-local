import type { FormEvent } from 'react';

interface MarkdownEditorProps {
  value: string;
  busy: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onParse: () => void;
}

export default function MarkdownEditor({
  value,
  busy,
  disabled,
  onChange,
  onParse
}: MarkdownEditorProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onParse();
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">02 / INSTRUCTIONS</p>
          <h2>Describe the changes</h2>
        </div>
        <span className="text-xs text-slate-500">Markdown + fenced code blocks</span>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          className="field min-h-64 resize-y font-mono text-sm leading-6"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Update the project with these files:\n\n\`\`\`typescript path="src/example.ts"\nexport const hello = 'world';\n\`\`\``}
          aria-label="Markdown instructions"
          disabled={busy}
          required
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Review the parsed files and plan before approving execution.
          </p>
          <button
            className="button-primary"
            type="submit"
            disabled={disabled || busy || !value.trim()}
          >
            {busy ? 'Working…' : 'Parse instructions'}
          </button>
        </div>
      </form>
    </section>
  );
}
