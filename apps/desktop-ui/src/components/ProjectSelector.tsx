import { useState, type FormEvent } from 'react';
import type { Project } from '../api';

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  loading: boolean;
  disabled: boolean;
  creating: boolean;
  onSelect: (projectId: string) => void;
  onCreate: (name: string, path: string) => Promise<void>;
}

export default function ProjectSelector({
  projects,
  selectedProjectId,
  loading,
  disabled,
  creating,
  onSelect,
  onCreate
}: ProjectSelectorProps) {
  const [name, setName] = useState('');
  const [path, setPath] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(name.trim(), path.trim());
    setName('');
    setPath('');
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / WORKSPACE</p>
          <h2>Choose a project</h2>
        </div>
        <span className="text-xs text-slate-500">{projects.length} available</span>
      </div>

      <label className="field-label" htmlFor="project-select">
        Existing project
      </label>
      <select
        id="project-select"
        className="field"
        value={selectedProjectId}
        onChange={(event) => onSelect(event.target.value)}
        disabled={disabled || loading}
      >
        <option value="">
          {loading ? 'Loading projects…' : 'Select a project'}
        </option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name} — {project.path}
          </option>
        ))}
      </select>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-widest text-slate-600">
        <span className="h-px flex-1 bg-line" />
        or register a folder
        <span className="h-px flex-1 bg-line" />
      </div>

      <form className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]" onSubmit={handleSubmit}>
        <input
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Project name"
          aria-label="Project name"
          disabled={disabled || creating}
          required
        />
        <input
          className="field"
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder="Absolute project path"
          aria-label="Absolute project path"
          disabled={disabled || creating}
          required
        />
        <button
          className="button-secondary"
          type="submit"
          disabled={disabled || creating || !name.trim() || !path.trim()}
        >
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>
    </section>
  );
}
