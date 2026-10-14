"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Payment,
  TrendingUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface PaymentOrder {
  id: string;
  orderId: string;
  clientId: string;
  projectId: string | null;
  amount: number;
  currency: string;
  paymentId: string | null;
  signature: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentHistory {
  order: PaymentOrder;
  transactions: Array<{
    id: string;
    transactionId: string | null;
    amount: number;
    currency: string;
    gateway: string;
    method: string | null;
    status: string;
    createdAt: string;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  CANCELLED: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  REFUNDED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  CREATED: <Clock className="h-3.5 w-3.5" />,
  PENDING: <Clock className="h-3.5 w-3.5" />,
  PAID: <CheckCircle className="h-3.5 w-3.5" />,
  FAILED: <XCircle className="h-3.5 w-3.5" />,
  CANCELLED: <XCircle className="h-3.5 w-3.5" />,
  REFUNDED: <TrendingUp className="h-3.5 w-3.5" />,
};

export default function ClientPaymentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payments/me/history');
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch payment history');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client') {
      fetchPaymentHistory();
    }
  }, [user]);

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status.toUpperCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICONS[status.toUpperCase()] || <CreditCard className="h-3.5 w-3.5" />;
  };

  const getTransactionStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400';
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-64 mb-4" />
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-4 w-full" />
                    ))}
                  </div>
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

  // Group orders by status for better organization
  const paidOrders = history.filter(item => item.order.status === 'PAID');
  const pendingOrders = history.filter(item => item.order.status === 'PENDING' || item.order.status === 'CREATED');
  const failedOrders = history.filter(item => item.order.status === 'FAILED' || item.order.status === 'CANCELLED');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Payment History</h1>
            <p className="text-slate-400 mt-1">Track all your payments and transactions</p>
          </div>
          <Link href="/client/dashboard">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{history.length}</div>
              <CardDescription className="text-xs text-slate-400">
                All payment orders
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Successfully Paid</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{paidOrders.length}</div>
              <CardDescription className="text-xs text-slate-400">
                Completed payments
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{pendingOrders.length}</div>
              <CardDescription className="text-xs text-slate-400">
                Awaiting completion
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* All Payments */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white">Payment History</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              All your payment transactions in chronological order
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CreditCard className="h-16 w-16 text-cyan-400/50 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Payment History</h3>
                <p className="text-slate-400 text-center mb-6">
                  You have not made any payments yet
                </p>
                <Link href="/client/projects">
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <FileText className="h-4 w-4 mr-2" />
                    Create a Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Paid Orders Section */}
                {paidOrders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-emerald-400 mb-4">Successfully Paid</h3>
                    <div className="space-y-4">
                      {paidOrders.map((item) => (
                        <div
                          key={item.order.id}
                          className="p-4 bg-slate-700/30 rounded-lg border border-slate-700/50"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getStatusColor(item.order.status)}>
                                  {getStatusIcon(item.order.status)}
                                  {item.order.status}
                                </Badge>
                                <span className="text-white font-medium">Order #{item.order.orderId}</span>
                              </div>
                              <p className="text-sm text-slate-400">
                                {formatDate(item.order.createdAt)}
                              </p>
                            </div>
                            <span className="text-xl font-bold text-emerald-400">
                              {formatCurrency(item.order.amount, item.order.currency)}
                            </span>
                          </div>
                          
                          {item.order.projectId && (
                            <p className="text-sm text-slate-400 mb-3">
                              Related to project: {item.order.projectId}
                            </p>
                          )}
                          
                          {item.transactions && item.transactions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50">
                              <h4 className="text-sm font-medium text-slate-300 mb-2">Transactions</h4>
                              <div className="space-y-2">
                                {item.transactions.map((txn) => (
                                  <div
                                    key={txn.id}
                                    className="flex items-center justify-between p-2 bg-slate-800/30 rounded"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-slate-400">
                                        {txn.transactionId || 'N/A'}
                                      </span>
                                      {txn.method && (
                                        <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                                          {txn.method}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className={getTransactionStatusColor(txn.status)}>
                                        {txn.status}
                                      </Badge>
                                      <span className="text-sm text-slate-300">
                                        {formatCurrency(txn.amount, txn.currency)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Orders Section */}
                {pendingOrders.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-amber-400 mb-4">Pending Payments</h3>
                    <div className="space-y-4">
                      {pendingOrders.map((item) => (
                        <div
                          key={item.order.id}
                          className="p-4 bg-slate-700/30 rounded-lg border border-slate-700/50"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getStatusColor(item.order.status)}>
                                  {getStatusIcon(item.order.status)}
                                  {item.order.status}
                                </Badge>
                                <span className="text-white font-medium">Order #{item.order.orderId}</span>
                              </div>
                              <p className="text-sm text-slate-400">
                                {formatDate(item.order.createdAt)}
                              </p>
                            </div>
                            <span className="text-xl font-bold text-amber-400">
                              {formatCurrency(item.order.amount, item.order.currency)}
                            </span>
                          </div>
                          
                          {item.order.projectId && (
                            <p className="text-sm text-slate-400 mb-3">
                              Related to project: {item.order.projectId}
                            </p>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              className="bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
                              onClick={() => {
                                // Implement payment retry logic
                                alert('Payment retry functionality would be implemented here');
                              }}
                            >
                              <Payment className="h-3.5 w-3.5 mr-2" />
                              Complete Payment
                            </Button>
                            <Button variant="outline" className="border-slate-600 text-white text-sm">
                              <ExternalLink className="h-3.5 w-3.5 mr-2" />
                              View Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Failed/Cancelled Orders Section */}
                {failedOrders.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-4">Failed/Cancelled Payments</h3>
                    <div className="space-y-4">
                      {failedOrders.map((item) => (
                        <div
                          key={item.order.id}
                          className="p-4 bg-slate-700/30 rounded-lg border border-slate-700/50 opacity-70"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getStatusColor(item.order.status)}>
                                  {getStatusIcon(item.order.status)}
                                  {item.order.status}
                                </Badge>
                                <span className="text-white font-medium">Order #{item.order.orderId}</span>
                              </div>
                              <p className="text-sm text-slate-400">
                                {formatDate(item.order.createdAt)}
                              </p>
                            </div>
                            <span className="text-xl font-bold text-red-400">
                              {formatCurrency(item.order.amount, item.order.currency)}
                            </span>
                          </div>
                          
                          {item.order.notes && (
                            <p className="text-sm text-slate-400 italic">
                              Reason: {item.order.notes}
                            </p>
                          )}
                          
                          <Button variant="ghost" className="text-slate-300 text-sm">
                            Retry
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card className="bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-white mb-1">Payment Information</h3>
                <p className="text-sm text-slate-400">
                  All payments are processed securely through Razorpay
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white text-sm">
                  <ExternalLink className="h-3.5 w-3.5 mr-2" />
                  Razorpay Info
                </Button>
                <Link href="/client/dashboard">
                  <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 text-sm">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
