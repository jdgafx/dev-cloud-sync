import { useState, useEffect } from 'react';
import {
    Activity,
    Cloud,
    Shield,
    Database,
    Settings,
    Wifi,
    Zap,
    RefreshCw,
    HardDrive
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

function App() {
    const [status, setStatus] = useState<string>('Checking...');
    const [syncProgress, setSyncProgress] = useState(0);

    // Configuration States
    const [wifiOnly, setWifiOnly] = useState(false); // Default: Don't wait for wifi
    const [throttling, setThrottling] = useState(false); // Default: Don't throttle
    const [autoSync, setAutoSync] = useState(true);
    const [backgroundSync, setBackgroundSync] = useState(true);

    useEffect(() => {
        fetch('http://localhost:4000/health')
            .then(res => res.json())
            .then(data => setStatus(data.status))
            .catch(() => setStatus('Offline'));

        // Simulate initial sync progress
        const timer = setInterval(() => {
            setSyncProgress((oldProgress) => {
                if (oldProgress === 100) return 100;
                const diff = Math.random() * 10;
                return Math.min(oldProgress + diff, 100);
            });
        }, 500);

        return () => {
            clearInterval(timer);
        };
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground bg-slate-950 dark">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50">
                <div className="container flex h-16 items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                            <Cloud className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
                                Dev Cloud Sync
                            </h1>
                            <p className="text-xs text-slate-400 font-mono">v0.1.0-alpha</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
                            <div className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                            <span className="text-sm font-medium text-slate-300">{status === 'ok' ? 'System Online' : 'System Offline'}</span>
                        </div>
                        <Button variant="outline" size="icon" className="border-slate-700 bg-slate-800 hover:bg-slate-700">
                            <Settings className="w-4 h-4 text-slate-400" />
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container py-8 space-y-8">

                {/* Sync Status Section */}
                <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-200">Total Storage</CardTitle>
                            <Database className="h-4 w-4 text-cyan-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">2.4 TB</div>
                            <p className="text-xs text-slate-400">+12% from last month</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-200">Active Transfers</CardTitle>
                            <Activity className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">12</div>
                            <p className="text-xs text-slate-400">~45 MB/s throughput</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-200">Files Synced</CardTitle>
                            <RefreshCw className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">14,302</div>
                            <p className="text-xs text-slate-400">100% up to date</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-200">Encrypted</CardTitle>
                            <Shield className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-white">100%</div>
                            <p className="text-xs text-slate-400">AES-256-GCM Enabled</p>
                        </CardContent>
                    </Card>
                </section>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                    {/* Main Sync Panel */}
                    <Card className="col-span-4 bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Synchronization Status</CardTitle>
                            <CardDescription className="text-slate-400">Real-time monitoring of file transfers across all connected devices.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-200">Syncing 'Project Alpha'...</span>
                                    <span className="text-slate-400">{Math.round(syncProgress)}%</span>
                                </div>
                                <Progress value={syncProgress} className="h-2" />
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-slate-300">Connected Providers</h4>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
                                        <div className="p-2 bg-blue-500/10 rounded">
                                            <Cloud className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-200">AWS S3 (East)</p>
                                            <p className="text-xs text-slate-500">Connected • Low Latency</p>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
                                        <div className="p-2 bg-yellow-500/10 rounded">
                                            <HardDrive className="w-5 h-5 text-yellow-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-200">Google Drive</p>
                                            <p className="text-xs text-slate-500">Connected • Standard</p>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuration Panel */}
                    <Card className="col-span-3 bg-slate-900 border-slate-800">
                        <CardHeader>
                            <CardTitle className="text-white">Sync Configuration</CardTitle>
                            <CardDescription className="text-slate-400">Manage synchronization behavior and performance settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between space-x-4">
                                <div className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Wifi className="w-4 h-4 text-cyan-500" />
                                        <span className="text-sm font-medium text-slate-200">Wait for Wi-Fi</span>
                                    </div>
                                    <span className="text-xs text-slate-500">Only sync when connected to Wi-Fi networks</span>
                                </div>
                                <Switch checked={wifiOnly} onCheckedChange={setWifiOnly} />
                            </div>

                            <div className="flex items-center justify-between space-x-4">
                                <div className="flex flex-col space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-yellow-500" />
                                        <span className="text-sm font-medium text-slate-200">Performance Throttling</span>
                                    </div>
                                    <span className="text-xs text-slate-500">Limit bandwidth usage during active hours</span>
                                </div>
                                <Switch checked={throttling} onCheckedChange={setThrottling} />
                            </div>

                            <div className="border-t border-slate-800 pt-4 mt-4">
                                <div className="flex items-center justify-between space-x-4 mb-4">
                                    <span className="text-sm font-medium text-slate-200">Auto-Sync</span>
                                    <Switch checked={autoSync} onCheckedChange={setAutoSync} />
                                </div>
                                <div className="flex items-center justify-between space-x-4">
                                    <span className="text-sm font-medium text-slate-200">Background Sync</span>
                                    <Switch checked={backgroundSync} onCheckedChange={setBackgroundSync} />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                                Save Configuration
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    )
}

export default App
