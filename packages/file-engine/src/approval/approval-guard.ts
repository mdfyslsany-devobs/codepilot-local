import { ErrorCode } from '@codepilot/shared';
import { SecurityError } from '../security/path-validator.js';

export interface ApprovalCheckOptions {
  operationType: 'CREATE' | 'UPDATE' | 'MOVE' | 'COPY' | 'RENAME' | 'DELETE' | 'MKDIR';
  fileExists: boolean;
  isApproved: boolean;
}

/**
 * Enforces the Master Technical Specification §5 Module 5: Approval System rules:
 * - New files inside authorized project folders can be created under an approved task plan.
 * - Existing files must be reviewed before modification.
 * - Deletion must always require separate confirmation.
 */
export function checkOperationApproval(options: ApprovalCheckOptions): void {
  const { operationType, fileExists, isApproved } = options;

  if (operationType === 'DELETE') {
    if (!isApproved) {
      throw new SecurityError(
        ErrorCode.OPERATION_REJECTED,
        'File deletion strictly requires explicit user approval and confirmation.'
      );
    }
  }

  if (operationType === 'UPDATE' && fileExists) {
    if (!isApproved) {
      throw new SecurityError(
        ErrorCode.OPERATION_REJECTED,
        'Modifying an existing file requires explicit user approval before execution.'
      );
    }
  }

  if ((operationType === 'MOVE' || operationType === 'RENAME') && fileExists) {
    if (!isApproved) {
      throw new SecurityError(
        ErrorCode.OPERATION_REJECTED,
        `Moving or renaming existing files requires explicit user approval.`
      );
    }
  }
}
