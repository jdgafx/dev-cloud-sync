import { useState, useEffect } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Bell,
  Shield,
  Database,
  Zap,
  RefreshCw,
  Save,
  Trash2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface SettingsConfig {
  general: {
    darkMode: boolean;
    autoStart: boolean;
    minimizeToTray: boolean;
  };
  sync: {
    intervalMinutes: number;
    maxConcurrent: number;
    defaultConcurrency: number; // Added for multi-threading
    conflictResolution: 'newer' | 'larger' | 'local' | 'remote';
    deleteEmpty: boolean;
  };
  notifications: {
    enabled: boolean;
    onComplete: boolean;
    onError: boolean;
    sound: boolean;
  };
  advanced: {
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    maxRetries: number;
    timeout: number;
  };
}

const defaultSettings: SettingsConfig = {
  general: {
    darkMode: true,
    autoStart: false,
    minimizeToTray: true,
  },
  sync: {
    intervalMinutes: 5,
    maxConcurrent: 2,
    defaultConcurrency: 8,
    conflictResolution: 'newer',
    deleteEmpty: false,
  },
  notifications: {
    enabled: true,
    onComplete: true,
    onError: true,
    sound: false,
  },
  advanced: {
    logLevel: 'info',
    maxRetries: 3,
    timeout: 300,
  },
};

export function SettingsView() {
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('cloudsync-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        console.log('Failed to load settings');
      }
    }
  }, []);

  const updateSetting = <K extends keyof SettingsConfig>(
    category: K,
    key: keyof SettingsConfig[K],
    value: SettingsConfig[K][keyof SettingsConfig[K]]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setIsDirty(true);
  };

  const saveSettings = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('cloudsync-settings', JSON.stringify(settings));
      setIsDirty(false);
      setSaving(false);
      toast({
        title: 'Settings saved',
        description: 'Your preferences have been updated successfully.',
        variant: 'success',
      });
    }, 500);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('cloudsync-settings');
    setIsDirty(false);
    toast({
      title: 'Settings reset',
      description: 'All settings have been restored to defaults.',
      variant: 'default',
    });
  };

  const SettingCard = ({
    icon: Icon,
    title,
    description,
    children,
    iconColor = 'text-cyan-400',
    iconBg = 'bg-cyan-500/10',
  }: {
    icon: typeof Settings;
    title: string;
    description: string;
    children: React.ReactNode;
    iconColor?: string;
    iconBg?: string;
  }) => (
    <Card className='bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md overflow-hidden'>
      <CardHeader className='pb-4'>
        <div className='flex items-center gap-4'>
          <div className={cn('p-3 rounded-2xl', iconBg)}>
            <Icon className={cn('w-6 h-6', iconColor)} />
          </div>
          <div>
            <CardTitle className='text-lg font-bold text-slate-100'>
              {title}
            </CardTitle>
            <CardDescription className='text-slate-500 text-sm'>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>{children}</CardContent>
    </Card>
  );

  const SettingRow = ({
    label,
    description,
    children,
  }: {
    label: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <div className='flex items-center justify-between gap-4'>
      <div className='space-y-0.5'>
        <Label className='text-sm font-bold text-slate-200'>{label}</Label>
        {description && <p className='text-xs text-slate-500'>{description}</p>}
      </div>
      {children}
    </div>
  );

  return (
    <div className='space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700'>
      <div className='flex items-end justify-between'>
        <div>
          <h2 className='text-4xl font-extrabold tracking-tighter text-white'>
            System Settings
          </h2>
          <p className='text-slate-500 text-sm font-medium'>
            Configure your CloudSync preferences and behavior
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Button
            onClick={resetSettings}
            variant='outline'
            className='h-12 px-6 border-slate-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-slate-400 rounded-xl font-bold'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            Reset
          </Button>
          <Button
            onClick={saveSettings}
            disabled={!isDirty || saving}
            className={cn(
              'h-12 px-8 rounded-xl font-bold shadow-2xl transition-all',
              isDirty
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            )}
          >
            {saving ? (
              <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
            ) : (
              <Save className='w-4 h-4 mr-2' />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
        {/* General Settings */}
        <SettingCard
          icon={Settings}
          title='General'
          description='Application preferences'
          iconColor='text-cyan-400'
          iconBg='bg-cyan-500/10'
        >
          <SettingRow
            label='Dark Mode'
            description='Use dark theme throughout the app'
          >
            <Switch
              checked={settings.general.darkMode}
              onCheckedChange={(checked) =>
                updateSetting('general', 'darkMode', checked)
              }
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='Auto-start on Login'
            description='Launch CloudSync when you log in'
          >
            <Switch
              checked={settings.general.autoStart}
              onCheckedChange={(checked) =>
                updateSetting('general', 'autoStart', checked)
              }
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='Minimize to Tray'
            description='Keep running in system tray when closed'
          >
            <Switch
              checked={settings.general.minimizeToTray}
              onCheckedChange={(checked) =>
                updateSetting('general', 'minimizeToTray', checked)
              }
            />
          </SettingRow>
        </SettingCard>

        {/* Sync Settings */}
        <SettingCard
          icon={RefreshCw}
          title='Sync Engine'
          description='Synchronization behavior'
          iconColor='text-blue-400'
          iconBg='bg-blue-500/10'
        >
          <SettingRow
            label='Sync Interval'
            description='How often to check for changes'
          >
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={1}
                max={60}
                value={settings.sync.intervalMinutes}
                onChange={(e) =>
                  updateSetting(
                    'sync',
                    'intervalMinutes',
                    parseInt(e.target.value) || 5
                  )
                }
                className='w-20 text-center'
              />
              <span className='text-xs text-slate-500'>min</span>
            </div>
          </SettingRow>
          <Separator />
          <SettingRow
            label='Max Concurrent Jobs'
            description='Parallel sync operations'
          >
            <Input
              type='number'
              min={1}
              max={10}
              value={settings.sync.maxConcurrent}
              onChange={(e) =>
                updateSetting(
                  'sync',
                  'maxConcurrent',
                  parseInt(e.target.value) || 2
                )
              }
              className='w-20 text-center'
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='Default Upload Concurrency'
            description='Threads per sync job (1-1000)'
          >
            <Input
              type='number'
              min={1}
              max={1000}
              value={settings.sync.defaultConcurrency}
              onChange={(e) =>
                updateSetting(
                  'sync',
                  'defaultConcurrency',
                  parseInt(e.target.value) || 8
                )
              }
              className='w-24 text-center'
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='Delete Empty Folders'
            description='Remove empty directories after sync'
          >
            <Switch
              checked={settings.sync.deleteEmpty}
              onCheckedChange={(checked) =>
                updateSetting('sync', 'deleteEmpty', checked)
              }
            />
          </SettingRow>
        </SettingCard>

        {/* Notifications */}
        <SettingCard
          icon={Bell}
          title='Notifications'
          description='Alert preferences'
          iconColor='text-amber-400'
          iconBg='bg-amber-500/10'
        >
          <SettingRow
            label='Enable Notifications'
            description='Show system notifications'
          >
            <Switch
              checked={settings.notifications.enabled}
              onCheckedChange={(checked) =>
                updateSetting('notifications', 'enabled', checked)
              }
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='On Sync Complete'
            description='Notify when jobs finish'
          >
            <Switch
              checked={settings.notifications.onComplete}
              onCheckedChange={(checked) =>
                updateSetting('notifications', 'onComplete', checked)
              }
              disabled={!settings.notifications.enabled}
            />
          </SettingRow>
          <Separator />
          <SettingRow label='On Error' description='Notify when sync fails'>
            <Switch
              checked={settings.notifications.onError}
              onCheckedChange={(checked) =>
                updateSetting('notifications', 'onError', checked)
              }
              disabled={!settings.notifications.enabled}
            />
          </SettingRow>
          <Separator />
          <SettingRow label='Sound Effects' description='Play audio on events'>
            <Switch
              checked={settings.notifications.sound}
              onCheckedChange={(checked) =>
                updateSetting('notifications', 'sound', checked)
              }
              disabled={!settings.notifications.enabled}
            />
          </SettingRow>
        </SettingCard>

        {/* Advanced Settings */}
        <SettingCard
          icon={Zap}
          title='Advanced'
          description='Expert configuration'
          iconColor='text-purple-400'
          iconBg='bg-purple-500/10'
        >
          <SettingRow label='Log Level' description='Verbosity of logging'>
            <select
              value={settings.advanced.logLevel}
              onChange={(e) =>
                updateSetting(
                  'advanced',
                  'logLevel',
                  e.target.value as 'debug' | 'info' | 'warn' | 'error'
                )
              }
              className='h-10 px-4 rounded-xl border border-slate-800 bg-slate-950/50 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50'
            >
              <option value='debug'>Debug</option>
              <option value='info'>Info</option>
              <option value='warn'>Warning</option>
              <option value='error'>Error</option>
            </select>
          </SettingRow>
          <Separator />
          <SettingRow
            label='Max Retries'
            description='Retry attempts on failure'
          >
            <Input
              type='number'
              min={0}
              max={10}
              value={settings.advanced.maxRetries}
              onChange={(e) =>
                updateSetting(
                  'advanced',
                  'maxRetries',
                  parseInt(e.target.value) || 3
                )
              }
              className='w-20 text-center'
            />
          </SettingRow>
          <Separator />
          <SettingRow
            label='Timeout'
            description='Operation timeout in seconds'
          >
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={30}
                max={3600}
                value={settings.advanced.timeout}
                onChange={(e) =>
                  updateSetting(
                    'advanced',
                    'timeout',
                    parseInt(e.target.value) || 300
                  )
                }
                className='w-24 text-center'
              />
              <span className='text-xs text-slate-500'>sec</span>
            </div>
          </SettingRow>
        </SettingCard>
      </div>

      {/* Info Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <Card className='bg-slate-900/40 border-slate-800/50 hover:border-cyan-500/30 transition-all group'>
          <CardContent className='p-6 flex items-center gap-4'>
            <div className='p-3 rounded-2xl bg-slate-800/50 group-hover:bg-cyan-500/10 transition-all'>
              <Database className='w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition-all' />
            </div>
            <div>
              <p className='text-sm font-bold text-slate-200'>Storage Used</p>
              <p className='text-xs text-slate-500'>12.4 GB of 100 GB</p>
            </div>
          </CardContent>
        </Card>

        <Card className='bg-slate-900/40 border-slate-800/50 hover:border-emerald-500/30 transition-all group'>
          <CardContent className='p-6 flex items-center gap-4'>
            <div className='p-3 rounded-2xl bg-slate-800/50 group-hover:bg-emerald-500/10 transition-all'>
              <Shield className='w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-all' />
            </div>
            <div>
              <p className='text-sm font-bold text-slate-200'>Security</p>
              <p className='text-xs text-slate-500'>AES-256 Encrypted</p>
            </div>
          </CardContent>
        </Card>

        <Card className='bg-slate-900/40 border-slate-800/50 hover:border-blue-500/30 transition-all group cursor-pointer'>
          <CardContent className='p-6 flex items-center gap-4'>
            <div className='p-3 rounded-2xl bg-slate-800/50 group-hover:bg-blue-500/10 transition-all'>
              <ExternalLink className='w-6 h-6 text-slate-500 group-hover:text-blue-400 transition-all' />
            </div>
            <div>
              <p className='text-sm font-bold text-slate-200'>Documentation</p>
              <p className='text-xs text-slate-500'>View setup guides</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version Info */}
      <div className='text-center pt-8'>
        <p className='text-xs text-slate-600 font-mono'>
          CloudSync v0.1.0 • Built with ❤️ using Rclone
        </p>
      </div>
    </div>
  );
}
