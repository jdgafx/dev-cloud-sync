import { useState, useEffect, useRef, useCallback } from 'react';
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
  Zap,
  StopCircle,
  Bell,
  Search,
  ChevronDown,
  Menu,
  X,
  Download,
  Upload,
  Server,
  Globe,
  Cpu,
  Wifi,
  WifiOff,
  Users,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Keyboard,
  Palette,
  HelpCircle,
  LogOut,
  User,
  FolderSync,
  History,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
  FileText,
  Folder,
  Home,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Job } from './types';
import { cn } from './lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from './components/ui/card';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { Switch } from './components/ui/switch';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Separator } from './components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { CreateJobModal } from './components/CreateJobModal';
import { RemoteConfigModal } from './components/RemoteConfigModal';
import { FileBrowser } from './components/FileBrowser';
import { SettingsView } from './components/SettingsView';
import { Toaster } from './components/ui/toaster';
import { toast } from './hooks/use-toast';

// --- Configuration ---
const API_URL = '/api/v1';

// --- Types ---
interface Remote {
  name: string;
  type: string;
  path?: string;
  connected?: boolean;
}

interface Stats {
  speed: number;
  bytes: number;
  transfers: number;
  checks: number;
  activeJobs: number;
  totalRemotes: number;
  uptime: number;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'progress';
  jobName: string;
  message: string;
  details?: any;
}

interface ChartDataPoint {
  time: string;
  speed: number;
  transfers: number;
}

// --- Utility Functions ---
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSec: number) => formatBytes(bytesPerSec) + '/s';

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

// --- Main Application ---
function App() {
  // State
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showRemoteConfig, setShowRemoteConfig] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [fileBrowserType, setFileBrowserType] = useState<
    'source' | 'destination'
  >('source');
  const [isLoading, setIsLoading] = useState(true);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [stats, setStats] = useState<Stats>({
    speed: 0,
    bytes: 0,
    transfers: 0,
    checks: 0,
    activeJobs: 0,
    totalRemotes: 0,
    uptime: 0,
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [status, setStatus] = useState<'online' | 'offline'>('offline');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const socketRef = useRef<Socket | null>(null);

  const [missingRemotes, setMissingRemotes] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  const testRemote = async (name: string) => {
    try {
      const remote = name.endsWith(':') ? name : `${name}:`;
      const t = toast({
        title: 'Testing remote',
        description: `Checking ${name}...`,
      });
      const res = await axios.post(`${API_URL}/remotes/test`, { remote });
      t.dismiss();
      if (res.data?.data?.success || res.data?.success) {
        toast({
          title: 'Remote OK',
          description: `${name} is reachable.`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Remote test failed',
          description: `${name} cannot be reached: ${res.data?.data?.message || res.data?.message || 'Unknown'}`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Remote test error',
        description: err?.message || 'Connection failed',
        variant: 'destructive',
      });
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [jobsRes, remotesRes, logsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/jobs`),
        axios.get(`${API_URL}/remotes`),
        axios.get(`${API_URL}/activity/history`),
        axios.get(`${API_URL}/stats`),
      ]);

      const jobsData = jobsRes.data.data || [];
      const remotesData = remotesRes.data.data || [];

      setJobs(jobsData);
      setRemotes(remotesData);
      setLogs(logsRes.data.data || []);
      setStats((prev) => ({ ...prev, ...statsRes.data.data }));
      setStatus('online');

      const configured = new Set(remotesData.map((r: any) => r.name));
      const referenced = new Set<string>();
      for (const j of jobsData) {
        if (typeof j.destination === 'string' && j.destination.includes(':')) {
          const rn = j.destination.split(':')[0];
          if (rn) referenced.add(rn);
        }
      }
      const missing = Array.from(referenced).filter((r) => !configured.has(r));
      setMissingRemotes(missing);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setStatus('offline');
      setApiError(error?.message || 'API unreachable');
      setMissingRemotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- Socket Connection ---
  useEffect(() => {
    fetchData();

    const socket = io({ timeout: 5000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      fetchData();

      setStatus('online');
      const existing = remotes.length === 0 ? 'no-remotes' : 'connected';
      toast({
        title:
          existing === 'connected'
            ? 'Connected'
            : 'Connected (no remotes configured)',
        description:
          existing === 'connected'
            ? 'Real-time sync is active'
            : 'Connected to server. No remotes configured',
        variant: 'success',
      });
    });

    socket.on('disconnect', () => {
      setStatus('offline');
    });

    socket.on('jobs:update', (updatedJobs: Job[]) => setJobs(updatedJobs));
    socket.on('stats:update', (updatedStats: Stats) => {
      setStats(updatedStats);
      setChartData((prev) => {
        const newData = [
          ...prev,
          {
            time: new Date().toLocaleTimeString(),
            speed: updatedStats.speed,
            transfers: updatedStats.transfers,
          },
        ];
        return newData.slice(-20);
      });
    });
    socket.on('activity:log', (entry: ActivityLog) => {
      setLogs((prev) => [...prev.slice(-100), entry]);
    });
    socket.on('activity:history', (history: ActivityLog[]) => setLogs(history));
    socket.on('activity:cleared', () => setLogs([]));

    return () => {
      socket.disconnect();
    };
  }, [fetchData]);

  // --- Handlers ---
  const handleRunJob = async (id: string) => {
    try {
      await axios.post(`${API_URL}/jobs/${id}/start`);
      toast({
        title: 'Sync Started',
        description: 'Job is now running',
        variant: 'success',
      });
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.message ||
        'Failed to start job';
      toast({
        title: 'Cannot Start Job',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };

  const handleStopJob = async (id: string) => {
    try {
      await axios.post(`${API_URL}/jobs/${id}/stop`);
      toast({ title: 'Sync Stopped', description: 'Job has been paused' });
    } catch {
      toast({ title: 'Failed to stop job', variant: 'destructive' });
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (
      !confirm(
        'Delete this sync job? Previously synced data will be preserved.'
      )
    )
      return;
    try {
      await axios.delete(`${API_URL}/jobs/${id}`);
      toast({ title: 'Job Deleted', description: 'Sync job has been removed' });
    } catch {
      toast({ title: 'Failed to delete job', variant: 'destructive' });
    }
  };

  const handleClearLogs = async () => {
    try {
      await axios.delete(`${API_URL}/activity`);
      toast({
        title: 'Logs Cleared',
        description: 'Activity history has been purged',
      });
    } catch {
      toast({ title: 'Failed to clear logs', variant: 'destructive' });
    }
  };

  const handleDeleteRemote = async (name: string) => {
    if (!confirm(`Remove remote "${name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/remotes/${name}`);
      toast({
        title: 'Remote Removed',
        description: `${name} has been disconnected`,
      });
      fetchData();
    } catch {
      toast({ title: 'Failed to remove remote', variant: 'destructive' });
    }
  };

  const openFileBrowser = (type: 'source' | 'destination') => {
    setFileBrowserType(type);
    setShowFileBrowser(true);
  };

  // --- Navigation Items ---
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'remotes',
      label: 'Cloud Storage',
      icon: Cloud,
      badge: stats.totalRemotes,
    },
    { id: 'jobs', label: 'Sync Jobs', icon: FolderSync, badge: jobs.length },
    {
      id: 'activity',
      label: 'Activity Log',
      icon: History,
      badge: logs.length,
    },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
    {
      id: 'explorer',
      label: 'File Explorer',
      icon: HardDrive,
      external: 'http://localhost:5572',
    },
  ];

  return (
    <div className='flex h-screen bg-background text-foreground overflow-hidden'>
      {/* Loading Overlay */}
      {isLoading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-background'>
          <div className='flex flex-col items-center gap-4'>
            <div className='relative'>
              <div className='w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin' />
              <div className='absolute inset-0 flex items-center justify-center'>
                <Cloud className='w-6 h-6 text-primary' />
              </div>
            </div>
            <p className='text-muted-foreground animate-pulse'>
              Loading CloudSync...
            </p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:relative z-40 flex flex-col bg-card/50 backdrop-blur-xl border-r border-border transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20',
          mobileMenuOpen
            ? 'translate-x-0'
            : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className='h-16 flex items-center px-4 lg:px-6 gap-3 border-b border-border/50'>
          <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0'>
            <Cloud className='w-5 h-5 text-white' />
          </div>
          {sidebarOpen && (
            <span className='font-bold text-lg text-white truncate'>
              CloudSync
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className='flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto'>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.external) {
                  window.open(item.external, '_blank');
                } else {
                  setCurrentView(item.id);
                  setMobileMenuOpen(false);
                }
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative',
                currentView === item.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon
                className={cn(
                  'w-5 h-5 shrink-0',
                  currentView === item.id && 'text-primary'
                )}
              />
              {sidebarOpen && (
                <>
                  <span className='flex-1 text-left'>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className='px-2 py-0.5 text-xs font-semibold bg-primary/20 text-primary rounded-full'>
                      {item.badge}
                    </span>
                  )}
                  {currentView === item.id && (
                    <div className='absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_primary]' />
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Status Card */}
        {sidebarOpen && (
          <div className='p-4 border-t border-border/50'>
            <div className='p-4 rounded-xl bg-muted/30 border border-border/50'>
              <div className='flex items-center justify-between mb-3'>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  Status
                </span>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    status === 'online'
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-red-500'
                  )}
                />
              </div>
              <div className='text-lg font-bold text-foreground font-mono'>
                {formatSpeed(stats.speed)}
              </div>
              <div className='flex items-center gap-2 mt-2'>
                <span className='text-xs text-muted-foreground'>
                  {stats.activeJobs} active jobs
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collapse Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='hidden lg:flex items-center justify-center p-4 border-t border-border/50 text-muted-foreground hover:text-foreground transition-colors'
        >
          <ChevronDown
            className={cn(
              'w-5 h-5 transition-transform',
              !sidebarOpen && '-rotate-90'
            )}
          />
        </button>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className='fixed inset-0 bg-black/60 z-30 lg:hidden'
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className='flex-1 flex flex-col overflow-hidden'>
        {/* Header */}
        <header className='h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border/50 bg-card/30 backdrop-blur-xl shrink-0'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className='lg:hidden p-2 rounded-lg hover:bg-muted transition-colors'
            >
              <Menu className='w-5 h-5' />
            </button>
            <h1 className='text-xl font-bold text-foreground hidden sm:block'>
              {navItems.find((n) => n.id === currentView)?.label || 'Dashboard'}
            </h1>
          </div>

          <div className='flex items-center gap-3'>
            {/* Search */}
            <div className='hidden md:flex items-center relative'>
              <Search className='w-4 h-4 absolute left-3 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search...'
                className='w-64 pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all'
              />
            </div>

            {/* Status Indicator */}
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
                status === 'online'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}
            >
              {status === 'online' ? (
                <Wifi className='w-3 h-3' />
              ) : (
                <WifiOff className='w-3 h-3' />
              )}
              <span className='hidden sm:inline'>
                {status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Notifications */}
            <button className='relative p-2 rounded-xl hover:bg-muted transition-colors'>
              <Bell className='w-5 h-5 text-muted-foreground' />
              {logs.filter((l) => l.type === 'error').length > 0 && (
                <span className='absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full' />
              )}
            </button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className='w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25'>
                  <User className='w-4 h-4 text-white' />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-56'>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className='w-4 h-4 mr-2' /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className='w-4 h-4 mr-2' /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className='text-red-500'>
                  <LogOut className='w-4 h-4 mr-2' /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content Area */}
        <div className='flex-1 overflow-y-auto p-4 lg:p-6'>
          <div className='container mx-auto max-w-7xl pb-16'>
            {currentView === 'dashboard' && (
              <DashboardView
                stats={stats}
                jobs={jobs}
                logs={logs}
                chartData={chartData}
                onNavigate={setCurrentView}
                onNewJob={() => setShowCreateJob(true)}
                onNewRemote={() => setShowRemoteConfig(true)}
              />
            )}
            {currentView === 'remotes' && (
              <RemotesView
                remotes={remotes}
                onNewRemote={() => setShowRemoteConfig(true)}
                onDeleteRemote={handleDeleteRemote}
                onOpenRemote={(name) => {
                  setCurrentView('explorer');
                  window.open(`http://localhost:5572/${name}`, '_blank');
                }}
              />
            )}
            {currentView === 'jobs' && (
              <JobsView
                jobs={jobs}
                onRun={handleRunJob}
                onStop={handleStopJob}
                onDelete={handleDeleteJob}
                onNewJob={() => setShowCreateJob(true)}
                onOpenBrowser={openFileBrowser}
              />
            )}
            {currentView === 'activity' && (
              <ActivityView logs={logs} onClear={handleClearLogs} />
            )}
            {currentView === 'analytics' && (
              <AnalyticsView stats={stats} chartData={chartData} logs={logs} />
            )}
            {currentView === 'settings' && <SettingsView />}
          </div>

          <div className='fixed bottom-4 right-6 text-xs text-slate-500 font-medium'>
            CGDarkstardev1 / NewDawnAI
          </div>
        </div>
      </main>

      {/* Modals */}
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
      {showFileBrowser && (
        <FileBrowser
          title={
            fileBrowserType === 'source'
              ? 'Select Source Path'
              : 'Select Destination Path'
          }
          onSelect={(path) => {
            // Handle path selection
            setShowFileBrowser(false);
          }}
          onClose={() => setShowFileBrowser(false)}
        />
      )}
      <Toaster />
    </div>
  );
}

// --- Dashboard View Component ---
function DashboardView({
  stats,
  jobs,
  logs,
  chartData,
  onNavigate,
  onNewJob,
  onNewRemote,
}: {
  stats: Stats;
  jobs: Job[];
  logs: ActivityLog[];
  chartData: ChartDataPoint[];
  onNavigate: (v: string) => void;
  onNewJob: () => void;
  onNewRemote: () => void;
}) {
  const statsCards = [
    {
      label: 'Transfer Speed',
      value: formatSpeed(stats.speed),
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      trend: '+12%',
    },
    {
      label: 'Data Synced',
      value: formatBytes(stats.bytes),
      icon: Upload,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      trend: `${stats.transfers} files`,
    },
    {
      label: 'Active Jobs',
      value: (stats.activeJobs ?? 0).toString(),
      icon: RefreshCw,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      trend: 'running',
    },
    {
      label: 'Connected Storage',
      value: (stats.totalRemotes ?? 0).toString(),
      icon: Cloud,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      trend: 'remotes',
    },
  ];

  return (
    <div className='space-y-6 lg:space-y-8 animate-fade-in'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4'>
        <div>
          <h2 className='text-2xl lg:text-3xl font-bold text-foreground'>
            Dashboard
          </h2>
          <p className='text-muted-foreground mt-1'>
            Overview of your cloud synchronization
          </p>
        </div>
        <div className='flex gap-3'>
          <Button
            onClick={() => onNavigate('settings')}
            variant='outline'
            className='h-12 px-8 border-slate-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-slate-400 rounded-xl font-bold transition-all'
          >
            <Trash2 className='w-4 h-4 mr-2' />
            Reset
          </Button>
          <Button onClick={onNewJob} className='flex-1 sm:flex-none'>
            <Plus className='w-4 h-4 mr-2' />
            New Sync Job
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6'>
        {statsCards.map((stat, i) => (
          <Card
            key={i}
            className='card-premium p-6 group hover:scale-[1.02] transition-all cursor-default'
          >
            <div className='flex items-start justify-between'>
              <div className={cn('p-3 rounded-xl', stat.bg)}>
                <stat.icon className={cn('w-6 h-6', stat.color)} />
              </div>
              <span className='text-xs font-medium text-muted-foreground'>
                {stat.trend}
              </span>
            </div>
            <div className='mt-4'>
              <p className='text-2xl lg:text-3xl font-bold text-foreground font-mono'>
                {stat.value}
              </p>
              <p className='text-sm text-muted-foreground mt-1'>{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts & Activity */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Speed Chart */}
        <Card className='lg:col-span-2 card-premium overflow-hidden'>
          <CardHeader>
            <CardTitle>Transfer Speed</CardTitle>
            <CardDescription>Real-time bandwidth usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='h-64 lg:h-80'>
              {chartData.length > 0 ? (
                <ResponsiveContainer width='100%' height='100%'>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id='colorSpeed'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='hsl(var(--primary))'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='hsl(var(--primary))'
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      stroke='hsl(var(--border) / 0.5)'
                    />
                    <XAxis
                      dataKey='time'
                      stroke='hsl(var(--muted-foreground))'
                      fontSize={12}
                    />
                    <YAxis
                      stroke='hsl(var(--muted-foreground))'
                      fontSize={12}
                      tickFormatter={(v) => formatSpeed(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number | undefined) => [
                        formatSpeed(value || 0),
                        'Speed',
                      ]}
                    />
                    <Area
                      type='monotone'
                      dataKey='speed'
                      stroke='hsl(var(--primary))'
                      fillOpacity={1}
                      fill='url(#colorSpeed)'
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className='h-full flex items-center justify-center text-muted-foreground'>
                  <div className='text-center'>
                    <Activity className='w-12 h-12 mx-auto mb-3 opacity-50' />
                    <p>Waiting for data...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className='card-premium overflow-hidden'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Activity className='w-5 h-5 text-primary' />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className='p-0'>
            <div className='divide-y divide-border/50 max-h-64 lg:max-h-80 overflow-y-auto'>
              {logs
                .slice(-10)
                .reverse()
                .map((log) => (
                  <div
                    key={log.id}
                    className='p-4 hover:bg-muted/30 transition-colors'
                  >
                    <div className='flex items-start gap-3'>
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          log.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : log.type === 'error'
                              ? 'bg-red-500/10 text-red-400'
                              : log.type === 'warning'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-blue-500/10 text-blue-400'
                        )}
                      >
                        {log.type === 'success' ? (
                          <CheckCircle2 className='w-4 h-4' />
                        ) : log.type === 'error' ? (
                          <XCircle className='w-4 h-4' />
                        ) : log.type === 'warning' ? (
                          <AlertTriangle className='w-4 h-4' />
                        ) : (
                          <Info className='w-4 h-4' />
                        )}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium truncate'>
                          {log.message}
                        </p>
                        <p className='text-xs text-muted-foreground mt-0.5'>
                          {log.jobName} •{' '}
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              {logs.length === 0 && (
                <div className='p-8 text-center text-muted-foreground'>
                  <Activity className='w-10 h-10 mx-auto mb-3 opacity-50' />
                  <p className='text-sm'>No activity yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card
          className='card-premium p-6 cursor-pointer hover:border-primary/30 transition-all'
          onClick={() => onNavigate('jobs')}
        >
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-xl bg-primary/10'>
              <FolderSync className='w-6 h-6 text-primary' />
            </div>
            <div>
              <p className='font-semibold'>Manage Jobs</p>
              <p className='text-sm text-muted-foreground'>
                {jobs.length} sync jobs
              </p>
            </div>
          </div>
        </Card>
        <Card
          className='card-premium p-6 cursor-pointer hover:border-blue-30 transition-all'
          onClick={() => onNavigate('remotes')}
        >
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-xl bg-blue-500/10'>
              <Cloud className='w-6 h-6 text-blue-400' />
            </div>
            <div>
              <p className='font-semibold'>Cloud Storage</p>
              <p className='text-sm text-muted-foreground'>
                {stats.totalRemotes} connected
              </p>
            </div>
          </div>
        </Card>
        <Card
          className='card-premium p-6 cursor-pointer hover:border-emerald-30 transition-all'
          onClick={() => onNavigate('analytics')}
        >
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-xl bg-emerald-500/10'>
              <TrendingUp className='w-6 h-6 text-emerald-400' />
            </div>
            <div>
              <p className='font-semibold'>Analytics</p>
              <p className='text-sm text-muted-foreground'>
                View detailed stats
              </p>
            </div>
          </div>
        </Card>
        <Card
          className='card-premium p-6 cursor-pointer hover:border-purple-30 transition-all'
          onClick={() => onNavigate('settings')}
        >
          <div className='flex items-center gap-4'>
            <div className='p-3 rounded-xl bg-purple-500/10'>
              <Settings className='w-6 h-6 text-purple-400' />
            </div>
            <div>
              <p className='font-semibold'>Settings</p>
              <p className='text-sm text-muted-foreground'>
                Configure CloudSync
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Remotes View Component ---
function RemotesView({
  remotes,
  onNewRemote,
  onDeleteRemote,
  onOpenRemote,
}: {
  remotes: Remote[];
  onNewRemote: () => void;
  onDeleteRemote: (name: string) => void;
  onOpenRemote: (name: string) => void;
}) {
  const getRemoteIcon = (type: string) => {
    switch (type) {
      case 's3':
        return Server;
      case 'drive':
        return Globe;
      case 'local':
        return HardDrive;
      case 'crypt':
        return Lock;
      default:
        return Cloud;
    }
  };

  const getRemoteColor = (type: string) => {
    switch (type) {
      case 's3':
        return 'text-orange-400 bg-orange-500/10';
      case 'drive':
        return 'text-blue-400 bg-blue-500/10';
      case 'local':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'crypt':
        return 'text-purple-400 bg-purple-500/10';
      default:
        return 'text-primary bg-primary/10';
    }
  };

  return (
    <div className='space-y-6 lg:space-y-8 animate-fade-in'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4'>
        <div>
          <h2 className='text-2xl lg:text-3xl font-bold'>Cloud Storage</h2>
          <p className='text-muted-foreground mt-1'>
            Manage your connected cloud storage services
          </p>
        </div>
        <Button onClick={onNewRemote}>
          <Plus className='w-4 h-4 mr-2' />
          Add Storage
        </Button>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6'>
        {remotes.map((remote) => {
          const Icon = getRemoteIcon(remote.type);
          const colorClass = getRemoteColor(remote.type);
          return (
            <Card
              key={remote.name}
              className='card-premium p-6 group hover:scale-[1.02] transition-all'
            >
              <div className='flex items-start justify-between mb-4'>
                <div className={cn('p-3 rounded-xl', colorClass)}>
                  <Icon className='w-6 h-6' />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className='p-1 rounded-lg hover:bg-muted transition-colors'>
                      <MoreVertical className='w-4 h-4 text-muted-foreground' />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={() => onOpenRemote(remote.name)}>
                      <ExternalLink className='w-4 h-4 mr-2' /> Open
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteRemote(remote.name)}
                      className='text-red-500'
                    >
                      <Trash2 className='w-4 h-4 mr-2' /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h3 className='text-lg font-semibold'>{remote.name}</h3>
              <p className='text-sm text-muted-foreground capitalize mt-1'>
                {remote.type}
              </p>
              <div className='flex items-center gap-2 mt-4 pt-4 border-t border-border/50'>
                <div className='flex items-center gap-2'>
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      remote.connected ? 'bg-emerald-500' : 'bg-red-500'
                    )}
                  />
                  <span className='text-sm'>
                    {remote.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
        {/* Add New Card */}
        <Card
          onClick={onNewRemote}
          className='card-premium p-6 cursor-pointer border-dashed hover:border-primary/50 transition-all group'
        >
          <div className='flex flex-col items-center justify-center h-full py-8'>
            <div className='w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors'>
              <Plus className='w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors' />
            </div>
            <p className='font-medium'>Add Cloud Storage</p>
            <p className='text-sm text-muted-foreground mt-1'>
              Connect a new service
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Jobs View Component ---
function JobsView({
  jobs,
  onRun,
  onStop,
  onDelete,
  onNewJob,
  onOpenBrowser,
}: {
  jobs: Job[];
  onRun: (id: string) => void;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
  onNewJob: () => void;
  onOpenBrowser: (type: 'source' | 'destination') => void;
}) {
  return (
    <div className='space-y-6 lg:space-y-8 animate-fade-in'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4'>
        <div>
          <h2 className='text-2xl lg:text-3xl font-bold'>Sync Jobs</h2>
          <p className='text-muted-foreground mt-1'>
            Manage your synchronization tasks
          </p>
        </div>
        <Button onClick={onNewJob}>
          <Plus className='w-4 h-4 mr-2' />
          New Sync Job
        </Button>
      </div>

      <Card className='card-premium overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-border/50 bg-muted/30'>
                <th className='p-4 text-left text-sm font-semibold'>
                  Job Name
                </th>
                <th className='p-4 text-left text-sm font-semibold hidden md:table-cell'>
                  Source
                </th>
                <th className='p-4 text-left text-sm font-semibold hidden lg:table-cell'>
                  Destination
                </th>
                <th className='p-4 text-left text-sm font-semibold hidden sm:table-cell'>
                  Schedule
                </th>
                <th className='p-4 text-left text-sm font-semibold'>Status</th>
                <th className='p-4 text-right text-sm font-semibold'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border/50'>
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className='hover:bg-muted/30 transition-colors'
                >
                  <td className='p-4'>
                    <div className='flex items-center gap-3'>
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          job.status === 'running'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <RefreshCw
                          className={cn(
                            'w-5 h-5',
                            job.status === 'running' && 'animate-spin'
                          )}
                        />
                      </div>
                      <div>
                        <p className='font-semibold'>{job.name}</p>
                        <p className='text-sm text-muted-foreground md:hidden'>
                          {job.source} → {job.destination}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className='p-4 hidden md:table-cell'>
                    <code className='text-sm bg-muted/50 px-2 py-1 rounded'>
                      {job.source}
                    </code>
                  </td>
                  <td className='p-4 hidden lg:table-cell'>
                    <code className='text-sm bg-muted/50 px-2 py-1 rounded'>
                      {job.destination}
                    </code>
                  </td>
                  <td className='p-4 hidden sm:table-cell'>
                    <span className='text-sm'>
                      Every {job.intervalMinutes} min
                    </span>
                  </td>
                  <td className='p-4'>
                    <span
                      className={cn(
                        'badge',
                        job.status === 'running'
                          ? 'badge-success'
                          : job.status === 'error'
                            ? 'badge-error'
                            : job.status === 'success'
                              ? 'badge-primary'
                              : 'badge-info'
                      )}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className='p-4'>
                    <div className='flex items-center justify-end gap-2'>
                      {job.status === 'running' ? (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => onStop(job.id)}
                          className='hover:bg-amber-500/10 hover:text-amber-500'
                        >
                          <StopCircle className='w-4 h-4' />
                        </Button>
                      ) : (
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => onRun(job.id)}
                          className='hover:bg-emerald-500/10 hover:text-emerald-500'
                        >
                          <Play className='w-4 h-4' />
                        </Button>
                      )}
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => onDelete(job.id)}
                        className='hover:bg-red-500/10 hover:text-red-500'
                      >
                        <Trash2 className='w-4 h-4' />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className='p-12 text-center'>
                    <FolderSync className='w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50' />
                    <p className='text-muted-foreground'>
                      No sync jobs configured
                    </p>
                    <Button onClick={onNewJob} className='mt-4'>
                      <Plus className='w-4 h-4 mr-2' />
                      Create your first job
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- Activity View Component ---
function ActivityView({
  logs,
  onClear,
}: {
  logs: ActivityLog[];
  onClear: () => void;
}) {
  return (
    <div className='space-y-6 lg:space-y-8 animate-fade-in'>
      <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-4'>
        <div>
          <h2 className='text-2xl lg:text-3xl font-bold'>Activity Log</h2>
          <p className='text-muted-foreground mt-1'>
            Track all synchronization events
          </p>
        </div>
        <Button variant='outline' onClick={onClear}>
          <Trash2 className='w-4 h-4 mr-2' />
          Clear Log
        </Button>
      </div>

      <Card className='card-premium overflow-hidden'>
        <div className='max-h-[600px] overflow-y-auto'>
          <table className='w-full'>
            <thead className='sticky top-0 bg-card/95 backdrop-blur-sm z-10'>
              <tr className='border-b border-border/50'>
                <th className='p-4 text-left text-sm font-semibold'>Time</th>
                <th className='p-4 text-left text-sm font-semibold'>Type</th>
                <th className='p-4 text-left text-sm font-semibold'>Job</th>
                <th className='p-4 text-left text-sm font-semibold'>Message</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border/50'>
              {logs
                .slice()
                .reverse()
                .map((log) => (
                  <tr
                    key={log.id}
                    className='hover:bg-muted/30 transition-colors'
                  >
                    <td className='p-4 text-sm font-mono text-muted-foreground whitespace-nowrap'>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className='p-4'>
                      <span
                        className={cn(
                          'badge',
                          log.type === 'success'
                            ? 'badge-success'
                            : log.type === 'error'
                              ? 'badge-error'
                              : log.type === 'warning'
                                ? 'badge-warning'
                                : log.type === 'progress'
                                  ? 'badge-primary'
                                  : 'badge-info'
                        )}
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className='p-4 text-sm'>{log.jobName}</td>
                    <td className='p-4 text-sm'>{log.message}</td>
                  </tr>
                ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className='p-12 text-center'>
                    <History className='w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50' />
                    <p className='text-muted-foreground'>
                      No activity recorded
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// --- Analytics View Component ---
function AnalyticsView({
  stats,
  chartData,
  logs,
}: {
  stats: Stats;
  chartData: ChartDataPoint[];
  logs: ActivityLog[];
}) {
  const pieData = [
    {
      name: 'Success',
      value: logs.filter((l) => l.type === 'success').length,
      color: '#22c55e',
    },
    {
      name: 'Errors',
      value: logs.filter((l) => l.type === 'error').length,
      color: '#ef4444',
    },
    {
      name: 'Info',
      value: logs.filter((l) => l.type === 'info').length,
      color: '#3b82f6',
    },
    {
      name: 'Warnings',
      value: logs.filter((l) => l.type === 'warning').length,
      color: '#f59e0b',
    },
  ];

  const barData = [
    { name: 'Mon', transfers: 45, errors: 2 },
    { name: 'Tue', transfers: 52, errors: 1 },
    { name: 'Wed', transfers: 38, errors: 3 },
    { name: 'Thu', transfers: 65, errors: 0 },
    { name: 'Fri', transfers: 48, errors: 2 },
    { name: 'Sat', transfers: 32, errors: 1 },
    { name: 'Sun', transfers: 28, errors: 0 },
  ];

  return (
    <div className='space-y-6 lg:space-y-8 animate-fade-in'>
      <div>
        <h2 className='text-2xl lg:text-3xl font-bold'>Analytics</h2>
        <p className='text-muted-foreground mt-1'>
          Detailed synchronization metrics and insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card className='card-premium p-6'>
          <p className='text-sm text-muted-foreground'>Total Transferred</p>
          <p className='text-2xl font-bold mt-1'>{formatBytes(stats.bytes)}</p>
        </Card>
        <Card className='card-premium p-6'>
          <p className='text-sm text-muted-foreground'>Transfer Count</p>
          <p className='text-2xl font-bold mt-1'>{stats.transfers}</p>
        </Card>
        <Card className='card-premium p-6'>
          <p className='text-sm text-muted-foreground'>Avg Speed</p>
          <p className='text-2xl font-bold mt-1'>{formatSpeed(stats.speed)}</p>
        </Card>
        <Card className='card-premium p-6'>
          <p className='text-sm text-muted-foreground'>Uptime</p>
          <p className='text-2xl font-bold mt-1'>
            {formatUptime(stats.uptime)}
          </p>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Transfer History */}
        <Card className='card-premium'>
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>Weekly file transfers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='h-64'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={barData}>
                  <CartesianGrid
                    strokeDasharray='3 3'
                    stroke='hsl(var(--border) / 0.5)'
                  />
                  <XAxis
                    dataKey='name'
                    stroke='hsl(var(--muted-foreground))'
                    fontSize={12}
                  />
                  <YAxis stroke='hsl(var(--muted-foreground))' fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey='transfers'
                    fill='hsl(var(--primary))'
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey='errors'
                    fill='hsl(var(--destructive))'
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity Distribution */}
        <Card className='card-premium'>
          <CardHeader>
            <CardTitle>Activity Distribution</CardTitle>
            <CardDescription>Log entry breakdown by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='h-64 flex items-center justify-center'>
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie
                    data={pieData.filter((d) => d.value > 0)}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey='value'
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
