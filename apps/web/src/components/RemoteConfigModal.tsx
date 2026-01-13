import React, { useState, useEffect } from 'react';
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
  Info,
  Plus,
} from 'lucide-react';
import axios from 'axios';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from '../hooks/use-toast';

const GlobeIcon = ({ className }: { className?: string }) => (
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

interface RemoteField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'number';
  required?: boolean;
  optional?: boolean;
  options?: string[];
  placeholder?: string;
  default?: any;
}

interface RemoteType {
  id: string;
  name: string;
  icon: string;
  fields: RemoteField[];
  authRequired: boolean;
}

interface RemoteConfigModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = '/api/v1';

const ICON_MAP: Record<string, React.ElementType> = {
  'google-drive': GlobeIcon,
  'aws': Server,
  'dropbox': Cloud,
  'microsoft': Cloud,
  'box': Cloud,
  'b2': Cloud,
  'azure': Cloud,
  'pcloud': Cloud,
  'webdav': Cloud,
  'server': Server,
  'folder': HardDrive,
  'cloud': Cloud,
};

export const RemoteConfigModal: React.FC<RemoteConfigModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [remoteTypes, setRemoteTypes] = useState<RemoteType[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingTypes, setFetchingTypes] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedRemote, setSavedRemote] = useState<string | null>(null);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await axios.get(`${API_URL}/remotes/types`);
        setRemoteTypes(res.data.data || []);
      } catch (err) {
        console.error('Failed to fetch remote types', err);
        toast({
          title: 'Error',
          description: 'Failed to load cloud providers.',
          variant: 'destructive',
        });
      } finally {
        setFetchingTypes(false);
      }
    };
    fetchTypes();
  }, []);

  const selectedType = remoteTypes.find((t) => t.id === type);

  const handleConfigChange = (fieldName: string, value: string) => {
    setConfig((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleCreateRemote = async () => {
    if (!name || !type) return;
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_URL}/remotes`, { name, type, config });
      setSavedRemote(name);
      toast({
        title: 'Success',
        description: `Remote "${name}" created successfully.`,
        variant: 'success',
      });
    } catch (e: any) {
      const msg = e.response?.data?.error?.message || e.message || 'Failed to create remote';
      setError(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!name) return;
    setTesting(true);
    try {
      const remote = name.endsWith(':') ? name : `${name}:`;
      const res = await axios.post(`${API_URL}/remotes/test`, { remote });
      if (res.data?.data?.success || res.data?.success) {
        toast({
          title: 'Connection Successful',
          description: `Successfully connected to ${name}.`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: res.data?.data?.message || res.data?.message || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const isStep1Valid = !!type;
  const isStep2Valid = !!name && /^[a-zA-Z0-9_-]+$/.test(name);
  
  const requiredFields = selectedType?.fields.filter(f => f.required) || [];
  const isStep3Valid = requiredFields.every(f => !!config[f.name]);

  const renderField = (field: RemoteField) => {
    const value = config[field.name] || '';
    
    switch (field.type) {
      case 'select':
        return (
          <div key={field.name} className='space-y-2'>
            <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <select
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
              className='w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-zinc-700 transition-all'
            >
              <option value="">Select {field.label}...</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'number':
        return (
          <div key={field.name} className='space-y-2'>
            <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="number"
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
              className='bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-800 focus:ring-zinc-700'
            />
          </div>
        );
      case 'password':
        return (
          <div key={field.name} className='space-y-2'>
            <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="password"
              placeholder={field.placeholder || '********'}
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
              className='bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-800 focus:ring-zinc-700'
            />
          </div>
        );
      default:
        return (
          <div key={field.name} className='space-y-2'>
            <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="text"
              placeholder={field.placeholder}
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
              className='bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-800 focus:ring-zinc-700'
            />
          </div>
        );
    }
  };

  return (
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'
      onClick={(e) => e.stopPropagation()}
    >
      <Card
        className='w-full max-w-lg bg-zinc-900 border-zinc-800 shadow-2xl overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className='h-1 w-full bg-zinc-800'>
          <div
            className={cn(
              'h-full bg-white transition-all duration-300',
              step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'
            )}
          />
        </div>

        <div className='p-8 max-h-[80vh] overflow-y-auto'>
          <div className='flex items-center justify-between mb-8'>
            <div className='flex items-center gap-3'>
              <div className='w-4 h-4 rounded bg-white flex items-center justify-center'>
                 <Plus className="w-3 h-3 text-black" />
              </div>
              <div>
                <h2 className='text-lg font-semibold text-white'>Add Remote</h2>
                <p className='text-[10px] text-zinc-500 uppercase font-medium'>
                  Step {step} of 3
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
                Error
              </p>
              <p className='text-xs text-red-400/80 leading-relaxed font-mono'>
                {error}
              </p>
            </div>
          )}

          {step === 1 && (
            <div className='space-y-6 animate-in fade-in slide-in-from-right-2 duration-300'>
              <div className='space-y-4'>
                <label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
                  Select Provider Type
                </label>
                {fetchingTypes ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-700" />
                    <p className="text-zinc-500 text-xs">Fetching available providers...</p>
                  </div>
                ) : (
                  <div className='grid grid-cols-1 gap-2'>
                    {remoteTypes.map((t) => {
                      const Icon = ICON_MAP[t.icon] || Cloud;
                      return (
                        <button
                          key={t.id}
                          type='button'
                          onClick={() => {
                            setType(t.id);
                            setConfig({}); // Reset config when type changes
                          }}
                          className={cn(
                            'flex items-center gap-4 p-4 rounded-lg border text-left transition-all duration-150',
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
                            <Icon className='w-4 h-4' />
                          </div>
                          <div className='flex-1'>
                            <p
                              className={cn(
                                'text-sm font-semibold',
                                type === t.id ? 'text-white' : 'text-zinc-300'
                              )}
                            >
                              {t.name}
                            </p>
                            <p className='text-[10px] text-zinc-500'>
                              {t.authRequired ? 'OAuth Authentication' : 'Direct Configuration'}
                            </p>
                          </div>
                          {type === t.id && (
                            <Check className='w-5 h-5 text-white' />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button
                disabled={!isStep1Valid}
                onClick={() => setStep(2)}
                className='w-full h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium'
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className='space-y-6 animate-in fade-in slide-in-from-right-2 duration-300'>
              <div className='space-y-4'>
                <div>
                  <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1'>
                    Remote Name
                  </Label>
                  <Input
                    autoFocus
                    type='text'
                    placeholder='e.g. my-s3-bucket'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className='bg-zinc-950 border-zinc-800 text-white font-mono placeholder:text-zinc-800 focus:ring-zinc-700 mt-2'
                  />
                  <p className='text-[10px] text-zinc-600 mt-2 px-1'>
                    Use a unique identifier (letters, numbers, _, -).
                  </p>
                </div>

                <div className='p-4 rounded-lg bg-zinc-800/20 border border-zinc-800 flex gap-4'>
                  <Info className='w-4 h-4 text-zinc-400 shrink-0' />
                  <div>
                    <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-widest'>
                      Selected Provider
                    </p>
                    <p className='text-[11px] text-zinc-500 mt-1 leading-relaxed'>
                      You are configuring a <strong>{selectedType?.name}</strong> remote.
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
                  disabled={!isStep2Valid}
                  onClick={() => setStep(3)}
                  className='flex-1 h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium'
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className='space-y-6 animate-in fade-in slide-in-from-right-2 duration-300'>
              <div className='space-y-6'>
                <div className="flex items-center justify-between">
                   <Label className='text-[10px] font-bold text-zinc-500 uppercase tracking-widest'>
                    Configuration Fields
                  </Label>
                  {selectedType?.authRequired && (
                    <span className="flex items-center gap-1 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      <ExternalLink className="w-2.5 h-2.5" />
                      OAUTH REQUIRED
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedType?.fields && selectedType.fields.length > 0 ? (
                    selectedType.fields.map(renderField)
                  ) : (
                    <div className="py-8 text-center border border-dashed border-zinc-800 rounded-lg">
                       <p className="text-zinc-500 text-xs">No additional configuration required for this type.</p>
                    </div>
                  )}
                </div>

                {selectedType?.authRequired && (
                  <div className='p-4 rounded-lg bg-zinc-800/20 border border-zinc-800 flex gap-4'>
                    <Shield className='w-4 h-4 text-zinc-400 shrink-0' />
                    <div>
                      <p className='text-[10px] font-bold text-zinc-400 uppercase tracking-widest'>
                        Authentication Note
                      </p>
                      <p className='text-[11px] text-zinc-500 mt-1 leading-relaxed'>
                        Creating this remote will require an authorization step in your browser on the server side or via an interactive prompt.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className='flex flex-col gap-3 pt-4'>
                <div className="flex items-center gap-3 w-full">
                  <Button
                    variant='ghost'
                    onClick={() => setStep(2)}
                    className='text-zinc-500 hover:text-white'
                  >
                    Back
                  </Button>
                  <Button
                    disabled={!isStep3Valid || loading}
                    onClick={handleCreateRemote}
                    className='flex-1 h-10 bg-white text-black hover:bg-zinc-200 rounded-lg font-medium'
                  >
                    {loading ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      'Save Remote'
                    )}
                  </Button>
                </div>
                
                {savedRemote && (
                  <Button
                    variant="outline"
                    disabled={testing}
                    onClick={handleTestConnection}
                    className="w-full border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    {testing ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-3 h-3 mr-2" />
                    )}
                    Test Connection
                  </Button>
                )}

                {savedRemote && (
                  <Button
                    onClick={() => {
                      onSuccess();
                      onClose();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className='px-8 py-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between'>
          <span className='text-[10px] text-zinc-600 uppercase font-medium tracking-tight'>
            CloudSync V2 Dynamic Config
          </span>
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", step >= 1 ? "bg-white" : "bg-zinc-800")} />
            <div className={cn("w-1.5 h-1.5 rounded-full", step >= 2 ? "bg-white" : "bg-zinc-800")} />
            <div className={cn("w-1.5 h-1.5 rounded-full", step >= 3 ? "bg-white" : "bg-zinc-800")} />
          </div>
        </div>
      </Card>
    </div>
  );
};
