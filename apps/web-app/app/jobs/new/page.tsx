'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type JobFormData = {
  title: string;
  company: string;
  description: string;
  location: string;
  salary: string;
  type: string;
  requirements: string;
};

const JOBS_URL = process.env.NEXT_PUBLIC_JOBS_URL ?? '';

const INITIAL: JobFormData = {
  title: '',
  company: '',
  description: '',
  location: '',
  salary: '',
  type: 'full-time',
  requirements: '',
};

export default function JobForm() {
  const router = useRouter();
  const [form, setForm] = useState<JobFormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('access_token');

    if (!token || !userStr) {
      router.push('/?error=unauthorized');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'company') {
        router.push('/?error=forbidden');
        return;
      }
      setCompanyName(user.name ?? user.email ?? '');
      setForm(prev => ({ ...prev, company: user.name ?? '' }));
    } catch {
      router.push('/?error=unauthorized');
    }
  }, [router]);

  const set = (field: keyof JobFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      setError('Title, company and description are required.');
      return;
    }

    setSubmitting(true);
    const token = sessionStorage.getItem('access_token');

    try {
      const res = await fetch(`${JOBS_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `Error ${res.status}`);
      }

      setSuccess(true);
      setForm(INITIAL);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit job posting.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Job posted!</h1>
          <p className="text-gray-400 mb-8 text-sm">
            Your listing is now visible to alumni students.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setSuccess(false)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Post another
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Post a job</h1>
              <p className="text-gray-400 text-sm mt-1">
                Visible to all UCE alumni on the platform
              </p>
            </div>
            {companyName && (
              <span className="text-xs bg-blue-950 text-blue-300 px-3 py-1.5 rounded-full border border-blue-900 font-medium">
                {companyName}
              </span>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Job title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Frontend Developer"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Company + Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.company}
                onChange={set('company')}
                placeholder="Your company name"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Job type
              </label>
              <select
                value={form.type}
                onChange={set('type')}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="remote">Remote</option>
              </select>
            </div>
          </div>

          {/* Location + Salary row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={form.location}
                onChange={set('location')}
                placeholder="e.g. Quito, Ecuador"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Salary
              </label>
              <input
                type="text"
                value={form.salary}
                onChange={set('salary')}
                placeholder="e.g. $1,200 / month"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Requirements
            </label>
            <textarea
              value={form.requirements}
              onChange={set('requirements')}
              rows={3}
              placeholder="e.g. 2+ years React experience, English B2, degree in Systems Engineering..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Posting...
                </>
              ) : (
                'Post job'
              )}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
