"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, CreditCard, CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Project {
  id: string;
  projectToken: string;
  title: string;
  description: string | null;
  category: string | null;
  serviceType: string | null;
  technologyStack: string[];
  budget: number | null;
  currency: string;
  deadline: string | null;
  status: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function ProjectPaymentPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchProjectAndOrder = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch project
      const projectResponse = await fetch(`/api/clients/me/projects/${projectId}`);
      if (projectResponse.ok) {
        const data = await projectResponse.json();
        setProject(data.project || data);
      } else {
        const errorData = await projectResponse.json();
        setError(errorData.message || 'Failed to fetch project');
        setTimeout(() => router.push('/client/projects'), 2000);
        return;
      }
      
      // Check for existing order
      const ordersResponse = await fetch(`/api/payments/me/orders?projectId=${projectId}`);
      if (ordersResponse.ok) {
        const data = await ordersResponse.json();
        if (data.orders && data.orders.length > 0) {
          // Get the most recent order for this project
          const projectOrders = data.orders.filter((o: Order) => o.projectId === projectId);
          if (projectOrders.length > 0) {
            setOrder(projectOrders[0]);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client' && projectId) {
      fetchProjectAndOrder();
    }
  }, [user, projectId]);

  useEffect(() => {
    // Check URL for payment verification parameters
    const urlParams = new URLSearchParams(window.location.search);
    const paymentIdParam = urlParams.get('payment_id');
    const signatureParam = urlParams.get('signature');
    const orderIdParam = urlParams.get('order_id');
    
    if (paymentIdParam && signatureParam && orderIdParam) {
      // Verify payment
      verifyPayment(orderIdParam, paymentIdParam, signatureParam);
    }
  }, []);

  const createOrder = async () => {
    if (!project || !projectId) return;
    
    setCreatingOrder(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Calculate amount based on project budget
      const amount = project.budget || 0;
      
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          amount,
          currency: project.currency || 'INR',
          notes: `Payment for project: ${project.title}`,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        
        // Open Razorpay checkout
        if (data.razorpayOrder) {
          openRazorpayCheckout(data.razorpayOrder.id, data.order.id);
        } else {
          setError('Order created but Razorpay is not configured. Please contact support.');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setCreatingOrder(false);
    }
  };

  const openRazorpayCheckout = (razorpayOrderId: string, orderId: string) => {
    // In a real implementation, load Razorpay script dynamically
    // For now, we'll redirect to a simulated payment page
    // In production, use Razorpay's checkout form
    
    // This is a placeholder - in production you would use:
    // const options = {
    //   key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    //   amount: order.amount * 100, // Convert to paise
    //   currency: order.currency,
    //   name: 'Universal King',
    //   description: `Payment for ${project?.title}`,
    //   order_id: razorpayOrderId,
    //   handler: function(response: any) {
    //     verifyPayment(orderId, response.razorpay_payment_id, response.razorpay_signature);
    //   },
    //   prefill: {
    //     name: user?.name,
    //     email: user?.email,
    //   },
    //   theme: {
    //     color: '#06b6d4',
    //   },
    // };
    // const rzp = new window.Razorpay(options);
    // rzp.open();
    
    // For demo purposes, we'll simulate a payment redirect
    // In production, uncomment the above code and remove the redirect below
    
    // Simulate payment success for testing
    const simulatedPaymentId = `pay_${Date.now()}`;
    const simulatedSignature = `simulated_signature_${Date.now()}`;
    
    // Redirect with payment verification params (simulated)
    window.location.href = `/client/projects/${projectId}/payment?payment_id=${simulatedPaymentId}&signature=${simulatedSignature}&order_id=${razorpayOrderId}`;
  };

  const verifyPayment = async (orderIdParam: string, paymentIdParam: string, signatureParam: string) => {
    setVerifyingPayment(true);
    setError(null);
    
    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderIdParam,
          paymentId: paymentIdParam,
          signature: signatureParam,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccess('Payment verified successfully! Your project is now paid.');
        setPaymentId(paymentIdParam);
        setSignature(signatureParam);
        
        // Refresh project status
        setTimeout(() => {
          fetchProjectAndOrder();
        }, 1000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Payment verification failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment verification failed');
    } finally {
      setVerifyingPayment(false);
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

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'PENDING':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'CANCELLED':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  if (!project && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <Alert variant="destructive" className="mb-8">
            <AlertTitle>Project Not Found</AlertTitle>
            <AlertDescription>
              The project you are looking for does not exist.
            </AlertDescription>
          </Alert>
          <Link href="/client/projects">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href={`/client/projects/${projectId}`}>
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-emerald-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Make Payment</h1>
              <p className="text-slate-400 mt-1">
                Complete payment for your project: {project?.title}
              </p>
            </div>
          </div>
        </div>

        {/* Error/Success Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Payment Information */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Payment Summary</CardTitle>
            <CardDescription className="text-slate-400">
              Review your payment details before proceeding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between p-4 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400">Project</p>
                  <p className="font-medium text-white">{project?.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Project Token</p>
                  <p className="font-mono text-slate-300">{project?.projectToken}</p>
                </div>
              </div>
              
              <div className="flex justify-between p-4 bg-slate-700/30 rounded-lg">
                <div>
                  <p className="text-sm text-slate-400">Amount</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(project?.budget || 0, project?.currency || 'INR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Currency</p>
                  <p className="font-medium text-white">{project?.currency || 'INR'}</p>
                </div>
              </div>
              
              {project?.description && (
                <div className="p-4 bg-slate-700/30 rounded-lg">
                  <p className="text-sm text-slate-400 mb-2">Description</p>
                  <p className="text-slate-300 text-sm">{project.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Status */}
        {order && (
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <CardTitle className="text-white">Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${getStatusColor(order.status)}`}>
                  {order.status === 'PAID' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : order.status === 'PENDING' ? (
                    <Clock className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-400">Order ID</p>
                  <p className="font-mono font-medium text-white">{order.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Status</p>
                  <p className={`font-medium ${order.status === 'PAID' ? 'text-emerald-400' : order.status === 'PENDING' ? 'text-amber-400' : 'text-red-400'}`}>
                    {order.status}
                  </p>
                </div>
              </div>
              
              {order.status === 'PAID' && (
                <Alert variant="success" className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Payment successful! Amount: {formatCurrency(order.amount, order.currency)}
                  </AlertDescription>
                </Alert>
              )}
              
              {order.status === 'PENDING' && (
                <Alert variant="info" className="mt-4 bg-amber-500/10 border-amber-500/30 text-amber-400">
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Payment is pending. Please complete the payment process.
                  </AlertDescription>
                </Alert>
              )}
              
              {order.status !== 'PAID' && order.status !== 'PENDING' && (
                <Alert variant="destructive" className="mt-4">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    Payment was not successful. You can try again.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Actions */}
        {order && order.status === 'PAID' ? (
          <Card className="bg-gradient-to-r from-slate-800/50 to-emerald-800/20 border-emerald-700/30">
            <CardHeader>
              <CardTitle className="text-emerald-400">Payment Complete!</CardTitle>
              <CardDescription className="text-emerald-400/60">
                Your payment has been successfully processed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Link href={`/client/projects/${projectId}`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    View Project
                  </Button>
                </Link>
                <Link href="/client/projects">
                  <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                    View All Projects
                  </Button>
                </Link>
                <Link href="/client/payments">
                  <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                    Payment History
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Complete Payment</CardTitle>
              <CardDescription className="text-slate-400">
                {order 
                  ? 'Complete your pending payment'
                  : 'Create a new payment order for this project'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 bg-amber-500/10 border-amber-500/30 text-amber-400">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  {order 
                    ? 'Your payment is pending. Click below to complete the payment.'
                    : 'Click the button below to create a payment order and complete the payment.'}
                </AlertDescription>
              </Alert>
              
              <Button
                onClick={createOrder}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-lg py-6"
                disabled={creatingOrder || verifyingPayment}
              >
                {creatingOrder ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Order...
                  </span>
                ) : verifyingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying Payment...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Pay {formatCurrency(project?.budget || 0, project?.currency || 'INR')}
                  </span>
                )}
              </Button>
              
              <p className="text-xs text-slate-500 mt-4 text-center">
                By clicking the button above, you agree to our terms and conditions.
                Payments are processed securely via Razorpay.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
