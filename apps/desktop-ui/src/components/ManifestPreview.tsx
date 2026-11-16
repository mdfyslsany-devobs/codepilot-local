import type { Manifest } from '../api';

interface ManifestPreviewProps {
  manifest: Manifest | null;
  busy: boolean;
  canPlan: boolean;
  onPlan: () => void;
}

export default function ManifestPreview({
  manifest,
  busy,
  canPlan,
  onPlan
}: ManifestPreviewProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 / REVIEW</p>
          <h2>Parsed manifest</h2>
        </div>
        {manifest && (
          <span className="text-xs text-slate-400">
            {manifest.files.length} files · {manifest.folders.length} folders
          </span>
        )}
      </div>

      {!manifest ? (
        <div className="empty-state">Parse your Markdown to preview the files.</div>
      ) : (
        <>
          {manifest.errors.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-900/70 bg-red-950/40 p-3">
              <p className="mb-2 text-sm font-medium text-red-300">Manifest errors</p>
              <ul className="space-y-1 text-sm text-red-200">
                {manifest.errors.map((item, index) => (
                  <li key={`${item.code}-${index}`}>{item.message}</li>
                ))}
              </ul>
            </div>
          )}

          {manifest.warnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-900/70 bg-amber-950/30 p-3">
              <p className="mb-2 text-sm font-medium text-amber-300">Warnings</p>
              <ul className="space-y-1 text-sm text-amber-200">
                {manifest.warnings.map((item, index) => (
                  <li key={`${item.code}-${index}`}>{item.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Language</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {manifest.files.map((file, index) => (
                  <tr key={`${file.path}-${index}`}>
                    <td className="font-mono text-slate-200">{file.path}</td>
                    <td>{file.language || '—'}</td>
                    <td>
                      <span
                        className={
                          file.isNew
                            ? 'badge border-emerald-900 bg-emerald-950/50 text-emerald-300'
                            : 'badge border-blue-900 bg-blue-950/50 text-blue-300'
                        }
                      >
                        {file.isNew ? 'New' : 'Update'}
                      </span>
                    </td>
                  </tr>
                ))}
                {manifest.files.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-500">
                      No files found in the manifest.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {manifest.folders.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Folders: {manifest.folders.join(', ')}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              className="button-primary"
              type="button"
              onClick={onPlan}
              disabled={!canPlan || busy || manifest.errors.length > 0}
            >
              {busy ? 'Working…' : 'Create execution plan'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
