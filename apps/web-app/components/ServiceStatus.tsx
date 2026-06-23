'use client';

import { useEffect, useState } from 'react';

type Status = {
  service: string;
  status: string;
  timestamp: string;
} | null;

const AUTH_URL = '';
const JOBS_URL = '';

export default function ServiceStatus() {
  const [auth, setAuth] = useState<Status>(null);
  const [jobs, setJobs] = useState<Status>(null);

  useEffect(() => {
    fetch(`${AUTH_URL}/api/auth/health`)
      .then((r) => r.json())
      .then(setAuth)
      .catch(() =>
        setAuth({
          service: 'auth-service',
          status: 'unreachable',
          timestamp: '',
        }),
      );

    fetch(`${JOBS_URL}/api/jobs/health`)
      .then((r) => r.json())
      .then(setJobs)
      .catch(() =>
        setJobs({
          service: 'jobs-service',
          status: 'unreachable',
          timestamp: '',
        }),
      );
  }, []);

  const dot = (s: Status) =>
    s?.status === 'ok'
      ? 'bg-green-500'
      : s?.status === 'unreachable'
        ? 'bg-red-500'
        : 'bg-yellow-500';

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-200 mb-4">
        Service Status
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {[auth, jobs].map((s, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3"
          >
            <span className={`w-3 h-3 rounded-full ${dot(s)}`} />
            <div>
              <p className="text-sm font-medium text-white">
                {s?.service ?? (i === 0 ? 'auth-service' : 'jobs-service')}
              </p>
              <p className="text-xs text-gray-400">
                {s?.status ?? 'checking...'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}