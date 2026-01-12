import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Cloud,
  Activity,
  Settings,
  Plus,
  Trash2,
  Play,
  MoreVertical,
  CheckCircle2,
  XCircle,
  HardDrive,
  RefreshCw,
  ArrowRightLeft,
  Wifi,
  Zap,
  ChevronRight,
  StopCircle,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Job } from './types';
import { cn } from './lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './components/ui/card';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { CreateJobModal } from './components/CreateJobModal';
import { RemoteConfigModal } from './components/RemoteConfigModal';

// --- Constants ---
const API_URL = '/api/v1';

// --- Interface Helpers ---
interface Remote {
  name: string;
  type: string;
}

interface Stats {
  speed: number;
  bytes: number;
  transfers: number;
  checks: number;
  activeJobs: number;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'progress';
  jobName: string;
  message: string;
  details?: any;
}

// --- Utility: Formatters ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSec: number) => {
  return formatBytes(bytesPerSec) + '/s';
};

// --- Sub-Components ---

const Sidebar = ({
  currentView,
  onViewChange,
  stats,
}: {
  currentView: string;
  onViewChange: (v: string) => void;
  stats: Stats;
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'remotes', label: 'Remotes', icon: Cloud },
    { id: 'jobs', label: 'Sync Jobs', icon: ArrowRightLeft },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className='w-64 flex-shrink-0 bg-slate-900/50 backdrop-blur-xl border-r border-slate-800 flex flex-col h-full z-10 transition-all duration-500'>
      <div className='h-20 flex items-center px-6 gap-3 border-b border-slate-800/50'>
        <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20'>
          <Cloud className='w-5 h-5 text-white' />
        </div>
        <span className='font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 tracking-tight'>
          CloudSync
        </span>
      </div>

      <nav className='flex-1 p-4 space-y-1 mt-2'>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 group relative overflow-hidden',
              currentView === item.id
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.05)]'
                : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
            )}
          >
            <item.icon
              className={cn(
                'w-4 h-4 transition-transform duration-300 group-hover:scale-110',
                currentView === item.id
                  ? 'text-cyan-400'
                  : 'text-slate-600 group-hover:text-slate-400'
              )}
            />
            {item.label}
            {currentView === item.id && (
              <div className='absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-cyan-500 rounded-l-full shadow-[0_0_8px_cyan]' />
            )}
          </button>
        ))}
      </nav>

      <div className='p-4 border-t border-slate-800/50'>
        <div className='bg-slate-950/40 rounded-2xl p-4 border border-slate-800/50 relative overflow-hidden group'>
          <div className='absolute top-0 right-0 w-16 h-16 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors' />
          <div className='flex items-center justify-between mb-3'>
            <span className='text-[10px] font-bold text-slate-500 uppercase tracking-widest'>
              Aggregate Speed
            </span>
            <Activity className='w-3 h-3 text-cyan-500 animate-pulse' />
          </div>
          <div className='text-xl font-bold text-slate-100 font-mono tracking-tighter'>
            {formatSpeed(stats.speed)}
          </div>
          <div className='flex items-center gap-1.5 mt-2'>
            <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_emerald]' />
            <span className='text-[10px] text-slate-500 font-bold uppercase'>
              {stats.activeJobs} Active Missions
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

// --- Dashboard View ---
const DashboardView = ({
  stats,
  jobs,
  logs,
  onNavigate,
  onNewJob,
}: {
  stats: Stats;
  jobs: Job[];
  logs: ActivityLog[];
  onNavigate: (v: string) => void;
  onNewJob: () => void;
}) => {
  const cards = [
    {
      label: 'Cloud Throughput',
      value: formatSpeed(stats.speed),
      trend: stats.speed > 0 ? 'Streaming' : 'Stationary',
      icon: Zap,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      glow: 'shadow-cyan-500/5',
    },
    {
      label: 'Exfiltrated Data',
      value: formatBytes(stats.bytes),
      trend: `${stats.transfers} Items`,
      icon: HardDrive,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      glow: 'shadow-blue-500/5',
    },
    {
      label: 'Cluster Load',
      value: stats.activeJobs.toString(),
      trend: 'Containers',
      icon: Activity,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      glow: 'shadow-indigo-500/5',
    },
    {
      label: 'System Integrity',
      value: '100%',
      trend: 'Nominal',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      glow: 'shadow-emerald-500/5',
    },
  ];

  return (
    <div className='space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700'>
      <div className='flex items-end justify-between'>
        <div className='space-y-1'>
          <h2 className='text-4xl font-extrabold tracking-tighter text-white'>
            Central Intelligence
          </h2>
          <p className='text-slate-500 text-sm font-medium'>
            Monitoring distributed sync protocols across the cluster
          </p>
        </div>
        <Button
          onClick={onNewJob}
          className='h-12 px-8 bg-cyan-600 hover:bg-cyan-500 text-white border-0 shadow-2xl shadow-cyan-500/20 rounded-xl font-bold active:scale-95 transition-all'
        >
          <Plus className='w-5 h-5 mr-2 stroke-[3px]' />
          New Mission
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {cards.map((card, i) => (
          <Card
            key={i}
            className={cn(
              'bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md hover:border-slate-700 transition-all group overflow-hidden',
              card.glow
            )}
          >
            <CardContent className='p-8 relative'>
              <div className='absolute -top-10 -right-10 w-32 h-32 bg-slate-800/10 rounded-full blur-3xl group-hover:bg-slate-800/20 transition-all' />
              <div className='flex items-center justify-between mb-6'>
                <div className={cn('p-3 rounded-2xl shadow-inner', card.bg)}>
                  <card.icon className={cn('w-6 h-6', card.color)} />
                </div>
                <div className='text-[10px] uppercase font-black tracking-[0.2em] text-slate-600'>
                  {card.trend}
                </div>
              </div>
              <div className='space-y-1.5 relative z-10'>
                <h3 className='text-3xl font-black text-slate-100 font-mono tracking-tighter leading-none'>
                  {card.value}
                </h3>
                <p className='text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em]'>
                  {card.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        <Card className='lg:col-span-2 bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md overflow-hidden'>
          <CardHeader className='flex flex-row items-center justify-between border-b border-slate-800/30 pb-6'>
            <div>
              <CardTitle className='text-xl font-bold text-slate-100 tracking-tight'>
                Mission Telemetry
              </CardTitle>
              <CardDescription className='text-slate-500 font-medium'>
                Real-time exfiltration events
              </CardDescription>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onNavigate('activity')}
              className='text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 font-bold px-4'
            >
              DECRYPT ALL
            </Button>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='divide-y divide-slate-800/30'>
              {logs
                .slice(0, 6)
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className='flex items-center gap-6 px-8 py-5 hover:bg-slate-800/20 transition-all group cursor-default'
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-transparent transition-all',
                        log.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-500 group-hover:border-emerald-500/20 shadow-emerald-500/5'
                          : log.type === 'error'
                            ? 'bg-red-500/10 text-red-500 group-hover:border-red-500/20 shadow-red-500/5'
                            : 'bg-cyan-500/10 text-cyan-500 group-hover:border-cyan-500/20 shadow-cyan-500/5'
                      )}
                    >
                      {log.type === 'success' ? (
                        <CheckCircle2 className='w-5 h-5' />
                      ) : log.type === 'error' ? (
                        <XCircle className='w-5 h-5 text-red-500' />
                      ) : (
                        <Activity className='w-5 h-5 group-hover:animate-pulse' />
                      )}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between mb-0.5'>
                        <p className='text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors'>
                          {log.message}
                        </p>
                        <span className='text-[10px] text-slate-600 font-black font-mono uppercase tracking-tighter'>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className='text-[10px] text-slate-500 uppercase tracking-widest font-bold group-hover:text-slate-400'>
                        {log.jobName}
                      </p>
                    </div>
                  </div>
                ))}
              {logs.length === 0 && (
                <div className='text-center py-20 text-slate-600 font-bold uppercase tracking-widest text-xs opacity-50'>
                  Signal Jammed: No logs available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className='space-y-8'>
          <Card className='bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md'>
            <CardHeader className='pb-4'>
              <CardTitle className='text-lg font-bold text-slate-100 flex items-center gap-2'>
                <ArrowRightLeft className='w-5 h-5 text-cyan-500' />
                Quick Connect
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <Button
                onClick={() => onNavigate('remotes')}
                variant='outline'
                className='w-full h-14 justify-start border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-400 px-6 rounded-2xl group transition-all'
              >
                <div className='w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center mr-4 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors'>
                  <Plus className='w-4 h-4' />
                </div>
                <span className='font-bold text-sm tracking-tight'>
                  Add Remote Target
                </span>
              </Button>
              <div className='p-4 rounded-2xl bg-slate-950/50 border border-slate-800/50'>
                <div className='flex items-center justify-between mb-4'>
                  <span className='text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]'>
                    Node Status
                  </span>
                  <div className='px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-tighter border border-emerald-500/20'>
                    Active
                  </div>
                </div>
                <div className='space-y-3'>
                  <div className='flex items-center justify-between text-xs'>
                    <span className='text-slate-500'>Storage Cluster</span>
                    <span className='text-slate-200 font-mono'>12.4 TB</span>
                  </div>
                  <Progress
                    value={45}
                    className='h-1 bg-slate-800 [&>div]:bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Jobs View ---
const JobsView = ({
  jobs,
  onRun,
  onStop,
  onDelete,
  onNewJob,
}: {
  jobs: Job[];
  onRun: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onNewJob: () => void;
}) => {
  return (
    <div className='space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700'>
      <div className='flex items-end justify-between'>
        <div>
          <h2 className='text-4xl font-extrabold tracking-tighter text-white'>
            Active Missions
          </h2>
          <p className='text-slate-500 text-sm font-medium'>
            Parallel synchronization threads across global remotes
          </p>
        </div>
        <Button
          onClick={onNewJob}
          className='h-12 px-8 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-2xl shadow-cyan-500/20'
        >
          <Plus className='w-5 h-5 mr-2 stroke-[3px]' />
          Deploy Sync
        </Button>
      </div>

      <Card className='bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md overflow-hidden rounded-3xl'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left'>
            <thead>
              <tr className='border-b border-slate-800/50 bg-slate-950/40'>
                <th className='p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]'>
                  Deployment
                </th>
                <th className='p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]'>
                  Vector Map
                </th>
                <th className='p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]'>
                  Telemetry
                </th>
                <th className='p-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right'>
                  Control
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-800/30'>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className='group hover:bg-slate-800/20 transition-all duration-300 cursor-default'
                >
                  <td className='p-6'>
                    <div className='flex items-center gap-4'>
                      <div
                        className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500',
                          job.status === 'running'
                            ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)] border border-cyan-500/20'
                            : 'bg-slate-800/50 text-slate-500 border border-slate-800'
                        )}
                      >
                        <ArrowRightLeft
                          className={cn(
                            'w-6 h-6',
                            job.status === 'running' && 'animate-pulse'
                          )}
                        />
                      </div>
                      <div>
                        <p className='text-base font-black text-slate-100 group-hover:text-cyan-400 transition-colors uppercase tracking-tight'>
                          {job.name}
                        </p>
                        <div className='flex items-center gap-1.5 mt-1'>
                          <RefreshCw className='w-3 h-3 text-slate-600' />
                          <p className='text-[10px] text-slate-600 font-black uppercase tracking-tighter'>
                            Pulse: {job.intervalMinutes}M
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className='p-6'>
                    <div className='space-y-2'>
                      <div className='flex items-center gap-3 text-[11px] font-mono group/path'>
                        <div className='w-1.5 h-1.5 rounded-full bg-cyan-700 shrink-0' />
                        <span className='text-slate-400 group-hover/path:text-cyan-400 transition-colors truncate max-w-[200px]'>
                          {job.source}
                        </span>
                      </div>
                      <div className='flex items-center gap-3 text-[11px] font-mono group/path'>
                        <div className='w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0' />
                        <span className='text-slate-400 group-hover/path:text-blue-400 transition-colors truncate max-w-[200px]'>
                          {job.destination}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className='p-6'>
                    {job.status === 'running' ? (
                      <div className='space-y-3 w-40 animate-pulse'>
                        <div className='flex items-center justify-between'>
                          <span className='text-[10px] font-black text-cyan-400 uppercase tracking-widest'>
                            Encrypting
                          </span>
                          <span className='text-xs font-black text-cyan-400 font-mono'>
                            {(job as any).progress || 0}%
                          </span>
                        </div>
                        <Progress
                          value={(job as any).progress || 0}
                          className='h-1.5 bg-slate-800/50 [&>div]:bg-gradient-to-r from-cyan-500 to-blue-500'
                        />
                        <p className='text-[9px] text-slate-600 font-bold uppercase tracking-tighter'>
                          {formatSpeed((job as any).speed || 0)}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm',
                          job.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : job.status === 'error'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20 font-mono'
                              : 'bg-slate-800/50 text-slate-500 border-slate-700'
                        )}
                      >
                        <div
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            job.status === 'success'
                              ? 'bg-emerald-500'
                              : job.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-slate-600'
                          )}
                        />
                        {job.status}
                      </div>
                    )}
                  </td>
                  <td className='p-6 text-right'>
                    <div className='flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0'>
                      {job.status === 'running' ? (
                        <Button
                          onClick={() => onStop(job.id)}
                          variant='ghost'
                          size='icon'
                          className='h-10 w-10 text-yellow-500 hover:bg-yellow-500/10 hover:shadow-inner rounded-xl'
                        >
                          <StopCircle className='w-5 h-5' />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => onRun(job.id)}
                          variant='ghost'
                          size='icon'
                          className='h-10 w-10 text-cyan-400 hover:bg-cyan-400/10 hover:shadow-inner rounded-xl'
                        >
                          <Play className='w-5 h-5 stroke-[2.5px]' />
                        </Button>
                      )}
                      <Button
                        onClick={() => onDelete(job.id)}
                        variant='ghost'
                        size='icon'
                        className='h-10 w-10 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl'
                      >
                        <Trash2 className='w-5 h-5' />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// --- Remotes View ---
const RemotesView = ({
  remotes,
  onNewRemote,
}: {
  remotes: Remote[];
  onNewRemote: () => void;
}) => {
  return (
    <div className='space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700'>
      <div className='flex items-end justify-between'>
        <div>
          <h2 className='text-4xl font-extrabold tracking-tighter text-white'>
            Global Gateways
          </h2>
          <p className='text-slate-500 text-sm font-medium'>
            Encrypted tunnels to distributed storage sectors
          </p>
        </div>
        <Button
          onClick={onNewRemote}
          className='h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-2xl shadow-blue-500/20'
        >
          <Plus className='w-5 h-5 mr-2 stroke-[3px]' />
          Add Gateway
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
        {remotes.map((remote) => (
          <Card
            key={remote.name}
            className='group relative bg-slate-900/40 border-slate-800/50 hover:border-cyan-500/30 hover:bg-slate-900/60 transition-all duration-500 overflow-hidden shadow-2xl rounded-[2rem]'
          >
            <div className='absolute top-0 right-0 p-8'>
              <Button
                variant='ghost'
                size='icon'
                className='h-10 w-10 text-slate-700 hover:text-slate-300'
              >
                <MoreVertical className='w-5 h-5' />
              </Button>
            </div>
            <CardContent className='p-10 space-y-8'>
              <div className='flex items-start'>
                <div className='w-20 h-20 bg-slate-950 rounded-[2.5rem] flex items-center justify-center border border-slate-800 shadow-inner group-hover:border-cyan-500/20 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.05)] transition-all duration-500'>
                  <Cloud className='w-10 h-10 text-cyan-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500' />
                </div>
              </div>
              <div>
                <h3 className='font-black text-2xl text-slate-100 uppercase tracking-tighter group-hover:text-cyan-400 transition-colors'>
                  {remote.name}
                </h3>
                <div className='flex items-center gap-2 mt-2'>
                  <div className='px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800'>
                    <p className='text-[10px] text-slate-500 uppercase tracking-widest font-black font-mono'>
                      {remote.type}
                    </p>
                  </div>
                  <div className='w-1 h-1 rounded-full bg-slate-800' />
                  <p className='text-[10px] text-slate-600 font-bold uppercase tracking-widest'>
                    Protocol V4
                  </p>
                </div>
              </div>
              <div className='pt-8 border-t border-slate-800/50 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_emerald] group-hover:animate-ping' />
                  <span className='text-[11px] font-black text-slate-200 uppercase tracking-widest'>
                    Encrypted
                  </span>
                </div>
                <span className='text-[10px] text-slate-700 font-mono font-bold tracking-tight opacity-50 select-all group-hover:opacity-100 transition-opacity'>
                  RC://{remote.name.toUpperCase()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {remotes.length === 0 && (
          <div className='col-span-full py-32 text-center rounded-[3rem] border-4 border-dashed border-slate-900 flex flex-col items-center justify-center animate-pulse'>
            <Cloud className='w-20 h-20 text-slate-800 mb-6' />
            <h4 className='text-xl font-black text-slate-800 uppercase tracking-widest'>
              No Active Gateways
            </h4>
            <p className='text-sm text-slate-600 mt-2 font-bold max-w-xs'>
              Manual terminal configuration required for initial neural
              handshake.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Activity View ---
const ActivityView = ({
  logs,
  onClear,
}: {
  logs: ActivityLog[];
  onClear: () => void;
}) => {
  return (
    <div className='space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700'>
      <div className='flex items-end justify-between'>
        <div>
          <h2 className='text-4xl font-extrabold tracking-tighter text-white'>
            System Logs
          </h2>
          <p className='text-slate-500 text-sm font-medium'>
            Real-time kernel audit trails
          </p>
        </div>
        <Button
          onClick={onClear}
          variant='outline'
          className='h-12 px-8 border-slate-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-slate-400 rounded-xl font-bold transition-all'
        >
          <Trash2 className='w-5 h-5 mr-2' />
          Purge Logs
        </Button>
      </div>

      <Card className='bg-slate-900/40 border-slate-800/50 shadow-2xl backdrop-blur-md overflow-hidden rounded-[2rem]'>
        <CardContent className='p-0'>
          <div className='max-h-[600px] overflow-y-auto'>
            <div className='divide-y divide-slate-800/30'>
              {logs
                .slice()
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className='flex items-start gap-4 px-8 py-4 hover:bg-slate-800/20 transition-all font-mono text-xs'
                  >
                    <span className='text-slate-600 shrink-0 mt-0.5'>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <div
                      className={cn(
                        'px-2 py-0.5 rounded-md text-[10px] uppercase font-bold shrink-0 mt-0.5',
                        log.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : log.type === 'error'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-cyan-500/10 text-cyan-500'
                      )}
                    >
                      {log.type}
                    </div>
                    <span className='text-slate-300 break-all leading-relaxed'>
                      {log.message}
                    </span>
                  </div>
                ))}
              {logs.length === 0 && (
                <div className='py-20 text-center text-slate-600 uppercase font-black tracking-widest text-sm'>
                  System Silent
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Master Application Engine ---

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [init] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showRemoteConfig, setShowRemoteConfig] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [stats, setStats] = useState<Stats>({
    speed: 0,
    bytes: 0,
    transfers: 0,
    checks: 0,
    activeJobs: 0,
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  const socketRef = useRef<Socket | null>(null);

  const fetchData = async () => {
    try {
      const [jobsRes, remotesRes, logsRes] = await Promise.all([
        axios.get(`${API_URL}/jobs`),
        axios.get(`${API_URL}/remotes`),
        axios.get(`${API_URL}/activity/history`),
      ]);
      setJobs(jobsRes.data.data || []);
      setRemotes(remotesRes.data.data || []);
      setLogs(logsRes.data.data || []);
      setStatus('online');
    } catch (e) {
      setStatus('offline');
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => setStatus('online'));
    socket.on('disconnect', () => setStatus('offline'));

    socket.on('jobs:update', (updatedJobs: Job[]) => setJobs(updatedJobs));
    socket.on('stats:update', (updatedStats: Stats) => setStats(updatedStats));
    socket.on('activity:log', (entry: ActivityLog) => {
      setLogs((prev) => [...prev.slice(-100), entry]);
    });
    socket.on('activity:history', (history: ActivityLog[]) => setLogs(history));
    socket.on('activity:cleared', () => setLogs([]));

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleRunJob = async (id: string) => {
    try {
      await axios.post(`${API_URL}/jobs/${id}/start`);
    } catch (e) {}
  };
  const handleStopJob = async (id: string) => {
    try {
      await axios.post(`${API_URL}/jobs/${id}/stop`);
    } catch (e) {}
  };
  const handleDeleteJob = async (id: string) => {
    if (!confirm('Abort mission? Data already synced persists.')) return;
    try {
      await axios.delete(`${API_URL}/jobs/${id}`);
    } catch (e) {}
  };
  const handleClearLogs = async () => {
    try {
      await axios.delete(`${API_URL}/activity`);
    } catch (e) {}
  };

  return (
    <div
      className={cn(
        'flex h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30 transition-opacity duration-1000 antialiased',
        init ? 'opacity-100' : 'opacity-0'
      )}
    >
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        stats={stats}
      />

      <main className='flex-1 overflow-auto bg-slate-950 relative selection:bg-cyan-500/20'>
        {status === 'offline' && (
          <div className='absolute top-4 right-8 z-50 animate-bounce'>
            <div className='flex items-center gap-2 bg-red-950/90 border border-red-500/50 px-6 py-3 rounded-2xl text-red-500 text-xs font-black shadow-2xl'>
              <Zap className='w-3 h-3 fill-red-500 animate-pulse' />
              LINK SEVERED • EMERGENCY OFFLINE MODE
            </div>
          </div>
        )}

        <div className='container mx-auto max-w-7xl px-12 py-16 pb-32'>
          {currentView === 'dashboard' && (
            <DashboardView
              stats={stats}
              jobs={jobs}
              logs={logs}
              onNavigate={setCurrentView}
              onNewJob={() => setShowCreateJob(true)}
            />
          )}
          {currentView === 'remotes' && (
            <RemotesView
              remotes={remotes}
              onNewRemote={() => setShowRemoteConfig(true)}
            />
          )}
          {currentView === 'jobs' && (
            <JobsView
              jobs={jobs}
              onRun={handleRunJob}
              onStop={handleStopJob}
              onDelete={handleDeleteJob}
              onNewJob={() => setShowCreateJob(true)}
            />
          )}
          {currentView === 'activity' && (
            <ActivityView logs={logs} onClear={handleClearLogs} />
          )}
          {currentView === 'settings' && (
            <div className='p-32 text-center text-slate-800 text-2xl font-black uppercase tracking-[0.4em] opacity-20'>
              Settings Module Blocked
            </div>
          )}
        </div>

        {/* Global Floating Aesthetics */}
        <div className='fixed -bottom-64 -right-64 w-[40rem] h-[40rem] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none animate-pulse' />
        <div className='fixed -top-64 -left-64 w-[40rem] h-[40rem] bg-blue-600/5 rounded-full blur-[150px] pointer-events-none animate-pulse' />
      </main>

      {/* MODALS */}
      {showCreateJob && (
        <CreateJobModal
          onClose={() => setShowCreateJob(false)}
          onSuccess={fetchData}
        />
      )}
      {showRemoteConfig && (
        <RemoteConfigModal
          onClose={() => setShowRemoteConfig(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

export default App;
