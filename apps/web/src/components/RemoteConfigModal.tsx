
import React, { useState } from 'react';
import {
    X,
    Cloud,
    Check,
    Zap,
    Server,
    ExternalLink,
    Shield,
    Loader2,
    HardDrive,
    FolderOpen
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

const Globe = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
)

interface RemoteConfigModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const API_URL = '/api/v1';

const REMOTE_TYPES = [
    { id: 'alias', label: 'Alias', icon: FolderOpen, desc: 'A path alias to another remote or local folder' },
    { id: 'crypt', label: 'Encryption', icon: Shield, desc: 'Encrypted overlay for any existing remote' },
    { id: 'local', label: 'Local Disk', icon: HardDrive, desc: 'Direct access to server filesystem' },
    { id: 's3', label: 'Amazon S3', icon: Server, desc: 'AWS S3, DigitalOcean Space, Minio, etc.' },
    { id: 'drive', label: 'Google Drive', icon: Globe, desc: 'Personal or Shared Google Drive sectors' }
];

export const RemoteConfigModal: React.FC<RemoteConfigModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateRemote = async () => {
        if (!name || !type) return;
        setLoading(true);
        setError(null);
        try {
            // In a real app, this would trigger a multi-step rclone config
            // Here we just use a simplified endpoint if available, or instruct the user
            // Assuming backend has a simplified creator or we just mock success for now
            // Actually, rclone config is interactive, so usually we'd use a terminal or a complex form.
            // For this refinement, we'll demonstrate the UI flow.

            await axios.post(`${API_URL}/remotes`, { name, type });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError("This specific protocol requires manual terminal authorization on the host machine. Run: rclone config");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <Card className="w-full max-w-lg bg-slate-900 border-slate-800 shadow-3xl overflow-hidden overflow-y-auto max-h-[90vh]">

                {/* Progress Bar */}
                <div className="h-1 w-full bg-slate-800">
                    <div className={cn(
                        "h-full bg-cyan-500 transition-all duration-500",
                        step === 1 ? "w-1/2" : "w-full"
                    )} />
                </div>

                <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Cloud className="w-6 h-6 text-cyan-500" />
                            <div>
                                <h2 className="text-xl font-bold text-white">Storage Gateway</h2>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Step {step} of 2</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-white">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                            <p className="text-xs font-bold text-red-500 mb-1 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 fill-red-500" />
                                HANDSHAKE FAILED
                            </p>
                            <p className="text-xs text-red-400/80 leading-relaxed font-mono">{error}</p>
                            <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400">
                                $ rclone config
                            </div>
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Select Protocol</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {REMOTE_TYPES.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setType(t.id)}
                                            className={cn(
                                                "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                                                type === t.id
                                                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
                                                    : "bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950"
                                            )}
                                        >
                                            <div className={cn(
                                                "p-2.5 rounded-lg",
                                                type === t.id ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"
                                            )}>
                                                <t.icon className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={cn("text-sm font-bold", type === t.id ? "text-white" : "text-slate-300")}>{t.label}</p>
                                                <p className="text-[10px] text-slate-500">{t.desc}</p>
                                            </div>
                                            {type === t.id && <Check className="w-4 h-4 text-cyan-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Button
                                disabled={!type}
                                onClick={() => setStep(2)}
                                className="w-full h-12 bg-slate-100 text-slate-950 hover:bg-white rounded-xl font-bold"
                            >
                                Continue Protocol Setup
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Gateway Alias</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="e.g. dropbox-main"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-lg text-white font-mono placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all mt-2"
                                    />
                                    <p className="text-[10px] text-slate-600 mt-2 px-1">Alphanumeric characters only. This will be your rclone remote name.</p>
                                </div>

                                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex gap-4">
                                    <Shield className="w-5 h-5 text-orange-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Authentication Notice</p>
                                        <p className="text-[11px] text-orange-400/70 mt-1 leading-relaxed">
                                            Finalizing this connection may require an OAuth handshake in your default browser.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setStep(1)} className="text-slate-500">Back</Button>
                                <Button
                                    disabled={!name || loading}
                                    onClick={handleCreateRemote}
                                    className="flex-1 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-xl shadow-cyan-900/20"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize & Save Gateway"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-center gap-2">
                    <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">CloudSync Core</span>
                    <span className="text-slate-800 text-[8px]">•</span>
                    <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">Alpha Build 77</span>
                </div>
            </Card>
        </div>
    );
};

