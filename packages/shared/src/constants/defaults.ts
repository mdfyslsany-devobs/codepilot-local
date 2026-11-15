export const DEFAULT_SERVER_PORT = 41777;
export const DEFAULT_SERVER_HOST = '127.0.0.1';
export const APP_NAME = 'CodePilot Local';
export const API_VERSION = 'v1';

export const OPERATION_TYPES = [
  'CREATE',
  'UPDATE',
  'MOVE',
  'COPY',
  'RENAME',
  'DELETE',
  'MKDIR'
] as const;

export const OPERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED'
] as const;

export const TASK_STATUSES = [
  'PENDING',
  'PARSED',
  'PLANNED',
  'AWAITING_APPROVAL',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
] as const;

export const TASK_INPUT_TYPES = [
  'TEXT',
  'ZIP',
  'LOCAL_FOLDER'
] as const;

export const EXECUTION_PLAN_STATUSES = [
  'DRAFT',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'REJECTED',
  'EXECUTED'
] as const;

export const LOG_LEVELS = [
  'INFO',
  'WARN',
  'ERROR',
  'DEBUG'
] as const;
