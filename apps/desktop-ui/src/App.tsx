import { useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  approveTask,
  createProject as createProjectRequest,
  createTask,
  executeTask,
  listProjects,
  parseTask,
  planTask,
  type ExecutionResult,
  type Manifest,
  type Operation,
  type Project
} from './api';
import ManifestPreview from './components/ManifestPreview';
import MarkdownEditor from './components/MarkdownEditor';
import OperationList from './components/OperationList';
import ProjectSelector from './components/ProjectSelector';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function App() {
  const [tokenInput, setTokenInput] = useState(
    () => window.localStorage.getItem('codepilot-api-token') || ''
  );
  const [token, setToken] = useState(
    () => window.localStorage.getItem('codepilot-api-token') || ''
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [taskId, setTaskId] = useState('');
  const [approved, setApproved] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let active = true;
    invoke<string>('get_auth_token')
      .then((authToken) => {
        const value = authToken.trim();
        if (!active || !value) {
          return;
        }

        window.localStorage.setItem('codepilot-api-token', value);
        setTokenInput(value);
        setToken(value);
      })
      .catch((invokeError: unknown) => {
        if (active) {
          setError(getErrorMessage(invokeError));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setProjects([]);
      setProjectId('');
      return;
    }

    let active = true;
    setLoadingProjects(true);
    setError('');
    listProjects(token)
      .then((result) => {
        if (active) {
          setProjects(result);
          setProjectId((current) =>
            result.some((project) => project.id === current) ? current : ''
          );
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProjects(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  function resetWorkflow() {
    setManifest(null);
    setOperations([]);
    setTaskId('');
    setApproved(false);
    setExecutionResult(null);
    setNotice('');
  }

  function saveToken() {
    const value = tokenInput.trim();
    if (!value) {
      setError('Enter an API token to connect.');
      return;
    }
    window.localStorage.setItem('codepilot-api-token', value);
    setToken(value);
    setError('');
    setNotice('API token saved in this browser.');
  }

  async function handleCreateProject(name: string, path: string) {
    setError('');
    setNotice('');
    setCreatingProject(true);
    try {
      const project = await createProjectRequest(token, name, path);
      setProjects((current) => [
        project,
        ...current.filter((item) => item.id !== project.id)
      ]);
      setProjectId(project.id);
      resetWorkflow();
      setNotice(`Project "${project.name}" is ready.`);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleParse() {
    if (!projectId) {
      setError('Select a project before parsing.');
      return;
    }
    setError('');
    setNotice('');
    setBusyAction('parse');
    resetWorkflow();
    try {
      const result = await parseTask(token, projectId, markdown);
      setManifest(result);
      setNotice(`Parsed ${result.files.length} file(s). Review the manifest below.`);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction('');
    }
  }

  async function handlePlan() {
    if (!manifest || !projectId) {
      setError('Parse instructions and select a project before creating a plan.');
      return;
    }
    setError('');
    setNotice('');
    setBusyAction('plan');
    try {
      let currentTaskId = taskId;
      if (!currentTaskId) {
        const task = await createTask(token, projectId, markdown);
        currentTaskId = task.id;
        setTaskId(currentTaskId);
      }
      const plan = await planTask(token, projectId, manifest, currentTaskId);
      setOperations(plan.operations);
      setNotice(`Plan created with ${plan.operations.length} operation(s).`);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction('');
    }
  }

  async function handleApprove() {
    if (!taskId) {
      setError('Create an execution plan before approving operations.');
      return;
    }
    setError('');
    setNotice('');
    setBusyAction('approve');
    try {
      const message = await approveTask(token, taskId);
      setApproved(true);
      setNotice(message);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction('');
    }
  }

  async function handleExecute() {
    if (!taskId || !approved) {
      setError('Approve the planned operations before executing them.');
      return;
    }
    setError('');
    setNotice('');
    setBusyAction('execute');
    try {
      const result = await executeTask(token, taskId);
      setExecutionResult(result);
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction('');
    }
  }

  function handleProjectSelect(nextProjectId: string) {
    setProjectId(nextProjectId);
    resetWorkflow();
    setError('');
  }

  const hasToken = Boolean(token.trim());
  const busy = Boolean(busyAction);

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <header className="border-b border-line bg-panel/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 font-mono font-bold text-accent">
                CP
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">CodePilot Local</h1>
                <p className="text-xs text-slate-500">Local-first coding automation</p>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
            <label className="sr-only" htmlFor="api-token">
              Bearer token
            </label>
            <input
              id="api-token"
              className="field min-w-0 flex-1 font-mono text-sm"
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="Paste API token or Bearer token"
              autoComplete="off"
            />
            <button
              className="button-secondary shrink-0"
              type="button"
              onClick={saveToken}
            >
              Save token
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-5 py-8">
        {!hasToken && (
          <div className="rounded-lg border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Save your API token to connect to the local server.
          </div>
        )}

        {error && (
          <div
            className="rounded-lg border border-red-900/70 bg-red-950/50 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            <span className="font-semibold">API error:</span> {error}
          </div>
        )}

        {notice && !error && (
          <div
            className="rounded-lg border border-emerald-900/70 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            {notice}
          </div>
        )}

        <ProjectSelector
          projects={projects}
          selectedProjectId={projectId}
          loading={loadingProjects}
          disabled={!hasToken}
          creating={creatingProject}
          onSelect={handleProjectSelect}
          onCreate={handleCreateProject}
        />

        <MarkdownEditor
          value={markdown}
          busy={busy}
          disabled={!hasToken || !projectId}
          onChange={(value) => {
            setMarkdown(value);
            resetWorkflow();
            setError('');
          }}
          onParse={handleParse}
        />

        <ManifestPreview
          manifest={manifest}
          busy={busy}
          canPlan={hasToken && Boolean(projectId)}
          onPlan={handlePlan}
        />

        <OperationList
          operations={operations}
          approved={approved}
          busy={busy}
          executionResult={executionResult}
          onApprove={handleApprove}
          onExecute={handleExecute}
        />

        <footer className="pb-5 pt-1 text-center text-xs text-slate-600">
          Requests are sent to the local API at 127.0.0.1:41777.
        </footer>
      </div>
    </main>
  );
}
