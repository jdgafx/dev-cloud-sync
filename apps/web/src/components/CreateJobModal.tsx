
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

const API_URL = '/api/v1';

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [source, setSource] = useState('');
    const [destination, setDestination] = useState('');
    const [interval, setIntervalVal] = useState(5);

    const [browserType, setBrowserType] = useState<'source' | 'destination' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !source || !destination) {
            setError("Parameters incomplete. Source, Destination, and Name are required.");
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
            setError(e.response?.data?.error?.message || "Internal Error: Failed to create sync job.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <Card className="w-full max-w-lg bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden outline-none">
                    <form onSubmit={handleSubmit}>
                        <div className="px-6 py-4 border-b border-zinc-800">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-semibold text-white tracking-tight">New Sync Job</h2>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-white hover:bg-zinc-800 w-8 h-8">
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="px-6 py-6 space-y-6">
                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Job Name</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. Daily Backup"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Source Path</label>
                                    <div className="relative group">
                                        <input
                                            readOnly
                                            type="text"
                                            placeholder="Select..."
                                            value={source}
                                            onClick={() => setBrowserType('source')}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-100 font-mono cursor-pointer hover:border-zinc-700 transition-all truncate"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setBrowserType('source')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
                                        >
                                            <FolderInput className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Destination</label>
                                    <div className="relative group">
                                        <input
                                            readOnly
                                            type="text"
                                            placeholder="Select..."
                                            value={destination}
                                            onClick={() => setBrowserType('destination')}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-100 font-mono cursor-pointer hover:border-zinc-700 transition-all truncate"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setBrowserType('destination')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
                                        >
                                            <FolderInput className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interval</label>
                                    <span className="text-[10px] font-mono text-zinc-400">{interval} MIN</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="1440"
                                    step="1"
                                    value={interval}
                                    onChange={(e) => setIntervalVal(parseInt(e.target.value))}
                                    className="w-full accent-white h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-500 hover:text-white text-sm">Cancel</Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-white text-black hover:bg-zinc-200 px-6 h-9 rounded-lg font-medium text-sm transition-all"
                            >
                                {loading ? "Creating..." : "Create Sync Job"}
                            </Button>
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
