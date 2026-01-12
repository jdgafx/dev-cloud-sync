
import React, { useState, useEffect } from 'react';
import {
    Folder,
    File,
    ChevronRight,
    Search,
    ArrowLeft,
    Cloud,
    HardDrive,
    Check,
    X,
    RefreshCw,
    MoreVertical,
    ChevronDown
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface FileItem {
    Name: string;
    Size: number;
    IsDir: boolean;
    ModTime: string;
}

interface FileBrowserProps {
    onSelect: (path: string) => void;
    onClose: () => void;
    title?: string;
}

const API_URL = '/api/v1';

export const FileBrowser: React.FC<FileBrowserProps> = ({ onSelect, onClose, title = "Select Location" }) => {
    const [remotes, setRemotes] = useState<{ name: string, type: string }[]>([]);
    const [currentRemote, setCurrentRemote] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [items, setItems] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRemotes();
    }, []);

    useEffect(() => {
        if (currentRemote !== null) {
            fetchItems();
        }
    }, [currentRemote, currentPath]);

    const fetchRemotes = async () => {
        try {
            const res = await axios.get(`${API_URL}/remotes`);
            setRemotes(res.data.data || []);
            // Default to local if available or first remote
            if (res.data.data && res.data.data.length > 0) {
                // Find a "local" type if exists
                const local = res.data.data.find((r: any) => r.type === 'local');
                if (local) {
                    setCurrentRemote(local.name);
                } else {
                    setCurrentRemote(res.data.data[0].name);
                }
            }
        } catch (e) {
            setError("Failed to fetch storage remotes");
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/files/list`, {
                params: {
                    remote: currentRemote,
                    path: currentPath
                }
            });
            // rclone lsjson returns an array of items
            setItems(res.data.data || []);
        } catch (e: any) {
            setError(e.response?.data?.error?.message || "Failed to list directory");
        } finally {
            setLoading(false);
        }
    };

    const navigateTo = (dirName: string) => {
        const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        setCurrentPath(newPath);
    };

    const navigateUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleSelect = () => {
        const fullPath = currentRemote ? `${currentRemote}:${currentPath}` : currentPath;
        onSelect(fullPath);
        onClose();
    };

    const filteredItems = items.filter(item =>
        item.Name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-4xl h-[80vh] bg-slate-900 border-slate-800 shadow-2xl flex flex-col overflow-hidden outline-none">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                            <Folder className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-100">{title}</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                                {currentRemote ? `${currentRemote}:` : '/'}{currentPath || '(root)'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-500 hover:text-white hover:bg-slate-800">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 flex overflow-hidden">

                    {/* Sidebar: Remotes */}
                    <div className="w-48 border-r border-slate-800 bg-slate-950/30 p-2 space-y-1 overflow-y-auto">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Endpoints</div>
                        {remotes.map(remote => (
                            <button
                                key={remote.name}
                                onClick={() => {
                                    setCurrentRemote(remote.name);
                                    setCurrentPath('');
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                                    currentRemote === remote.name
                                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                                )}
                            >
                                {remote.type === 'local' ? <HardDrive className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                                <span className="truncate">{remote.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Main Content: File List */}
                    <div className="flex-1 flex flex-col bg-slate-900">

                        {/* Toolbar */}
                        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!currentPath}
                                onClick={navigateUp}
                                className="h-8 w-8 text-slate-400 disabled:opacity-20"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div className="flex-1 relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Filter items..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-md pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                />
                            </div>
                            <Button onClick={fetchItems} variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-cyan-400">
                                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            </Button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 opacity-20" />
                                    <span className="text-xs uppercase tracking-widest font-mono">Indexing Neural Map...</span>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-10">
                                    <XCircle className="w-12 h-12 text-red-500/20" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-300">Access Denied</p>
                                        <p className="text-xs text-slate-500 mt-1 max-w-xs">{error}</p>
                                    </div>
                                    <Button onClick={fetchItems} variant="outline" size="sm" className="mt-2 border-slate-800">Retry Connection</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-0.5">
                                    {filteredItems.map((item, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => item.IsDir && navigateTo(item.Name)}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group cursor-pointer",
                                                item.IsDir ? "hover:bg-cyan-500/5 text-slate-300 hover:text-cyan-200" : "text-slate-500 opacity-80"
                                            )}
                                        >
                                            {item.IsDir ? (
                                                <Folder className="w-4 h-4 text-cyan-500/50 group-hover:text-cyan-400 group-hover:fill-cyan-400/10 transition-all" />
                                            ) : (
                                                <File className="w-4 h-4 text-slate-600" />
                                            )}
                                            <span className="flex-1 truncate font-medium">{item.Name}</span>
                                            {item.IsDir && <ChevronRight className="w-3.5 h-3.5 text-slate-700 opacity-0 group-hover:opacity-100" />}
                                            {!item.IsDir && <span className="text-[10px] text-slate-700 font-mono">{(item.Size / 1024).toFixed(0)} KB</span>}
                                        </div>
                                    ))}
                                    {filteredItems.length === 0 && (
                                        <div className="py-20 text-center">
                                            <Folder className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                            <p className="text-sm text-slate-600">This sector is empty</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        <span>Ready for Extraction</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">Cancel</Button>
                        <Button
                            onClick={handleSelect}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl shadow-cyan-900/10 px-8"
                        >
                            <Check className="w-4 h-4 mr-2" />
                            Confirm Selection
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

const XCircle = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
)
