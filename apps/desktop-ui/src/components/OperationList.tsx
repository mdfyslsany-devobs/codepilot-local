import type { ExecutionResult, Operation } from '../api';

interface OperationListProps {
  operations: Operation[];
  approved: boolean;
  busy: boolean;
  executionResult: ExecutionResult | null;
  onApprove: () => void;
  onExecute: () => void;
}

export default function OperationList({
  operations,
  approved,
  busy,
  executionResult,
  onApprove,
  onExecute
}: OperationListProps) {
  if (operations.length === 0) {
    return null;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EXECUTION PLAN</p>
          <h2>Review operations</h2>
        </div>
        <span className="text-xs text-slate-400">{operations.length} operations</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="data-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>Path</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((operation) => (
              <tr key={operation.id}>
                <td className="font-mono text-slate-200">{operation.operationType}</td>
                <td className="font-mono text-slate-300">{operation.relativePath}</td>
                <td>
                  <span className="badge border-line bg-slate-900 text-slate-300">
                    {approved ? 'APPROVED' : operation.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Execution is unavailable until every operation has been approved.
        </p>
        <div className="flex gap-2">
          <button
            className="button-secondary"
            type="button"
            onClick={onApprove}
            disabled={approved || busy}
          >
            {approved ? 'Approved' : 'Approve operations'}
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={onExecute}
            disabled={!approved || busy || executionResult !== null}
          >
            {busy ? 'Working…' : 'Execute'}
          </button>
        </div>
      </div>

      {executionResult && (
        <div className="mt-4 rounded-lg border border-emerald-900/70 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          Execution complete: {executionResult.executed} executed, {executionResult.failed}{' '}
          failed.
        </div>
      )}
    </section>
  );
}
