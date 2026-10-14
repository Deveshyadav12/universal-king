"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  Plus,
  Search,
  Clock,
  TrendingUp,
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
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting Payment' },
  { value: 'PAID', label: 'Paid' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const SORT_OPTIONS = [
  { value: 'createdAt_desc', label: 'Newest First' },
  { value: 'createdAt_asc', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
];

export default function ClientProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt_desc');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);

      let url = `/api/clients/me/projects?limit=${perPage}&offset=${(page - 1) * perPage}`;
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client') {
      fetchProjects();
    }
  }, [user, page, statusFilter, perPage]);

  const getStatusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'AWAITING_PAYMENT':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'DRAFT':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      case 'CANCELLED':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'INR') => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredProjects = projects.filter(project => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query) ||
      project.projectToken.toLowerCase().includes(query) ||
      project.category?.toLowerCase().includes(query) ||
      project.serviceType?.toLowerCase().includes(query) ||
      project.technologyStack?.some(tech => tech.toLowerCase().includes(query))
    );
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const [sortField, sortOrder] = sortBy.split('_') as [keyof Project, 'asc' | 'desc'];
    
    if (sortField === 'title') {
      return sortOrder === 'asc' 
        ? a.title.localeCompare(b.title)
        : b.title.localeCompare(a.title);
    }
    
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    return 0;
  });

  const getStatusIcon = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PAID':
      case 'COMPLETED':
        return <CheckCircle className="h-3 w-3" />;
      case 'IN_PROGRESS':
        return <TrendingUp className="h-3 w-3" />;
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return <Clock className="h-3 w-3" />;
      case 'AWAITING_PAYMENT':
        return <Clock className="h-3 w-3" />;
      case 'DRAFT':
        return <FileText className="h-3 w-3" />;
      case 'CANCELLED':
        return <XCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/clients/me/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProjects();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
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
            <h1 className="text-3xl font-bold text-white">My Projects</h1>
            <p className="text-slate-400 mt-1">Manage all your projects in one place</p>
          </div>
          <Link href="/client/projects/new">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
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

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-slate-200">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48 bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-slate-200">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-64 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedProjects.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700 text-center py-16">
            <CardContent>
              <FileText className="h-16 w-16 text-cyan-400/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No projects found</h3>
              <p className="text-slate-400 mb-6">
                {searchQuery || statusFilter 
                  ? 'No projects match your filters. Try adjusting your search criteria.'
                  : 'You have not created any projects yet.'}
              </p>
              <Link href="/client/projects/new">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedProjects.map((project) => (
              <Card
                key={project.id}
                className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/30 transition-colors"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link href={`/client/projects/${project.id}`} className="hover:underline">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          {project.title}
                          <Badge className={getStatusColor(project.status)}>
                            {getStatusIcon(project.status)}
                            {project.status}
                          </Badge>
                        </h3>
                      </Link>
                      <p className="text-slate-400 text-sm mt-2 line-clamp-2">
                        {project.description || 'No description provided'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Created: {formatDate(project.createdAt)}
                        </span>
                        {project.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Deadline: {formatDate(project.deadline)}
                          </span>
                        )}
                        {project.category && (
                          <span className="bg-slate-700/50 px-2 py-0.5 rounded">
                            {project.category}
                          </span>
                        )}
                        {project.serviceType && (
                          <span className="bg-slate-700/50 px-2 py-0.5 rounded">
                            {project.serviceType}
                          </span>
                        )}
                      </div>
                      {project.technologyStack && project.technologyStack.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {project.technologyStack.slice(0, 5).map((tech) => (
                            <Badge
                              key={tech}
                              variant="outline"
                              className="border-slate-600 text-slate-300 text-xs"
                            >
                              {tech}
                            </Badge>
                          ))}
                          {project.technologyStack.length > 5 && (
                            <Badge
                              variant="outline"
                              className="border-slate-600 text-slate-300 text-xs"
                            >
                              +{project.technologyStack.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      {project.budget !== null && (
                        <span className="text-xl font-bold text-emerald-400">
                          {formatCurrency(project.budget, project.currency)}
                        </span>
                      )}
                      <Link href={`/client/projects/${project.id}`}>
                        <Button
                          variant="outline"
                          className="border-slate-600 hover:bg-slate-700/80 text-white text-sm px-4 py-1.5"
                        >
                          View Details
                        </Button>
                      </Link>
                      {(project.status === 'DRAFT' || project.status === 'CANCELLED') && (
                        <Button
                          variant="destructive"
                          className="text-sm px-4 py-1.5"
                          onClick={() => handleDelete(project.id)}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > perPage && (
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total} projects
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700/80"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700/80"
                    disabled={page * perPage >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
