import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder,
  File as FileIcon,
  ChevronRight,
  Search,
  ArrowLeft,
  Cloud,
  HardDrive,
  Check,
  X,
  RefreshCw,
  MoreVertical,
  LayoutGrid,
  List as ListIcon,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  Info,
  Home,
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Branding } from './Branding';

interface FileItem {
  Name: string;
  Size: number;
  IsDir: boolean;
  ModTime: string;
  MimeType: string;
  ID: string;
}

interface FileBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  title?: string;
  mode?: 'select' | 'manage';
  className?: string;
}

const API_URL = '/api/v1';

type SortField = 'Name' | 'Size' | 'ModTime';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

export const FileBrowser: React.FC<FileBrowserProps> = ({
  onSelect,
  onClose,
  title = 'Select Location',
  mode = 'select',
  className,
}) => {
  const [remotes, setRemotes] = useState<{ name: string; type: string }[]>([]);
  const [currentRemote, setCurrentRemote] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('Name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

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
      if (res.data.data && res.data.data.length > 0) {
        const local = res.data.data.find((r: any) => r.type === 'local');
        if (local) {
          setCurrentRemote(local.name);
        } else {
          setCurrentRemote(res.data.data[0].name);
        }
      }
    } catch (e) {
      setError('Failed to fetch storage remotes');
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    setSelectedItems(new Set());
    try {
      const res = await axios.get(`${API_URL}/files/list`, {
        params: {
          remote: currentRemote,
          path: currentPath,
        },
      });
      setItems(res.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Failed to list directory');
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

  const navigateHome = () => {
    setCurrentPath('');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleItemClick = (item: FileItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item.Name)) {
        newSelected.delete(item.Name);
      } else {
        newSelected.add(item.Name);
      }
      setSelectedItems(newSelected);
    } else {
      // Single select unless managing? For now simple selection
      setSelectedItems(new Set([item.Name]));
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.IsDir) {
      navigateTo(item.Name);
    } else {
      // Handle file open/preview?
      if (mode === 'select') {
        const fullPath = currentRemote
          ? `${currentRemote}:${currentPath}/${item.Name}`
          : `${currentPath}/${item.Name}`;
        onSelect(fullPath);
        onClose();
      }
    }
  };

  const sortedItems = useMemo(() => {
    let result = items.filter((item) =>
      item.Name.toLowerCase().includes(search.toLowerCase())
    );

    return result.sort((a, b) => {
      // Always directories first
      if (a.IsDir !== b.IsDir) return a.IsDir ? -1 : 1;

      let comparison = 0;
      switch (sortField) {
        case 'Name':
          comparison = a.Name.localeCompare(b.Name);
          break;
        case 'Size':
          comparison = a.Size - b.Size;
          break;
        case 'ModTime':
          comparison =
            new Date(a.ModTime).getTime() - new Date(b.ModTime).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [items, search, sortField, sortOrder]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // --- Render Components ---

  const Breadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className='flex items-center text-sm text-zinc-400 overflow-hidden whitespace-nowrap mask-linear-fade'>
        <button
          onClick={navigateHome}
          className='hover:text-cyan-400 transition-colors'
        >
          {currentRemote || 'Root'}
        </button>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight className='w-4 h-4 mx-1 text-zinc-600' />
            <span
              className={cn(
                'transition-colors cursor-pointer hover:text-cyan-400',
                index === parts.length - 1 ? 'text-zinc-200 font-medium' : ''
              )}
              onClick={() => {
                const newPath = parts.slice(0, index + 1).join('/');
                setCurrentPath(newPath);
              }}
            >
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const FileIconComponent = ({
    item,
    className,
  }: {
    item: FileItem;
    className?: string;
  }) => {
    if (item.IsDir)
      return (
        <Folder className={cn('text-cyan-500 fill-cyan-500/10', className)} />
      );
    // Basic Extension mapping
    const ext = item.Name.split('.').pop()?.toLowerCase();
    // Return different icons based on extension if needed
    return <FileIcon className={cn('text-zinc-500', className)} />;
  };

  const ListView = () => (
    <div className='w-full min-w-[600px]'>
      {/* Headers */}
      <div className='grid grid-cols-[auto_1fr_1fr_1fr] gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-[10px] font-bold text-zinc-500 uppercase tracking-widest sticky top-0 z-10 backdrop-blur-sm'>
        <div className='w-8'></div>
        <div
          className='cursor-pointer hover:text-zinc-300 flex items-center gap-1'
          onClick={() => handleSort('Name')}
        >
          Name
          {sortField === 'Name' &&
            (sortOrder === 'asc' ? (
              <ArrowUp className='w-3 h-3' />
            ) : (
              <ArrowDown className='w-3 h-3' />
            ))}
        </div>
        <div
          className='text-right cursor-pointer hover:text-zinc-300 flex items-center justify-end gap-1'
          onClick={() => handleSort('Size')}
        >
          Size
          {sortField === 'Size' &&
            (sortOrder === 'asc' ? (
              <ArrowUp className='w-3 h-3' />
            ) : (
              <ArrowDown className='w-3 h-3' />
            ))}
        </div>
        <div
          className='text-right cursor-pointer hover:text-zinc-300 flex items-center justify-end gap-1'
          onClick={() => handleSort('ModTime')}
        >
          Date Modified
          {sortField === 'ModTime' &&
            (sortOrder === 'asc' ? (
              <ArrowUp className='w-3 h-3' />
            ) : (
              <ArrowDown className='w-3 h-3' />
            ))}
        </div>
      </div>
      {/* Rows */}
      <div className='divide-y divide-zinc-800/30'>
        {sortedItems.map((item, idx) => (
          <div
            key={item.ID || idx}
            onClick={(e) => handleItemClick(item, e)}
            onDoubleClick={() => handleItemDoubleClick(item)}
            className={cn(
              'grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-4 px-4 py-2.5 text-sm transition-all group cursor-pointer select-none',
              selectedItems.has(item.Name)
                ? 'bg-cyan-500/10 border-l-2 border-cyan-500 text-white'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border-l-2 border-transparent'
            )}
          >
            <div className='w-8 flex justify-center'>
              <FileIconComponent item={item} className='w-5 h-5' />
            </div>
            <span className='truncate font-medium'>{item.Name}</span>
            <span className='text-right font-mono text-xs opacity-70'>
              {item.IsDir ? '--' : formatSize(item.Size)}
            </span>
            <span className='text-right font-mono text-xs opacity-70'>
              {new Date(item.ModTime).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const GridView = () => (
    <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4'>
      {sortedItems.map((item, idx) => (
        <div
          key={item.ID || idx}
          onClick={(e) => handleItemClick(item, e)}
          onDoubleClick={() => handleItemDoubleClick(item)}
          className={cn(
            'flex flex-col items-center gap-3 p-4 rounded-xl transition-all group cursor-pointer select-none border border-transparent',
            selectedItems.has(item.Name)
              ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
              : 'hover:bg-zinc-800/50 hover:border-zinc-800'
          )}
        >
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
              selectedItems.has(item.Name)
                ? 'bg-cyan-500/20'
                : 'bg-zinc-900 group-hover:bg-zinc-800'
            )}
          >
            <FileIconComponent item={item} className='w-6 h-6' />
          </div>
          <div className='text-center w-full'>
            <div
              className={cn(
                'text-sm font-medium truncate w-full mb-1',
                selectedItems.has(item.Name) ? 'text-cyan-100' : 'text-zinc-300'
              )}
            >
              {item.Name}
            </div>
            <div className='text-[10px] text-zinc-500 font-mono'>
              {item.IsDir ? 'Directory' : formatSize(item.Size)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // --- Main Integration Layout ---

  return (
    <div
      className={cn(
        mode === 'manage'
          ? 'flex flex-col h-full bg-zinc-950'
          : 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className={cn(
          'flex flex-col overflow-hidden bg-zinc-950',
          mode === 'select' &&
            'w-full max-w-5xl h-[85vh] rounded-2xl border border-zinc-800 shadow-2xl'
        )}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Header / Toolbar */}
        <header className='flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 p-4'>
          <div className='flex items-center justify-between gap-4 mb-4'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-white/5 flex items-center justify-center'>
                <HardDrive className='w-5 h-5 text-cyan-400' />
              </div>
              <div>
                <h2 className='text-lg font-bold text-white tracking-tight'>
                  {mode === 'manage' ? 'File Manager' : title}
                </h2>
                <div className='text-[10px] text-zinc-500 font-mono uppercase tracking-widest flex items-center gap-2'>
                  <span>{items.length} Items</span>
                  <span className='w-1 h-1 rounded-full bg-zinc-700' />
                  <span>{currentRemote || 'Local'}</span>
                </div>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              {/* View Toggles */}
              <div className='flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800'>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded-md transition-all',
                    viewMode === 'list'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <ListIcon className='w-4 h-4' />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-1.5 rounded-md transition-all',
                    viewMode === 'grid'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <LayoutGrid className='w-4 h-4' />
                </button>
              </div>

              {mode === 'select' && (
                <Button
                  variant='ghost'
                  onClick={onClose}
                  size='icon'
                  className='ml-2 hover:bg-red-500/10 hover:text-red-500'
                >
                  <X className='w-5 h-5' />
                </Button>
              )}
            </div>
          </div>

          {/* Navigation Bar */}
          <div className='flex items-center gap-2'>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => navigateTo('..')}
                disabled={!currentPath}
                className='h-8 w-8 text-zinc-400'
              >
                <ArrowLeft className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={navigateHome}
                className='h-8 w-8 text-zinc-400'
              >
                <Home className='w-4 h-4' />
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={fetchItems}
                className='h-8 w-8 text-zinc-400 hover:text-cyan-400'
              >
                <RefreshCw
                  className={cn('w-4 h-4', loading && 'animate-spin')}
                />
              </Button>
            </div>

            <div className='flex-1 bg-zinc-900 border border-zinc-800 rounded-lg h-9 px-3 flex items-center shadow-inner'>
              <Breadcrumbs />
            </div>

            <div className='relative w-64'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500' />
              <input
                type='text'
                placeholder='Search current view...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className='w-full bg-zinc-900 border border-zinc-800 rounded-lg h-9 pl-9 pr-3 text-sm text-zinc-200 focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none transition-all placeholder:text-zinc-600'
              />
            </div>
          </div>
        </header>

        <div className='flex-1 flex overflow-hidden'>
          {/* Sidebar */}
          <aside className='w-64 bg-zinc-900/30 border-r border-zinc-800 flex flex-col overflow-y-auto'>
            <div className='p-4 space-y-6'>
              <div>
                <h3 className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2'>
                  Storage Types
                </h3>
                <div className='space-y-1'>
                  {remotes.map((remote) => (
                    <button
                      key={remote.name}
                      onClick={() => {
                        setCurrentRemote(remote.name);
                        setCurrentPath('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group',
                        currentRemote === remote.name
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/10'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                      )}
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          currentRemote === remote.name
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'
                        )}
                      >
                        {remote.type === 'local' ? (
                          <HardDrive className='w-3.5 h-3.5' />
                        ) : (
                          <Cloud className='w-3.5 h-3.5' />
                        )}
                      </div>
                      <span className='truncate'>{remote.name}</span>
                      {currentRemote === remote.name && (
                        <div className='ml-auto w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Widget */}
              <div className='bg-zinc-900 rounded-xl p-4 border border-zinc-800 mt-auto'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-[10px] uppercase font-bold text-zinc-500'>
                    Node Status
                  </span>
                  <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
                </div>
                <div className='text-xl font-mono text-zinc-300 font-bold'>
                  {items.length}{' '}
                  <span className='text-xs font-sans font-normal text-zinc-500'>
                    objects
                  </span>
                </div>
              </div>

              <Branding className='mt-4 opacity-50 scale-90 origin-left' />
            </div>
          </aside>

          {/* Main Content Area */}
          <main className='flex-1 overflow-auto bg-zinc-950/50 scrollbar-thin scrollbar-thumb-zinc-800'>
            {loading && (
              <div className='h-full flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500'>
                <div className='relative'>
                  <div className='w-12 h-12 rounded-full border-2 border-zinc-800 border-t-cyan-500 animate-spin'></div>
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <div className='w-2 h-2 rounded-full bg-cyan-500 animate-pulse'></div>
                  </div>
                </div>
                <p className='text-xs text-zinc-500 font-mono uppercase tracking-widest'>
                  Constructing Index...
                </p>
              </div>
            )}

            {!loading && error && (
              <div className='h-full flex flex-col items-center justify-center gap-4 text-center px-8'>
                <div className='w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2'>
                  <X className='w-8 h-8 text-red-500' />
                </div>
                <h3 className='text-lg font-bold text-zinc-200'>
                  Connection Terminated
                </h3>
                <p className='text-sm text-zinc-500 max-w-sm'>{error}</p>
                <Button
                  onClick={fetchItems}
                  variant='outline'
                  className='mt-4 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                >
                  Retry Uplink
                </Button>
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <div className='h-full flex flex-col items-center justify-center gap-2 opacity-50'>
                <Folder className='w-12 h-12 text-zinc-700' />
                <p className='text-sm text-zinc-500 font-medium'>
                  Empty Directory
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              items.length > 0 &&
              (viewMode === 'list' ? <ListView /> : <GridView />)}
          </main>
        </div>

        {/* Footer (Select Mode Only) */}
        {mode === 'select' && (
          <footer className='p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between'>
            <div className='text-xs text-zinc-500'>
              {selectedItems.size > 0
                ? `${selectedItems.size} items selected`
                : 'Select an item to continue'}
            </div>
            <div className='flex gap-2'>
              <Button
                variant='ghost'
                onClick={onClose}
                className='text-zinc-400 hover:text-white'
              >
                Cancel
              </Button>
              <Button
                disabled={selectedItems.size === 0}
                onClick={() => {
                  if (selectedItems.size > 0) {
                    // Return first selected for now
                    const first = Array.from(selectedItems)[0];
                    const fullPath = currentRemote
                      ? `${currentRemote}:${currentPath}/${first}`
                      : `${currentPath}/${first}`;
                    onSelect(fullPath);
                    onClose();
                  }
                }}
                className='bg-cyan-600 hover:bg-cyan-500 text-white'
              >
                Select
              </Button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
