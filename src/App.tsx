import React, { useState, useEffect, Component } from 'react';
import { 
  auth, 
  db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  Wrench, 
  User as UserIcon, 
  Users,
  LayoutDashboard, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  Smartphone,
  Laptop,
  Monitor,
  Watch,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UserRole, UserProfile, RepairRequest, RepairStatus } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
      secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
      outline: 'border border-zinc-200 bg-transparent hover:bg-zinc-50 text-zinc-700',
      ghost: 'hover:bg-zinc-100 text-zinc-600',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-zinc-200 bg-white p-6 shadow-sm', className)}>
    {children}
  </div>
);

const Badge = ({ status }: { status: RepairStatus }) => {
  const styles = {
    pending: 'bg-amber-50 text-amber-700 border-amber-100',
    assigned: 'bg-blue-50 text-blue-700 border-blue-100',
    'in-progress': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    cancelled: 'bg-zinc-50 text-zinc-600 border-zinc-100',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize', styles[status])}>
      {status.replace('-', ' ')}
    </span>
  );
};


// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'users' | 'settings'>('dashboard');
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);

  // Auth & Profile Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (profileDoc.exists()) {
          const data = profileDoc.data() as UserProfile;
          // Ensure admin email always has admin role if not set
          if (firebaseUser.email === 'yogeshpardhi13@gmail.com' && data.role !== 'admin') {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' });
            setProfile({ ...data, role: 'admin' });
          } else {
            setProfile(data);
          }
        } else {
          // Create default profile
          const isDefaultAdmin = firebaseUser.email === 'yogeshpardhi13@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: isDefaultAdmin ? 'admin' : 'customer',
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listener
  useEffect(() => {
    if (!profile) return;

    let q;
    if (profile.role === 'admin') {
      q = query(collection(db, 'repairRequests'), orderBy('createdAt', 'desc'));
    } else if (profile.role === 'technician') {
      q = query(
        collection(db, 'repairRequests'), 
        where('status', 'in', ['pending', 'assigned', 'in-progress']),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'repairRequests'), 
        where('customerId', '==', profile.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairRequest));
      setRequests(docs);
    });

    return unsubscribe;
  }, [profile]);

  // Users Listener (Admin Only)
  useEffect(() => {
    if (profile?.role === 'admin' && activeTab === 'users') {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      });
      return unsubscribe;
    }
  }, [profile, activeTab]);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <Wrench className="h-12 w-12 animate-bounce text-zinc-900" />
          <p className="text-sm font-medium text-zinc-500">Initializing FixIt Pro...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg">
              <Wrench className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">FixIt Pro</h1>
            <p className="mt-2 text-zinc-600">Professional Electronic Repair Management</p>
          </div>

          <Card className="p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">Welcome Back</h2>
                <p className="text-sm text-zinc-500">Sign in to manage your repairs or check status.</p>
              </div>
              <Button onClick={handleLogin} className="w-full py-6 text-base" variant="primary">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="mr-2 h-5 w-5" alt="Google" />
                Continue with Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-zinc-500">Trusted by Professionals</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="hidden w-64 border-r border-zinc-200 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6">
          <div className="flex items-center gap-2 font-bold text-zinc-900">
            <Wrench className="h-5 w-5" />
            <span>FixIt Pro</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <SidebarLink 
            icon={<LayoutDashboard className="h-4 w-4" />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarLink 
            icon={<ClipboardList className="h-4 w-4" />} 
            label="Repair Requests" 
            active={activeTab === 'requests'} 
            onClick={() => setActiveTab('requests')} 
          />
          {profile?.role === 'admin' && (
            <SidebarLink 
              icon={<Users className="h-4 w-4" />} 
              label="User Management" 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
            />
          )}
          <SidebarLink 
            icon={<Settings className="h-4 w-4" />} 
            label="Settings" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-zinc-900">{profile?.displayName}</p>
              <p className="truncate text-[10px] text-zinc-500 capitalize">{profile?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-zinc-400 hover:text-zinc-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-8 backdrop-blur-md">
          <h2 className="text-lg font-semibold capitalize text-zinc-900">{activeTab}</h2>
          <div className="flex items-center gap-4">
            {profile?.role === 'customer' && (
              <Button onClick={() => setShowNewRequestModal(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            )}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text" 
                placeholder="Search repairs..." 
                className="h-9 w-64 rounded-lg border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>
        </header>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard title="Total Repairs" value={requests.length} icon={<ClipboardList className="h-5 w-5" />} />
                  <StatCard title="In Progress" value={requests.filter(r => r.status === 'in-progress').length} icon={<Clock className="h-5 w-5 text-indigo-600" />} />
                  <StatCard title="Completed" value={requests.filter(r => r.status === 'completed').length} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} />
                  <StatCard title="Pending" value={requests.filter(r => r.status === 'pending').length} icon={<AlertCircle className="h-5 w-5 text-amber-600" />} />
                </div>

                {/* Recent Activity */}
                <div className="grid gap-8 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="font-semibold">Recent Repair Requests</h3>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('requests')}>View All</Button>
                    </div>
                    <div className="space-y-4">
                      {requests.slice(0, 5).map(request => (
                        <RepairItem key={request.id} request={request} role={profile?.role || 'customer'} />
                      ))}
                      {requests.length === 0 && (
                        <div className="py-12 text-center text-zinc-500">
                          No repair requests found.
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card>
                    <h3 className="mb-6 font-semibold">Quick Actions</h3>
                    <div className="space-y-3">
                      {profile?.role === 'customer' && (
                        <Button className="w-full justify-start" variant="outline" onClick={() => setShowNewRequestModal(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Submit New Repair
                        </Button>
                      )}
                      <Button className="w-full justify-start" variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Contact Support
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <UserIcon className="mr-2 h-4 w-4" />
                        Update Profile
                      </Button>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div 
                key="requests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                </div>
                <Card className="p-0 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">Device</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Customer</th>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {requests.map(request => (
                        <tr key={request.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <DeviceIcon type={request.deviceType} />
                              <span className="font-medium text-zinc-900">{request.deviceType}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge status={request.status} />
                          </td>
                          <td className="px-6 py-4 text-zinc-600">{request.customerName}</td>
                          <td className="px-6 py-4 text-zinc-500">{format(new Date(request.createdAt), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4 text-right">
                            <RequestActions request={request} profile={profile!} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {requests.length === 0 && (
                    <div className="py-20 text-center text-zinc-500">
                      No repair requests found.
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {activeTab === 'users' && profile?.role === 'admin' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="p-0 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">User</th>
                        <th className="px-6 py-4 font-medium">Email</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium">Joined</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {allUsers.map(u => (
                        <tr key={u.uid} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                                <UserIcon className="h-4 w-4" />
                              </div>
                              <span className="font-medium text-zinc-900">{u.displayName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600">{u.email}</td>
                          <td className="px-6 py-4">
                            <Badge status={u.role === 'admin' ? 'completed' : u.role === 'technician' ? 'assigned' : 'pending'} />
                            <span className="ml-2 text-xs text-zinc-500 capitalize">{u.role}</span>
                          </td>
                          <td className="px-6 py-4 text-zinc-500">{format(new Date(u.createdAt), 'MMM d, yyyy')}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <select 
                                value={u.role}
                                onChange={async (e) => {
                                  const newRole = e.target.value as UserRole;
                                  await updateDoc(doc(db, 'users', u.uid), { role: newRole });
                                }}
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-zinc-900 focus:outline-none"
                              >
                                <option value="customer">Customer</option>
                                <option value="technician">Technician</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card className="max-w-2xl">
                  <h3 className="mb-6 text-xl font-semibold">Account Settings</h3>
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-500 uppercase">Display Name</label>
                        <input 
                          type="text" 
                          defaultValue={profile?.displayName}
                          className="w-full rounded-lg border border-zinc-200 p-2 text-sm focus:border-zinc-900 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-500 uppercase">Email Address</label>
                        <input 
                          type="email" 
                          disabled
                          defaultValue={profile?.email}
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-500 uppercase">Role</label>
                      <div className="flex items-center gap-2">
                        <Badge status={profile?.role === 'admin' ? 'completed' : profile?.role === 'technician' ? 'assigned' : 'pending'} />
                        <span className="text-xs text-zinc-400 italic">Contact admin to change role</span>
                      </div>
                    </div>
                    <div className="pt-4">
                      <Button>Save Changes</Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* New Request Modal */}
      <AnimatePresence>
        {showNewRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewRequestModal(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-zinc-900">New Repair Request</h3>
              <p className="mt-1 text-zinc-500">Tell us what's wrong with your device.</p>
              
              <NewRequestForm 
                onClose={() => setShowNewRequestModal(false)} 
                profile={profile!} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-50 text-zinc-600">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-zinc-900">{value}</p>
      </div>
    </Card>
  );
}

function DeviceIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes('phone')) return <Smartphone className="h-4 w-4 text-zinc-500" />;
  if (t.includes('laptop')) return <Laptop className="h-4 w-4 text-zinc-500" />;
  if (t.includes('monitor') || t.includes('tv')) return <Monitor className="h-4 w-4 text-zinc-500" />;
  if (t.includes('watch')) return <Watch className="h-4 w-4 text-zinc-500" />;
  return <Smartphone className="h-4 w-4 text-zinc-500" />;
}

interface RepairItemProps {
  request: RepairRequest;
  role: UserRole;
}

const RepairItem: React.FC<RepairItemProps> = ({ request, role }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 p-4 transition-colors hover:bg-zinc-50">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
          <DeviceIcon type={request.deviceType} />
        </div>
        <div>
          <p className="font-medium text-zinc-900">{request.deviceType}</p>
          <p className="text-xs text-zinc-500">{request.issueDescription.slice(0, 50)}...</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Badge status={request.status} />
        <ChevronRight className="h-4 w-4 text-zinc-300" />
      </div>
    </div>
  );
}

function RequestActions({ request, profile }: { request: RepairRequest; profile: UserProfile }) {
  const updateStatus = async (newStatus: RepairStatus) => {
    try {
      await updateDoc(doc(db, 'repairRequests', request.id), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        ...(newStatus === 'assigned' ? { technicianId: profile.uid, technicianName: profile.displayName } : {})
      });
    } catch (error) {
      console.error('Update failed', error);
    }
  };

  if (profile.role === 'admin') {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm">Edit</Button>
        <Button variant="danger" size="sm">Delete</Button>
      </div>
    );
  }

  if (profile.role === 'technician') {
    return (
      <div className="flex justify-end gap-2">
        {request.status === 'pending' && (
          <Button size="sm" onClick={() => updateStatus('assigned')}>Accept</Button>
        )}
        {request.status === 'assigned' && (
          <Button size="sm" onClick={() => updateStatus('in-progress')}>Start Work</Button>
        )}
        {request.status === 'in-progress' && (
          <Button size="sm" onClick={() => updateStatus('completed')}>Complete</Button>
        )}
      </div>
    );
  }

  if (profile.role === 'customer' && request.status === 'pending') {
    return (
      <Button variant="danger" size="sm" onClick={() => updateStatus('cancelled')}>Cancel</Button>
    );
  }

  return <Button variant="ghost" size="sm">Details</Button>;
}

function NewRequestForm({ onClose, profile }: { onClose: () => void; profile: UserProfile }) {
  const [deviceType, setDeviceType] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceType || !description) return;

    setSubmitting(true);
    try {
      const newRequest = {
        customerId: profile.uid,
        customerName: profile.displayName,
        deviceType,
        issueDescription: description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'repairRequests'), newRequest);
      onClose();
    } catch (error) {
      console.error('Submission failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Device Type</label>
          <select 
            required
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="">Select a device</option>
            <option value="Smartphone">Smartphone</option>
            <option value="Laptop">Laptop</option>
            <option value="Tablet">Tablet</option>
            <option value="Desktop PC">Desktop PC</option>
            <option value="Smartwatch">Smartwatch</option>
            <option value="Gaming Console">Gaming Console</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Issue Description</label>
          <textarea 
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please describe the problem in detail..."
            className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  );
}
