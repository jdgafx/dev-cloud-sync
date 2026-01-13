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
  HardDrive,
  Settings,
  ChevronDown,
  ChevronUp,
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

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [interval, setIntervalVal] = useState(5);
  const [concurrency, setConcurrency] = useState(8);
  const [timeout, setTimeout] = useState(30);
  const [retries, setRetries] = useState(10);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [browserType, setBrowserType] = useState<
    'source' | 'destination' | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !source || !destination) {
      setError(
        'Parameters incomplete. Source, Destination, and Name are required.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/jobs`, {
        name,
        source,
        destination,
        intervalMinutes: Number(interval),
        concurrency: Number(concurrency),
        timeout: Number(timeout),
        retries: Number(retries),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(
        e.response?.data?.error?.message ||
          'Internal Error: Failed to create sync job.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <Card
          className='w-full max-w-lg bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden outline-none'
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <form onSubmit={handleSubmit}>
            <div className='px-6 py-4 border-b border-zinc-800'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <h2 className='text-lg font-semibold text-white tracking-tight'>
                    New Sync Job
                  </h2>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                  }}
                  className='text-zinc-500 hover:text-white hover:bg-zinc-800 w-8 h-8'
                >
                  <X className='w-4 h-4' />
                </Button>
              </div>
            </div>

            <div className='px-6 py-6 space-y-6'>
              {error && (
                <div className='p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium'>
                  {error}
                </div>
              )}

              <div className='space-y-2'>
                <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1'>
                  Job Name
                </label>
                <input
                  autoFocus
                  type='text'
                  placeholder='e.g. Daily Backup'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all'
                />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1'>
                    Source Path
                  </label>
                  <div className='relative group'>
                    <input
                      readOnly
                      type='text'
                      placeholder='Select...'
                      value={source}
                      onClick={() => setBrowserType('source')}
                      className='w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-100 font-mono cursor-pointer hover:border-zinc-700 transition-all truncate'
                    />
                    <button
                      type='button'
                      onClick={() => setBrowserType('source')}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white'
                    >
                      <FolderInput className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                <div className='space-y-2'>
                  <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1'>
                    Destination
                  </label>
                  <div className='relative group'>
                    <input
                      readOnly
                      type='text'
                      placeholder='Select...'
                      value={destination}
                      onClick={() => setBrowserType('destination')}
                      className='w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm text-zinc-100 font-mono cursor-pointer hover:border-zinc-700 transition-all truncate'
                    />
                    <button
                      type='button'
                      onClick={() => setBrowserType('destination')}
                      className='absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white'
                    >
                      <FolderInput className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='flex items-center justify-between ml-1'>
                  <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
                    Interval
                  </label>
                  <span className='text-[10px] font-mono text-zinc-400'>
                    {interval} MIN
                  </span>
                </div>
                <input
                  type='range'
                  min='1'
                  max='1440'
                  step='1'
                  value={interval}
                  onChange={(e) => setIntervalVal(parseInt(e.target.value))}
                  className='w-full accent-white h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer'
                />
              </div>

              {/* Advanced Settings */}
              <div className='border-t border-zinc-800 pt-4'>
                <button
                  type='button'
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className='flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors'
                >
                  <Settings className='w-4 h-4' />
                  Advanced Settings
                  {advancedOpen ? (
                    <ChevronUp className='w-3 h-3' />
                  ) : (
                    <ChevronDown className='w-3 h-3' />
                  )}
                </button>

                {advancedOpen && (
                  <div className='mt-4 space-y-4 p-4 bg-zinc-950/50 rounded-lg'>
                    {/* Concurrency Setting */}
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <label className='text-xs font-medium text-zinc-400'>
                          Concurrent Transfers
                        </label>
                        <span className='text-xs font-mono text-cyan-400'>
                          {concurrency}
                        </span>
                      </div>
                      <input
                        type='range'
                        min='1'
                        max='1000'
                        step='1'
                        value={concurrency}
                        onChange={(e) =>
                          setConcurrency(parseInt(e.target.value))
                        }
                        className='w-full accent-cyan-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer'
                      />
                      <p className='text-[10px] text-zinc-600'>
                        Higher values = faster transfers but more memory usage
                      </p>
                    </div>

                    {/* Timeout Setting */}
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <label className='text-xs font-medium text-zinc-400'>
                          Timeout (seconds)
                        </label>
                        <span className='text-xs font-mono text-cyan-400'>
                          {timeout}s
                        </span>
                      </div>
                      <input
                        type='range'
                        min='10'
                        max='300'
                        step='10'
                        value={timeout}
                        onChange={(e) => setTimeout(parseInt(e.target.value))}
                        className='w-full accent-cyan-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer'
                      />
                      <p className='text-[10px] text-zinc-600'>
                        Increase for slow connections or large files
                      </p>
                    </div>

                    {/* Retries Setting */}
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <label className='text-xs font-medium text-zinc-400'>
                          Retry Attempts
                        </label>
                        <span className='text-xs font-mono text-cyan-400'>
                          {retries}
                        </span>
                      </div>
                      <input
                        type='range'
                        min='1'
                        max='50'
                        step='1'
                        value={retries}
                        onChange={(e) => setRetries(parseInt(e.target.value))}
                        className='w-full accent-cyan-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer'
                      />
                      <p className='text-[10px] text-zinc-600'>
                        Number of retry attempts on failure
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className='px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3'>
              <Button
                type='button'
                variant='ghost'
                onClick={(e) => {
                  e.preventDefault();
                  onClose();
                }}
                className='text-zinc-500 hover:text-white text-sm'
              >
                Cancel
              </Button>
              <Button
                type='submit'
                disabled={loading}
                className='bg-white text-black hover:bg-zinc-200 px-6 h-9 rounded-lg font-medium text-sm transition-all'
              >
                {loading ? 'Creating...' : 'Create Sync Job'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Internal File Browser */}
      {browserType && (
        <FileBrowser
          title={
            browserType === 'source'
              ? 'Select Source Path'
              : 'Select Target Path'
          }
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
