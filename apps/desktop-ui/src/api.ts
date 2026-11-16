const API_BASE_URL = 'http://127.0.0.1:41777';

export interface Project {
  id: string;
  name: string;
  path: string;
}

export interface ManifestFile {
  path: string;
  content: string;
  language: string | null;
  isNew: boolean;
}

export interface ManifestNotice {
  code: string;
  message: string;
  filename?: string | null;
}

export interface Manifest {
  version: string;
  createdAt: string;
  instructionsHash: string;
  files: ManifestFile[];
  folders: string[];
  warnings: ManifestNotice[];
  errors: ManifestNotice[];
}

export interface Operation {
  id: string;
  operationType: string;
  relativePath: string;
  content?: string | null;
  status: string;
}

export interface Plan {
  planId: string;
  operations: Operation[];
}

export interface ExecutionResult {
  executed: number;
  failed: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function request<T>(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Save your API token before making a request.');
  }

  const authorization = cleanToken.startsWith('Bearer ')
    ? cleanToken
    : `Bearer ${cleanToken}`;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const rawBody = await response.text();
  let payload: ApiResponse<T> | undefined;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as ApiResponse<T>;
    } catch {
      if (!response.ok) {
        throw new Error(rawBody);
      }
      throw new Error('The API returned an invalid JSON response.');
    }
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error ||
        `Request failed with status ${response.status}.`
    );
  }
  if (!payload || payload.success !== true) {
    throw new Error(payload?.message || payload?.error || 'The API request failed.');
  }

  return payload;
}

function requireData<T>(response: ApiResponse<T>, action: string): T {
  if (response.data === undefined) {
    throw new Error(`The API did not return ${action}.`);
  }
  return response.data;
}

export async function listProjects(token: string): Promise<Project[]> {
  return requireData(await request<Project[]>(token, '/api/v1/projects'), 'projects');
}

export async function createProject(
  token: string,
  name: string,
  path: string
): Promise<Project> {
  const response = await request<Project>(token, '/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify({ name, path })
  });
  return requireData(response, 'the created project');
}

export async function parseTask(
  token: string,
  projectId: string,
  markdown: string
): Promise<Manifest> {
  const response = await request<Manifest>(token, '/api/v1/tasks/parse', {
    method: 'POST',
    body: JSON.stringify({ projectId, markdown })
  });
  return requireData(response, 'the parsed manifest');
}

export async function createTask(
  token: string,
  projectId: string,
  markdown: string
): Promise<{ id: string }> {
  const response = await request<{ id: string }>(token, '/api/v1/tasks/import', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      content: markdown,
      sourceType: 'TEXT',
      title: 'CodePilot Local task'
    })
  });
  return requireData(response, 'the created task');
}

export async function planTask(
  token: string,
  projectId: string,
  manifest: Manifest,
  taskId: string
): Promise<Plan> {
  const response = await request<Plan>(token, '/api/v1/tasks/plan', {
    method: 'POST',
    body: JSON.stringify({ projectId, manifest, taskId })
  });
  return requireData(response, 'the execution plan');
}

export async function approveTask(token: string, taskId: string): Promise<string> {
  const response = await request<never>(
    token,
    `/api/v1/tasks/${encodeURIComponent(taskId)}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
  return response.message || 'Operations approved.';
}

export async function executeTask(
  token: string,
  taskId: string
): Promise<ExecutionResult> {
  const response = await request<ExecutionResult>(
    token,
    `/api/v1/tasks/${encodeURIComponent(taskId)}/execute`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
  return requireData(response, 'the execution result');
}
