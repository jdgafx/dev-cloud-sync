
import React, { useState } from 'react';
import {
    Plus,
    X,
    ArrowRight,
    Clock,
    FolderInput,
    Lock,
    Globe,
    Zap,
    CheckCircle2,
    HardDrive
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { FileBrowser } from './FileBrowser';

interface CreateJobModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const API_URL = 'http://localhost:8888/api/v1';

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [interval, setIntervalVal] = useState(60);

    const [browserType, setBrowserType] = useState<'source' | 'destination' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !source || !destination) {
            setError("Mission parameters incomplete. Source, Destination, and Name are required.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await axios.post(`${API_URL}/jobs`, {
                name,
                source,
                destination,
                intervalMinutes: Number(interval)
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.error?.message || "Internal Engine Error: Failed to deploy mission.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
                <Card className="w-full max-w-xl bg-slate-900 border-slate-800 shadow-3xl overflow-hidden outline-none">
                    <form onSubmit={handleSubmit}>
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                                        <Zap className="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Deploy New Mission</h2>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Initialization Protocol 1.0.4</p>
                                    </div>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-white hover:bg-slate-800">
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {error && (
                                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold animate-in slide-in-from-top-2">
                                    CRITICAL ERROR: {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Mission Identifier</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. Daily S3 Archive"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Source Sector</label>
                                    <div className="relative group">
                                        <input
                                            readOnly
                                            type="text"
                                            placeholder="Select path..."
                                            value={source}
                                            onClick={() => setBrowserType('source')}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-cyan-400 font-mono cursor-pointer group-hover:border-cyan-500/30 transition-all truncate"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setBrowserType('source')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
                                        >
                                            <FolderInput className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Target Destination</label>
                                    <div className="relative group">
                                        <input
                                            readOnly
                                            type="text"
                                            placeholder="Select path..."
                                            value={destination}
                                            onClick={() => setBrowserType('destination')}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-sm text-blue-400 font-mono cursor-pointer group-hover:border-blue-500/30 transition-all truncate"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setBrowserType('destination')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 transition-all"
                                        >
                                            <FolderInput className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sync Interval</label>
                                    <span className="text-xs font-mono text-cyan-500 font-bold">{interval} MINUTES</span>
                                </div>
                                <div className="relative flex items-center gap-4">
                                    <Clock className="w-4 h-4 text-slate-700" />
                                    <input
                                        type="range"
                                        min="1"
                                        max="1440"
                                        step="15"
                                        value={interval}
                                        onChange={(e) => setIntervalVal(parseInt(e.target.value))}
                                        className="flex-1 accent-cyan-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">Status</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Validation Passed</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">Abort</Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-950/40 px-10 h-12 rounded-xl transition-all active:scale-95"
                                >
                                    {loading ? "INITIALIZING..." : (
                                        <>
                                            DEPLOY MISSION
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Card>
            </div>

            {/* Internal File Browser */}
            {browserType && (
                <FileBrowser
                    title={browserType === 'source' ? "Select Source Path" : "Select Target Path"}
                    onSelect={(path) => {
                        if (browserType === 'source') setSource(path);
                        else setDestination(path);
                    }}
                    onClose={() => setBrowserType(null)}
                />
            )}
        </>
    );
};
