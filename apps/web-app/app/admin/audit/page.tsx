'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  user_id: string | null;
  timestamp: string;
}

const EVENT_TYPES = [
  'all',
  'job.created',
  'user.registered',
  'profile.updated',
  'new_match',
];

export default function AuditPage() {
  const router = useRouter();
  const [ready, setReady]           = useState(false);
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [eventType, setEventType]   = useState('all');
  const [expanded, setExpanded]     = useState<string | null>(null);

  // ── Auth guard ──────────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');
    if (!token || !userStr) { router.push('/auth/login'); return; }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'admin') { router.push('/'); return; }
    } catch {
      router.push('/auth/login');
      return;
    }

    setReady(true);
  }, [router]);

  // ── Fetch logs ──────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = sessionStorage.getItem('access_token');
    const params = new URLSearchParams({ limit: '50' });
    if (eventType !== 'all') params.set('event_type', eventType);

    try {
      const res = await fetch(`/api/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setLogs(data.data ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [eventType]);

  useEffect(() => {
    if (ready) fetchLogs();
  }, [ready, fetchLogs]);

  // ── Loading screen ──────────────────────────────────────────
  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
              <p className="text-gray-400 text-sm mt-1">Platform events — last 50 records</p>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-gray-400 text-sm">Filter by event:</span>
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  eventType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={fetchLogs} className="text-red-400 hover:text-red-300 text-sm underline">
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!error && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm">No audit logs found</p>
                {eventType !== 'all' && (
                  <p className="text-gray-600 text-xs mt-1">
                    Try removing the filter or triggering a platform event
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium w-44">Timestamp</th>
                    <th className="px-4 py-3 text-gray-400 font-medium w-40">Event Type</th>
                    <th className="px-4 py-3 text-gray-400 font-medium w-32">User ID</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-blue-900/40 text-blue-400 text-xs px-2 py-1 rounded-md font-mono">
                            {log.event_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                          {log.user_id ?? <span className="text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-xs">
                          <span className="flex items-center gap-2">
                            <span>{JSON.stringify(log.payload).slice(0, 60)}…</span>
                            <svg
                              className={`w-3 h-3 text-gray-600 flex-shrink-0 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </span>
                        </td>
                      </tr>

                      {/* Expanded payload row */}
                      {expanded === log.id && (
                        <tr key={`${log.id}-expanded`} className="bg-gray-800/20 border-b border-gray-800/50">
                          <td colSpan={4} className="px-4 py-3">
                            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all bg-gray-950 rounded-lg p-3">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}

            {/* Footer count */}
            {!loading && logs.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-800 text-right">
                <span className="text-gray-600 text-xs">{logs.length} records</span>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
