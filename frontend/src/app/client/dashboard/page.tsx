"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  User, 
  Settings,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  totalProjects: number;
  submittedProjects: number;
  inProgressProjects: number;
  completedProjects: number;
  awaitingPayment: number;
  paidProjects: number;
}

interface Project {
  id: string;
  projectToken: string;
  title: string;
  status: string;
  createdAt: string;
  deadline?: string;
  budget?: number;
  currency?: string;
}

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function ClientDashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats
      const statsResponse = await fetch('/api/clients/me/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats || statsData);
      }

      // Fetch recent projects
      const projectsResponse = await fetch('/api/clients/me/projects?limit=5');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setRecentProjects(projectsData.projects || []);
      }

      // Fetch recent payments
      const paymentsResponse = await fetch('/api/payments/me/history?limit=5');
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        // Flatten the history array to get just orders with their transactions
        const payments: Payment[] = [];
        if (paymentsData.history && Array.isArray(paymentsData.history)) {
          paymentsData.history.forEach((item: { order: Payment; transactions: Payment[] }) => {
            if (item.order) {
              payments.push({
                ...item.order,
                id: item.order.id || item.order.orderId,
              });
            }
          });
        }
        setRecentPayments(payments);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client') {
      fetchDashboardData();
    }
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'SUBMITTED':
      case 'AWAITING_PAYMENT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'DRAFT':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'CANCELLED':
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-400';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400';
      case 'CANCELLED':
        return 'bg-slate-500/20 text-slate-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-6" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-24 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Client Dashboard</h1>
            <p className="text-slate-400 mt-1">Welcome back, {user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/client/profile">
              <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80">
                <User className="h-4 w-4 mr-2" />
                My Profile
              </Button>
            </Link>
            <Link href="/client/settings">
              <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="ghost" onClick={logout} className="text-slate-300 hover:text-white">
              Logout
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Projects</CardTitle>
              <FileText className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalProjects || 0}</div>
              <CardDescription className="text-xs text-slate-400">All projects</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Submitted</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats?.submittedProjects || 0}</div>
              <CardDescription className="text-xs text-slate-400">Awaiting review</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{stats?.inProgressProjects || 0}</div>
              <CardDescription className="text-xs text-slate-400">Currently working</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats?.completedProjects || 0}</div>
              <CardDescription className="text-xs text-slate-400">Delivered projects</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Payment Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Awaiting Payment</CardTitle>
              <CreditCard className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{stats?.awaitingPayment || 0}</div>
              <CardDescription className="text-xs text-slate-400">Requires payment</CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Paid Projects</CardTitle>
              <CreditCard className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats?.paidProjects || 0}</div>
              <CardDescription className="text-xs text-slate-400">Successfully paid</CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8 bg-gradient-to-r from-slate-800/50 to-cyan-800/20 border-cyan-700/30">
          <CardHeader>
            <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
            <CardDescription className="text-sm text-cyan-200/60">
              Get started with your projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Link href="/client/projects/new">
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Create New Project
                </Button>
              </Link>
              <Link href="/client/projects">
                <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  View All Projects
                </Button>
              </Link>
              <Link href="/client/payments">
                <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment History
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Recent Projects</CardTitle>
              <Link href="/client/projects">
                <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 text-sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-cyan-400/50 mb-4" />
                  <p className="text-slate-400 text-center mb-2">No projects yet</p>
                  <p className="text-slate-500 text-sm text-center">
                    Create your first project to get started
                  </p>
                  <Link href="/client/projects/new">
                    <Button className="mt-4 bg-cyan-600 hover:bg-cyan-700">
                      Create Project
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentProjects.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex-1">
                        <Link href={`/client/projects/${project.id}`} className="hover:underline">
                          <h3 className="font-medium text-white">{project.title}</h3>
                        </Link>
                        <p className="text-sm text-slate-400 mt-1">
                          {project.deadline && `Due: ${formatDate(project.deadline)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {project.budget && (
                          <span className="text-sm text-slate-300">
                            {formatCurrency(project.budget, project.currency)}
                          </span>
                        )}
                        <Badge className={getStatusColor(project.status)}>
                          {project.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white">Recent Payments</CardTitle>
              <Link href="/client/payments">
                <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 text-sm">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-cyan-400/50 mb-4" />
                  <p className="text-slate-400 text-center mb-2">No payments yet</p>
                  <p className="text-slate-500 text-sm text-center">
                    Payments will appear here after completion
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentPayments.slice(0, 5).map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">{payment.orderId}</p>
                        <p className="text-sm text-slate-400 mt-1">
                          {formatDate(payment.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {formatCurrency(payment.amount, payment.currency)}
                        </span>
                        <Badge className={getPaymentStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
