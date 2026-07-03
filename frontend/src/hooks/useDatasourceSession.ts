import { useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';
import type { CompletionEntry } from '../components/QueryEditor';

// useDatasourceSession owns the connection + metadata lifecycle for the active
// datasource: which datasource is live, its saved queries, editor completions,
// cached/refreshed schema metadata, and the "live connection failed" warning.
//
// Tab, results, and routing state stay in App — connect()/disconnect() here only
// touch session data; the caller orchestrates the surrounding view reset.
export function useDatasourceSession() {
  const [activeDatasourceId, setActiveDatasourceId] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<{ filename: string }[]>([]);
  const [completions, setCompletions] = useState<CompletionEntry[]>([]);
  const [metadataByDs, setMetadataByDs] = useState<Record<string, main.DatabaseMetadata>>({});
  const [connectionWarning, setConnectionWarning] = useState<{
    dsId: string;
    message: string;
  } | null>(null);

  const refreshMetadata = async (dsId: string) => {
    try {
      const fresh = await GoApp.RefreshMetadata(dsId);
      setMetadataByDs((prev) => ({ ...prev, [dsId]: fresh }));
      setConnectionWarning((prev) => (prev?.dsId === dsId ? null : prev));
    } catch (err) {
      console.warn('RefreshMetadata failed', err);
      const message = err instanceof Error ? err.message : String(err);
      setConnectionWarning({ dsId, message });
      return;
    }
    // RefreshMetadata rebuilt the backend completion cache; fetch it to sync the editor.
    try {
      const data = await GoApp.GetCompletions(dsId);
      setCompletions((data?.entries ?? []) as CompletionEntry[]);
    } catch (err) {
      console.warn('GetCompletions refresh failed', err);
    }
  };

  const connect = (dsId: string) => {
    setActiveDatasourceId(dsId);
    setSavedQueries([]);
    setCompletions([]);
    GoApp.ListSavedQueries(dsId)
      .then((data) => setSavedQueries(data ?? []))
      .catch(() => {});
    GoApp.GetCompletions(dsId)
      .then((data) => setCompletions((data?.entries ?? []) as CompletionEntry[]))
      .catch((err) => console.warn('GetCompletions failed', err));
    // Resilience flow (see ADR-0006): show last-known structure from the on-disk
    // cache *immediately* so the sidebar/autocomplete are usable at once, then
    // refresh from the live DB in the background. If the live refresh fails,
    // refreshMetadata sets a warning banner and we keep showing the cache.
    GoApp.GetCachedMetadata(dsId)
      .then((cached) => {
        if (cached?.schemas?.length > 0) {
          setMetadataByDs((prev) => ({ ...prev, [dsId]: cached }));
        }
      })
      .catch(() => {});
    refreshMetadata(dsId);
  };

  const disconnect = () => {
    if (activeDatasourceId) {
      GoApp.ClosePool(activeDatasourceId).catch(() => {});
    }
    setActiveDatasourceId(null);
  };

  const metadata = activeDatasourceId ? (metadataByDs[activeDatasourceId] ?? null) : null;

  return {
    activeDatasourceId,
    savedQueries,
    setSavedQueries,
    completions,
    metadata,
    connectionWarning,
    setConnectionWarning,
    refreshMetadata,
    connect,
    disconnect,
  };
}
