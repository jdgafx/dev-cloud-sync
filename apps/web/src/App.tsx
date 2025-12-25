import { useState, useEffect } from 'react';
import { Activity, Cloud, Shield, Database } from 'lucide-react';

function App() {
    const [status, setStatus] = useState<string>('Checking...');

    useEffect(() => {
        fetch('http://localhost:4000/health')
            .then(res => res.json())
            .then(data => setStatus(data.status))
            .catch(() => setStatus('Offline'));
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans p-8">
            <header className="mb-12 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Cloud className="w-10 h-10 text-cyan-400" />
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
                        Dev Cloud Sync
                    </h1>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <span className={`px-3 py-1 rounded-full ${status === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        System Status: {status}
                    </span>
                </div>
            </header>

            <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Sync Status Card */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <span className="text-xs text-slate-500 font-mono">SYNC-01</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Sync Engine</h3>
                    <p className="text-slate-400 text-sm">Real-time delta synchronization active. Monitoring file system changes.</p>
                </div>

                {/* Storage Card */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Database className="w-6 h-6 text-purple-400" />
                        </div>
                        <span className="text-xs text-slate-500 font-mono">STORE-02</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Storage</h3>
                    <p className="text-slate-400 text-sm">Multi-provider storage ready. Connected to AWS S3, Google Drive.</p>
                </div>

                {/* Security Card */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <Shield className="w-6 h-6 text-emerald-400" />
                        </div>
                        <span className="text-xs text-slate-500 font-mono">SEC-03</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Security</h3>
                    <p className="text-slate-400 text-sm">End-to-end encryption enabled. Zero-knowledge architecture enforced.</p>
                </div>
            </main>

            <div className="mt-12 p-6 rounded-xl bg-slate-900/50 border border-slate-800">
                <h4 className="text-lg font-medium mb-4">Pending Tasks</h4>
                <ul className="space-y-2 text-slate-400 text-sm">
                    <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        Implement conflict resolution logic
                    </li>
                    <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        Set up Redis caching layer
                    </li>
                    <li className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        Finalize Docker deployment strategy
                    </li>
                </ul>
            </div>
        </div>
    )
}

export default App
