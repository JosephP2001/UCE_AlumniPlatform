'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Summary {
  total_jobs: number;
  total_users: number;
  total_matches: number;
  total_profiles: number;
}

interface ByType  { job_type: string; total: string }
interface ByDay   { day: string; total: string }
interface ByCareer { career: string; total: number }
interface BySkill  { skill: string; total: number }

interface JobsData    { by_type: ByType[]; by_day: ByDay[] }
interface MatchesData { stats: { total_matches: string; avg_score: string; max_score: string; min_score: string }; by_day: ByDay[] }
interface ProfilesData { by_career: ByCareer[]; top_skills: BySkill[] }

export default function AnalyticsPage() {
  const router = useRouter();
  const [ready, setReady]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [jobs, setJobs]         = useState<JobsData | null>(null);
  const [matches, setMatches]   = useState<MatchesData | null>(null);
  const [profiles, setProfiles] = useState<ProfilesData | null>(null);

  // ── Auth guard ────────────────────────────────────────────────
  useEffect(() => {
    const token   = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');
    if (!token || !userStr) { router.push('/auth/login'); return; }
    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'admin') { router.push('/'); return; }
    } catch { router.push('/auth/login'); return; }
    setReady(true);
  }, [router]);

  // ── Fetch all analytics ───────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = sessionStorage.getItem('access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [s, j, m, p] = await Promise.all([
        fetch('/api/analytics/summary',  { headers }).then(r => r.json()),
        fetch('/api/analytics/jobs',     { headers }).then(r => r.json()),
        fetch('/api/analytics/matches',  { headers }).then(r => r.json()),
        fetch('/api/analytics/profiles', { headers }).then(r => r.json()),
      ]);
      setSummary(s.data);
      setJobs(j.data);
      setMatches(m.data);
      setProfiles(p.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (ready) fetchAll(); }, [ready, fetchAll]);

  if (!ready) return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <button onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Admin
            </button>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-gray-400 text-sm mt-1">Platform metrics overview</p>
          </div>
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 mb-6 flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={fetchAll} className="text-red-400 hover:text-red-300 text-sm underline">Retry</button>
          </div>
        )}

        {loading && !summary ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {summary && (
              <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
                {[
                  { label: 'Total Jobs',     value: summary.total_jobs },
                  { label: 'Total Users',    value: summary.total_users },
                  { label: 'Total Matches',  value: summary.total_matches },
                  { label: 'Total Profiles', value: summary.total_profiles },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <p className="text-gray-400 text-xs mb-2">{label}</p>
                    <p className="text-3xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* Jobs by type */}
              {jobs && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Jobs by Type</h2>
                  <div className="space-y-3">
                    {jobs.by_type.length === 0
                      ? <p className="text-gray-600 text-sm">No data</p>
                      : jobs.by_type.map((row) => {
                          const max = Math.max(...jobs.by_type.map(r => Number(r.total)));
                          const pct = Math.round((Number(row.total) / max) * 100);
                          return (
                            <div key={row.job_type}>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>{row.job_type || 'unspecified'}</span>
                                <span>{row.total}</span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </div>
              )}

              {/* Match stats */}
              {matches && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Match Statistics</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Matches', value: matches.stats.total_matches },
                      { label: 'Avg Score',     value: matches.stats.avg_score ?? '—' },
                      { label: 'Max Score',     value: matches.stats.max_score ?? '—' },
                      { label: 'Min Score',     value: matches.stats.min_score ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-800/50 rounded-lg p-3">
                        <p className="text-gray-500 text-xs mb-1">{label}</p>
                        <p className="text-xl font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profiles by career */}
              {profiles && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Profiles by Career</h2>
                  <div className="space-y-3">
                    {profiles.by_career.length === 0
                      ? <p className="text-gray-600 text-sm">No data</p>
                      : profiles.by_career.map((row) => {
                          const max = Math.max(...profiles.by_career.map(r => r.total));
                          const pct = Math.round((row.total / max) * 100);
                          return (
                            <div key={row.career}>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>{row.career || 'unspecified'}</span>
                                <span>{row.total}</span>
                              </div>
                              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </div>
              )}

              {/* Top skills */}
              {profiles && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-gray-300 mb-4">Top Skills</h2>
                  <div className="flex flex-wrap gap-2">
                    {profiles.top_skills.length === 0
                      ? <p className="text-gray-600 text-sm">No data</p>
                      : profiles.top_skills.map((row) => (
                          <span key={row.skill}
                            className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            {row.skill}
                            <span className="bg-gray-700 text-gray-400 text-xs px-1.5 py-0.5 rounded-full">{row.total}</span>
                          </span>
                        ))
                    }
                  </div>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </main>
  );
}
