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
  FolderOpen,
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

const Globe = ({ className }: { className?: string }) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    className={className}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <circle cx='12' cy='12' r='10' />
    <path d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' />
    <path d='M2 12h20' />
  </svg>
);

interface RemoteConfigModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = '/api/v1';

const REMOTE_TYPES = [
  {
    id: 'drive',
    label: 'Google Drive',
    icon: Globe,
    desc: 'Personal or Shared Google Drive folders',
    authRequired: true,
  },
  {
    id: 'dropbox',
    label: 'Dropbox',
    icon: Cloud,
    desc: 'Dropbox Personal or Business',
    authRequired: true,
  },
  {
    id: 'onedrive',
    label: 'OneDrive',
    icon: Cloud,
    desc: 'Microsoft OneDrive Personal or Business',
    authRequired: true,
  },
  {
    id: 'box',
    label: 'Box',
    icon: Cloud,
    desc: 'Box cloud storage',
    authRequired: true,
  },
  {
    id: 's3',
    label: 'Amazon S3',
    icon: Server,
    desc: 'AWS S3, DigitalOcean Spaces, Minio, etc.',
    authRequired: false,
  },
  {
    id: 'b2',
    label: 'Backblaze B2',
    icon: Cloud,
    desc: 'Backblaze B2 Cloud Storage',
    authRequired: false,
  },
  {
    id: 'azureblob',
    label: 'Azure Blob',
    icon: Cloud,
    desc: 'Microsoft Azure Blob Storage',
    authRequired: false,
  },
  {
    id: 'pcloud',
    label: 'pCloud',
    icon: Cloud,
    desc: 'pCloud storage',
    authRequired: true,
  },
  {
    id: 'webdav',
    label: 'WebDAV',
    icon: Cloud,
    desc: 'WebDAV servers (TeraBox, ownCloud, Nextcloud, etc.)',
    authRequired: false,
  },
  {
    id: 'sftp',
    label: 'SFTP',
    icon: Server,
    desc: 'SSH/SFTP servers',
    authRequired: false,
  },
  {
    id: 'local',
    label: 'Local Disk',
    icon: HardDrive,
    desc: 'Local filesystem paths',
    authRequired: false,
  },
  {
    id: 'alias',
    label: 'Alias',
    icon: FolderOpen,
    desc: 'A path alias to another remote',
  },
  {
    id: 'crypt',
    label: 'Encryption',
    icon: Shield,
    desc: 'Encrypted overlay for any remote',
  },
];

export const RemoteConfigModal: React.FC<RemoteConfigModalProps> = ({
  onClose,
  onSuccess,
}) => {
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
      // For this refinement, we'll demonstrate the UI flow.

      await axios.post(`${API_URL}/remotes`, { name, type });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(
        'This remote type requires manual configuration. Run: rclone config'
      );
      setLoading(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
      onClick={(e) => e.stopPropagation()}
    >
      <Card
        className='w-full max-w-md bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden overflow-y-auto max-h-[90vh]'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className='h-1 w-full bg-zinc-800'>
          <div
            className={cn(
              'h-full bg-white transition-all duration-300',
              step === 1 ? 'w-1/2' : 'w-full'
            )}
          />
        </div>

        <div className='p-8'>
          <div className='flex items-center justify-between mb-8'>
            <div className='flex items-center gap-3'>
              <div className='w-4 h-4 rounded bg-white' />
              <div>
                <h2 className='text-lg font-semibold text-white'>Add Remote</h2>
                <p className='text-[10px] text-zinc-500 uppercase font-medium'>
                  Step {step} of 2
                </p>
              </div>
            </div>
            <Button
              variant='ghost'
              size='icon'
              onClick={onClose}
              className='text-zinc-500 hover:text-white w-8 h-8'
            >
              <X className='w-4 h-4' />
            </Button>
          </div>

          {error && (
            <div className='mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20'>
              <p className='text-xs font-bold text-red-500 mb-1 flex items-center gap-2'>
                <Zap className='w-3.5 h-3.5 fill-red-500' />
                Configuration Required
              </p>
              <p className='text-xs text-red-400/80 leading-relaxed font-mono'>
                {error}
              </p>
              <div className='mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400'>
                $ rclone config
              </div>
            </div>
          )}

          {step === 1 ? (
            <div className='space-y-6 animate-in fade-in duration-300'>
              <div className='space-y-4'>
                <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
                  Select Remote Type
                </label>
                <div className='grid grid-cols-1 gap-2'>
                  {REMOTE_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type='button'
                      onClick={() => setType(t.id)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg border text-left transition-all duration-150 cursor-pointer',
                        type === t.id
                          ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500'
                          : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                      )}
                    >
                      <div
                        className={cn(
                          'p-2.5 rounded-lg transition-colors',
                          type === t.id
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 text-zinc-400'
                        )}
                      >
                        <t.icon className='w-4 h-4' />
                      </div>
                      <div className='flex-1'>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            type === t.id ? 'text-white' : 'text-zinc-300'
                          )}
                        >
                          {t.label}
                        </p>
                        <p className='text-[10px] text-zinc-500'>{t.desc}</p>
                      </div>
                      {type === t.id && (
                        <Check className='w-5 h-5 text-white' />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                disabled={!type}
                onClick={() => setStep(2)}
                className='w-full h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium'
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className='space-y-6 animate-in fade-in duration-300'>
              <div className='space-y-4'>
                <div>
                  <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1'>
                    Remote Name
                  </label>
                  <input
                    autoFocus
                    type='text'
                    placeholder='e.g. dropbox'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className='w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all mt-2'
                  />
                  <p className='text-[10px] text-zinc-600 mt-2 px-1'>
                    Use a unique identifier for this remote connection.
                  </p>
                </div>

                <div className='p-4 rounded-lg bg-zinc-800/20 border border-zinc-800 flex gap-4'>
                  <Shield className='w-4 h-4 text-zinc-400 shrink-0' />
                  <div>
                    <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-widest'>
                      Authentication
                    </p>
                    <p className='text-[11px] text-zinc-500 mt-1 leading-relaxed'>
                      Finalizing this connection may require an authorization
                      step in your browser.
                    </p>
                  </div>
                </div>
              </div>

              <div className='flex items-center gap-3 pt-4'>
                <Button
                  variant='ghost'
                  onClick={() => setStep(1)}
                  className='text-zinc-500 hover:text-white'
                >
                  Back
                </Button>
                <Button
                  disabled={!name || loading}
                  onClick={handleCreateRemote}
                  className='flex-1 h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium'
                >
                  {loading ? (
                    <Loader2 className='w-4 h-4 animate-spin text-black' />
                  ) : (
                    'Save Remote'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className='px-8 py-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-center'>
          <span className='text-[10px] text-zinc-600 uppercase font-medium tracking-tight'>
            CloudSync Build 77
          </span>
        </div>
      </Card>
    </div>
  );
};
