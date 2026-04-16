import type { SavedWorkspace } from '../../types/workspace';
import './WorkspaceLibrary.css';

interface WorkspaceLibraryProps {
  workspaces: SavedWorkspace[];
  onOpen: (workspaceId: string) => void;
  onRename: (workspaceId: string, title: string) => void;
  onToggleStatus: (workspaceId: string) => void;
  onDuplicate: (workspaceId: string) => void;
  onDelete: (workspaceId: string) => void;
}

function formatRelativeDate(timestamp: string): string {
  const updatedAt = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.round((now - updatedAt) / 60000));

  if (diffMinutes < 1) {
    return 'Updated just now';
  }

  if (diffMinutes < 60) {
    return `Updated ${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function WorkspaceLibrary({
  workspaces,
  onOpen,
  onRename,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: WorkspaceLibraryProps) {
  return (
    <section className="workspace-library" aria-labelledby="workspace-library-title">
      <div className="workspace-library__header">
        <div>
          <h2 id="workspace-library-title" className="workspace-library__title">
            Saved plans
          </h2>
          <p className="workspace-library__subtitle">
            Resume a draft, reopen a completed plan, or duplicate one as a new starting point.
          </p>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <div className="workspace-library__empty">
          <p>No saved workspaces yet.</p>
          <p className="workspace-library__empty-hint">
            Upload a timetable or start from scratch to create your first saved plan.
          </p>
        </div>
      ) : (
        <div className="workspace-library__grid">
          {workspaces.map((workspace) => (
            <article key={workspace.id} className="workspace-library__card">
              <div className="workspace-library__card-header">
                <span
                  className={`workspace-library__badge workspace-library__badge--${workspace.status}`}
                >
                  {workspace.status}
                </span>
                <span className="workspace-library__timestamp">
                  {formatRelativeDate(workspace.updatedAt)}
                </span>
              </div>

              <label className="workspace-library__name-label">
                <span className="workspace-library__name-text">Title</span>
                <input
                  className="workspace-library__name-input"
                  value={workspace.title}
                  onChange={(event) => onRename(workspace.id, event.target.value)}
                  aria-label={`Rename ${workspace.title}`}
                />
              </label>

              <dl className="workspace-library__stats">
                <div>
                  <dt>Services</dt>
                  <dd>{workspace.editedResult.services.length}</dd>
                </div>
                <div>
                  <dt>Locos</dt>
                  <dd>{workspace.editedResult.locomotives.length}</dd>
                </div>
                <div>
                  <dt>Plans</dt>
                  <dd>{workspace.plansWithAnalysis.length}</dd>
                </div>
              </dl>

              <div className="workspace-library__actions">
                <button type="button" onClick={() => onOpen(workspace.id)}>
                  {workspace.status === 'completed' ? 'Open' : 'Resume'}
                </button>
                <button type="button" onClick={() => onToggleStatus(workspace.id)}>
                  {workspace.status === 'completed' ? 'Reopen' : 'Mark complete'}
                </button>
                <button type="button" onClick={() => onDuplicate(workspace.id)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  className="workspace-library__delete"
                  onClick={() => onDelete(workspace.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
