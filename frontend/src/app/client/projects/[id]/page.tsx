"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  FileText,
  Clock,
  Calendar,
  DollarSign,
  Tag,
  Edit,
  Trash2,
  Payment,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
  updatedAt: string;
  files: Array<{ url: string; name: string; uploadedAt: string }>;
}

interface ProjectHistory {
  id: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  SUBMITTED: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  AWAITING_PAYMENT: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  UNDER_REVIEW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  DELIVERED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  DRAFT: <FileText className="h-4 w-4" />,
  SUBMITTED: <Clock className="h-4 w-4" />,
  AWAITING_PAYMENT: <Payment className="h-4 w-4" />,
  PAID: <CheckCircle className="h-4 w-4" />,
  UNDER_REVIEW: <Clock className="h-4 w-4" />,
  IN_PROGRESS: <Loader2 className="h-4 w-4 animate-spin" />,
  DELIVERED: <CheckCircle className="h-4 w-4" />,
  COMPLETED: <CheckCircle className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
};

const STATUS_ACTIONS: Record<string, string> = {
  DRAFT: 'Save as Draft',
  SUBMITTED: 'Submit for Review',
  AWAITING_PAYMENT: 'Pay Now',
  PAID: 'Paid',
  UNDER_REVIEW: 'Under Review',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Mark as Complete',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function ProjectDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const projectId = params.id as string;

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/clients/me/projects/${projectId}`);
      
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else if (response.status === 404) {
        setError('Project not found');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/clients/me/projects/${projectId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      // History fetch is not critical
    }
  };

  useEffect(() => {
    if (user?.role === 'client' && projectId) {
      fetchProject();
      fetchHistory();
    }
  }, [user, projectId]);

  const formatCurrency = (amount: number | null, currency: string = 'INR') => {
    if (amount === null) return 'Not specified';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status.toUpperCase()] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICONS[status.toUpperCase()] || <FileText className="h-4 w-4" />;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/clients/me/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/client/projects');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async (action: string) => {
    try {
      setActionLoading(true);
      
      let newStatus: string;
      switch (action) {
        case 'SUBMITTED':
          newStatus = 'SUBMITTED';
          break;
        case 'PAID':
          // For PAID, we'll redirect to payment
          router.push(`/client/projects/${projectId}/payment`);
          return;
        case 'COMPLETED':
          newStatus = 'COMPLETED';
          break;
        default:
          return;
      }

      const response = await fetch(`/api/clients/me/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchProject();
        fetchHistory();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" className="text-slate-300" disabled>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">Loading Project...</h1>
            </div>
          </div>
          <div className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </div>
                  <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'client' || !project) {
    if (error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
          <div className="max-w-4xl mx-auto">
            <Link href="/client/projects">
              <Button variant="ghost" className="text-slate-300 hover:text-white mb-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/client/projects">
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              {project.title}
            </h1>
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

        {/* Project Card */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl text-white flex items-center gap-2">
                  {getStatusIcon(project.status)}
                  {project.title}
                </CardTitle>
                <CardDescription className="text-sm text-slate-400 mt-2">
                  Project Token: {project.projectToken}
                </CardDescription>
              </div>
              <Badge className={getStatusColor(project.status)}>
                {project.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Description
              </h3>
              <p className="text-slate-300 whitespace-pre-wrap">
                {project.description || 'No description provided'}
              </p>
            </div>

            {/* Project Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {project.category && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                      <Tag className="h-4 w-4" />
                      Category
                    </h3>
                    <p className="text-white">{project.category}</p>
                  </div>
                )}

                {project.serviceType && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      Service Type
                    </h3>
                    <p className="text-white">{project.serviceType}</p>
                  </div>
                )}

                {project.budget !== null && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      Budget
                    </h3>
                    <p className="text-white font-medium">
                      {formatCurrency(project.budget, project.currency)}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Created
                  </h3>
                  <p className="text-white">{formatDate(project.createdAt)}</p>
                </div>

                {project.deadline && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Deadline
                    </h3>
                    <p className="text-white">{formatDate(project.deadline)}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Last Updated
                  </h3>
                  <p className="text-white">{formatDate(project.updatedAt)}</p>
                </div>
              </div>
            </div>

            {/* Technology Stack */}
            {project.technologyStack && project.technologyStack.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Technology Stack
                </h3>
                <div className="flex flex-wrap gap-2">
                  {project.technologyStack.map((tech) => (
                    <Badge
                      key={tech}
                      variant="outline"
                      className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {project.files && project.files.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Project Files ({project.files.length})
                </h3>
                <div className="space-y-2">
                  {project.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-slate-700/30 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-300">{file.name}</span>
                      </div>
                      <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200 text-sm">
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-700/50">
              {(project.status === 'DRAFT' || project.status === 'SUBMITTED') && (
                <Link href={`/client/projects/${project.id}/edit`}>
                  <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Project
                  </Button>
                </Link>
              )}

              {project.status === 'AWAITING_PAYMENT' && (
                <Button
                  className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  onClick={() => handleAction('PAID')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Payment className="h-4 w-4 mr-2" />
                      Pay Now
                    </>
                  )}
                </Button>
              )}

              {(project.status === 'DRAFT' || project.status === 'CANCELLED') && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status History */}
        {history.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg text-white">Status History</CardTitle>
              <CardDescription className="text-sm text-slate-400">
                Track all status changes for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {history
                  .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(item.oldStatus)}>
                            {item.oldStatus}
                          </Badge>
                          <span className="text-slate-400">→</span>
                          <Badge className={getStatusColor(item.newStatus)}>
                            {item.newStatus}
                          </Badge>
                        </div>
                        {item.notes && (
                          <p className="text-sm text-slate-400 mt-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">{formatShortDate(item.changedAt)}</p>
                        <p className="text-xs text-slate-500">{item.changedBy}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions Card */}
        <Card className="bg-slate-800/30 border-slate-700/50 mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-white mb-1">Need Help?</h3>
                <p className="text-sm text-slate-400">
                  Contact our support team if you have any questions about your project
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80 text-white">
                  Contact Support
                </Button>
                <Link href="/client/dashboard">
                  <Button variant="ghost" className="text-cyan-300 hover:text-cyan-200">
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
