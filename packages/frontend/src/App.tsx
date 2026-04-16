import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ParsedPreview } from './components/ParsedPreview';
import { WorkspaceLibrary } from './components/WorkspaceLibrary';
import { useUpload } from './hooks/useUpload';
import {
  createWorkspaceFromParseResult,
  deleteWorkspace,
  duplicateWorkspace,
  getLastActiveWorkspaceId,
  listWorkspaces,
  migrateLegacyEdits,
  saveWorkspace,
  setLastActiveWorkspaceId,
} from './services/workspaceStore';
import type { SavedWorkspace } from './types/workspace';
import './App.css';

function sortWorkspaces(workspaces: SavedWorkspace[]): SavedWorkspace[] {
  return [...workspaces].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function App() {
  const { isUploading, error, upload, createBlank, resetError } = useUpload();
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [workspaces, setWorkspaces] = useState<SavedWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaces = async () => {
      try {
        await migrateLegacyEdits();
        const savedWorkspaces = await listWorkspaces();

        if (!isMounted) {
          return;
        }

        setWorkspaces(savedWorkspaces);

        const lastActiveWorkspaceId = getLastActiveWorkspaceId();
        if (lastActiveWorkspaceId && savedWorkspaces.some((workspace) => workspace.id === lastActiveWorkspaceId)) {
          setActiveWorkspaceId(lastActiveWorkspaceId);
        }
      } catch (loadError) {
        if (isMounted) {
          setStorageError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load saved workspaces.'
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingLibrary(false);
        }
      }
    };

    void loadWorkspaces();

    return () => {
      isMounted = false;
      saveTimersRef.current.forEach((timer) => clearTimeout(timer));
      saveTimersRef.current.clear();
    };
  }, []);

  const persistWorkspace = useCallback((workspace: SavedWorkspace, delayMs = 150) => {
    const existingTimer = saveTimersRef.current.get(workspace.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      void saveWorkspace(workspace).catch((saveError) => {
        setStorageError(
          saveError instanceof Error ? saveError.message : 'Unable to save workspace.'
        );
      });
      saveTimersRef.current.delete(workspace.id);
    }, delayMs);

    saveTimersRef.current.set(workspace.id, timer);
  }, []);

  const upsertWorkspace = useCallback((workspace: SavedWorkspace) => {
    setWorkspaces((prev) => {
      const next = prev.some((item) => item.id === workspace.id)
        ? prev.map((item) => (item.id === workspace.id ? workspace : item))
        : [...prev, workspace];

      return sortWorkspaces(next);
    });
  }, []);

  const createAndOpenWorkspace = useCallback((workspace: SavedWorkspace) => {
    upsertWorkspace(workspace);
    setActiveWorkspaceId(workspace.id);
    setLastActiveWorkspaceId(workspace.id);
    persistWorkspace(workspace, 0);
  }, [persistWorkspace, upsertWorkspace]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );

  const handleUpload = useCallback(async (file: File) => {
    const result = await upload(file);
    if (!result) {
      return;
    }

    createAndOpenWorkspace(createWorkspaceFromParseResult(result));
  }, [createAndOpenWorkspace, upload]);

  const handleCreateBlank = useCallback(() => {
    const blankResult = createBlank();
    createAndOpenWorkspace(createWorkspaceFromParseResult(blankResult));
  }, [createAndOpenWorkspace, createBlank]);

  const handleWorkspaceUpdate = useCallback((workspaceId: string, updates: Partial<SavedWorkspace>) => {
    setWorkspaces((prev) => {
      const current = prev.find((workspace) => workspace.id === workspaceId);
      if (!current) {
        return prev;
      }

      const updatedWorkspace: SavedWorkspace = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      persistWorkspace(updatedWorkspace);
      return sortWorkspaces(
        prev.map((workspace) => (workspace.id === workspaceId ? updatedWorkspace : workspace))
      );
    });
  }, [persistWorkspace]);

  const handleOpenWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    const reopenedWorkspace: SavedWorkspace = {
      ...workspace,
      lastOpenedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    upsertWorkspace(reopenedWorkspace);
    setActiveWorkspaceId(workspaceId);
    setLastActiveWorkspaceId(workspaceId);
    persistWorkspace(reopenedWorkspace, 0);
  }, [persistWorkspace, upsertWorkspace, workspaces]);

  const handleBackToLibrary = useCallback(() => {
    setActiveWorkspaceId(null);
    setLastActiveWorkspaceId(null);
  }, []);

  const handleRenameWorkspace = useCallback((workspaceId: string, title: string) => {
    handleWorkspaceUpdate(workspaceId, {
      title,
    });
  }, [handleWorkspaceUpdate]);

  const handleToggleWorkspaceStatus = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    handleWorkspaceUpdate(workspaceId, {
      status: workspace.status === 'completed' ? 'draft' : 'completed',
    });
  }, [handleWorkspaceUpdate, workspaces]);

  const handleDuplicateWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    const duplicatedWorkspace = duplicateWorkspace(workspace);
    createAndOpenWorkspace(duplicatedWorkspace);
  }, [createAndOpenWorkspace, workspaces]);

  const handleDeleteWorkspace = useCallback((workspaceId: string) => {
    setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== workspaceId));
    if (activeWorkspaceId === workspaceId) {
      setActiveWorkspaceId(null);
      setLastActiveWorkspaceId(null);
    }

    const existingTimer = saveTimersRef.current.get(workspaceId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      saveTimersRef.current.delete(workspaceId);
    }

    void deleteWorkspace(workspaceId).catch((deleteError) => {
      setStorageError(
        deleteError instanceof Error ? deleteError.message : 'Unable to delete workspace.'
      );
    });
  }, [activeWorkspaceId]);

  const handleActiveWorkspaceChange = useCallback((updates: Partial<SavedWorkspace>) => {
    if (!activeWorkspaceId) {
      return;
    }

    handleWorkspaceUpdate(activeWorkspaceId, updates);
  }, [activeWorkspaceId, handleWorkspaceUpdate]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Train Gala Planner</h1>
        <p className="app__subtitle">
          Upload a timetable, work locally in your browser, and pick back up whenever you like.
        </p>
      </header>

      <main className="app__main">
        {(error || storageError) && (
          <div className="app__error" role="alert">
            <p className="app__error-message">{error || storageError}</p>
            <button
              onClick={() => {
                resetError();
                setStorageError(null);
              }}
              type="button"
              className="app__error-btn"
            >
              Dismiss
            </button>
          </div>
        )}

        {!activeWorkspace ? (
          <div className="app__home">
            <section className="app__hero">
              <div className="app__hero-copy">
                <h2 className="app__hero-title">Start a new workspace</h2>
                <p className="app__hero-text">
                  Your timetable edits, plan constraints, and generated plans stay on this device.
                </p>
              </div>
              <FileUpload
                onFileSelect={handleUpload}
                isUploading={isUploading}
                onCreateBlank={handleCreateBlank}
              />
            </section>

            {!isLoadingLibrary && (
              <WorkspaceLibrary
                workspaces={workspaces}
                onOpen={handleOpenWorkspace}
                onRename={handleRenameWorkspace}
                onToggleStatus={handleToggleWorkspaceStatus}
                onDuplicate={handleDuplicateWorkspace}
                onDelete={handleDeleteWorkspace}
              />
            )}
          </div>
        ) : (
          <div className="app__workspace-shell">
            <div className="app__workspace-toolbar">
              <label className="app__workspace-title">
                <span className="app__workspace-title-label">Workspace</span>
                <input
                  value={activeWorkspace.title}
                  onChange={(event) => handleRenameWorkspace(activeWorkspace.id, event.target.value)}
                  aria-label="Workspace title"
                />
              </label>

              <div className="app__workspace-actions">
                <span className={`app__workspace-status app__workspace-status--${activeWorkspace.status}`}>
                  {activeWorkspace.status}
                </span>
                <button
                  type="button"
                  onClick={handleBackToLibrary}
                >
                  Back to library
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleWorkspaceStatus(activeWorkspace.id)}
                >
                  {activeWorkspace.status === 'completed' ? 'Reopen plan' : 'Mark complete'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateWorkspace(activeWorkspace.id)}
                >
                  Duplicate
                </button>
              </div>
            </div>

            <ParsedPreview
              key={activeWorkspace.id}
              workspace={activeWorkspace}
              onWorkspaceChange={handleActiveWorkspaceChange}
            />
          </div>
        )}
      </main>

      <footer className="app__footer">
        <p>Train Gala Planner - Owl Media</p>
      </footer>
    </div>
  );
}

export default App;
