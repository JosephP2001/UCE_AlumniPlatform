'use client';

import { useEffect, useState } from 'react';

type Job = {
  id: number;
  title: string;
  company: string;
  description: string;
  location: string;
  salary: string;
  job_type: string;
  requirements: string;
  created_at: string;
};

const JOBS_URL = process.env.NEXT_PUBLIC_JOBS_URL ?? '';

const JOB_TYPE_STYLES: Record<string, string> = {
  'full-time':  'bg-blue-950 text-blue-300 border-blue-900',
  'part-time':  'bg-purple-950 text-purple-300 border-purple-900',
  'contract':   'bg-yellow-950 text-yellow-300 border-yellow-900',
  'internship': 'bg-green-950 text-green-300 border-green-900',
  'remote':     'bg-teal-950 text-teal-300 border-teal-900',
};

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${JOBS_URL}/api/jobs`)
      .then(r => r.json())
      .then(data => {
        setJobs(data.jobs || []);
        setSource(data.source || '');
        setLoading(false);
      })
      .catch(() => {
        setError('Could not connect to jobs-service');
        setLoading(false);
      });
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Job Listings</h2>
        <div className="flex items-center gap-2">
          {source && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              source === 'cache'
                ? 'bg-blue-900 text-blue-300'
                : 'bg-gray-800 text-gray-400'
            }`}>
              source: {source}
            </span>
          )}
          <a
            href="/jobs/new"
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            + Post job
          </a>
        </div>
      </div>

      {loading && (
        <p className="text-gray-400 text-sm">Loading jobs...</p>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          No job listings yet.
        </div>
      )}

      <div className="space-y-4">
        {jobs.map(job => (
          <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold">{job.title}</h3>
                  {job.job_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      JOB_TYPE_STYLES[job.job_type] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {job.job_type}
                    </span>
                  )}
                </div>
                <p className="text-blue-400 text-sm mt-1">{job.company}</p>
              </div>
              {job.salary && (
                <span className="text-green-400 text-sm font-medium shrink-0">{job.salary}</span>
              )}
            </div>

            {job.description && (
              <p className="text-gray-400 text-sm mt-3">{job.description}</p>
            )}

            {job.requirements && (
              <div className="mt-3 bg-gray-950 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Requirements</p>
                <p className="text-gray-400 text-sm">{job.requirements}</p>
              </div>
            )}

            <div className="flex gap-4 mt-3 text-xs text-gray-500">
              {job.location && <span>📍 {job.location}</span>}
              <span>🕐 {new Date(job.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
