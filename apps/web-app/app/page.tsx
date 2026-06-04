import JobsList from '@/components/JobsList';
import ServiceStatus from '@/components/ServiceStatus';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">UCE Alumni Platform</h1>
            <p className="text-gray-400 text-sm mt-1">Universidad Central del Ecuador</p>
          </div>
          <a href="/api/auth/github" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Login with GitHub</a>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
        <ServiceStatus />
        <JobsList />
      </div>
    </main>
  );
}
