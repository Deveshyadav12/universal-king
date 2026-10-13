"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Loader2, Database, Brain, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadCard } from "@/components/leads/lead-card";

interface Lead {
  id: string;
  lead_token: string;
  company_name: string;
  contact_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  target_size_segment: string | null;
  location: string | null;
  source: string | null;
  source_url: string | null;
  description: string | null;
  lead_score: number;
  score_reasons: string[];
  qualification: string;
  status: string;
  ai_processed: boolean;
  ai_analyzed: boolean;
  created_at: string;
  updated_at: string;
}

interface DiscoveryStatus {
  isRunning: boolean;
  dailyLeadsAdded: number;
  dailyLeadLimit: number;
  queueSize: number;
  activeQueries: number;
}

interface AIStatus {
  success: boolean;
  service: string;
  status: string;
  version: string;
  workspaces: number;
  offline: boolean;
  ai_online?: boolean;
}

interface Stats {
  totalLeads: number;
  discoveredToday: number;
  aiProcessed: number;
  highPriority: number;
  averageScore: number;
}

export default function CRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Fetch all data automatically
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data in parallel
      const [leadsRes, discoveryRes, aiRes] = await Promise.allSettled([
        fetch("/api/leads"),
        fetch("/api/leads/auto-discovery/status"),
        fetch("/api/leads/ai/status"),
      ]);

      // Process leads
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const data = await leadsRes.value.json();
        setLeads(data.leads || data || []);
      }

      // Process discovery status
      if (discoveryRes.status === "fulfilled" && discoveryRes.value.ok) {
        const data = await discoveryRes.value.json();
        setDiscoveryStatus(data);
      }

      // Process AI status
      if (aiRes.status === "fulfilled" && aiRes.value.ok) {
        const data = await aiRes.value.json();
        setAiStatus(data);
      }

      // Calculate stats
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const leadsData = await leadsRes.value.json();
        const allLeads = leadsData.leads || leadsData || [];
        calculateStats(allLeads);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (leads: Lead[]) => {
    const total = leads.length;
    const today = new Date().toISOString().slice(0, 10);
    const discoveredToday = leads.filter(l => l.created_at?.startsWith(today)).length;
    const aiProcessed = leads.filter(l => l.ai_processed).length;
    const highPriority = leads.filter(l => l.qualification === "HIGH_PRIORITY").length;
    const scores = leads.map(l => l.lead_score || 0).filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    setStats({
      totalLeads: total,
      discoveredToday,
      aiProcessed,
      highPriority,
      averageScore: Math.round(avgScore),
    });
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const getStatusColor = (qualification: string) => {
    switch (qualification) {
      case "HIGH_PRIORITY": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "GOOD": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "MEDIUM": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "LOW": return "bg-slate-500/20 text-slate-400 border-slate-500/30";
      default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    if (score >= 40) return "text-orange-400";
    return "text-slate-400";
  };

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">CRM Dashboard</h1>
              <p className="text-slate-400 mt-1">Automatic AI-Powered Lead Discovery & Management</p>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-24" />
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-6" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Discovery Section */}
          <Card className="bg-slate-800/50 border-slate-700 mb-8">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-full mt-2" />
            </CardHeader>
          </Card>

          {/* Leads Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">CRM Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Automatic AI-Powered Lead Discovery & Management System
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-slate-600 hover:bg-slate-700/80 hover:text-white"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                onClick={() => setViewMode("table")}
                className="px-3 py-1 text-xs"
              >
                Table
              </Button>
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                onClick={() => setViewMode("cards")}
                className="px-3 py-1 text-xs"
              >
                Cards
              </Button>
            </div>
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
              <CardTitle className="text-sm font-medium text-slate-300">Total Leads</CardTitle>
              <Database className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalLeads || 0}</div>
              <CardDescription className="text-xs text-slate-400">
                All discovered leads
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Today's Leads</CardTitle>
              <Clock className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats?.discoveredToday || 0}</div>
              <CardDescription className="text-xs text-slate-400">
                Discovered today
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">AI Processed</CardTitle>
              <Brain className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{stats?.aiProcessed || 0}</div>
              <CardDescription className="text-xs text-slate-400">
                Leads processed by AI
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">High Priority</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats?.highPriority || 0}</div>
              <CardDescription className="text-xs text-slate-400">
                High priority leads
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* AI Status Alert */}
        {aiStatus && (
          <Alert 
            variant={aiStatus.offline || aiStatus.ai_online === false ? "destructive" : "default"} 
            className="mb-6"
          >
            {aiStatus.offline || aiStatus.ai_online === false ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              AI Service: {aiStatus.offline || aiStatus.ai_online === false ? "Offline (Fallback Active)" : "Online"}
            </AlertTitle>
            <AlertDescription>
              {aiStatus.offline || aiStatus.ai_online === false 
                ? "AI service is currently offline. Using automatic fallback strategies for all operations."
                : `AI service is online and processing requests. Version: ${aiStatus.version}`}
            </AlertDescription>
          </Alert>
        )}

        {/* Automatic Discovery Section */}
        <Card className="mb-8 bg-gradient-to-r from-slate-800/50 to-cyan-800/20 border-cyan-700/30">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">
                  Automatic AI Lead Discovery
                </CardTitle>
                <CardDescription className="text-sm text-cyan-200/60 mt-1">
                  AI automatically discovers, qualifies, and scores leads from multiple industries and markets. 
                  All leads are stored in PostgreSQL with automatic processing.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300">
                  Status: <span className="font-semibold text-emerald-400">Running automatically</span>
                </span>
              </div>
              <div className="text-slate-300">
                Today: <span className="font-semibold text-white">{discoveryStatus?.dailyLeadsAdded || 0}</span> leads
              </div>
              <div className="text-slate-300">
                Limit: <span className="font-semibold text-white">{discoveryStatus?.dailyLeadLimit || 100}</span> per day
              </div>
              <div className="text-slate-300">
                Queue: <span className="font-semibold text-white">{discoveryStatus?.queueSize || 0}</span> queries
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-700/30 rounded-lg text-xs text-slate-300">
              <strong>Note:</strong> Lead discovery runs continuously in the background. 
              No manual action required - AI automatically finds and qualifies new leads 24/7.
            </div>
          </CardContent>
        </Card>

        {/* Leads Display */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Discovered Leads ({leads.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                {leads.filter(l => l.ai_processed).length} AI Processed
              </Badge>
              <Badge variant="outline" className="border-emerald-600 text-emerald-300">
                Average Score: {Math.round(leads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / (leads.length || 1))}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-cyan-400/50 mb-4" />
                <p className="text-slate-400 text-center mb-2">
                  No leads discovered yet
                </p>
                <p className="text-slate-500 text-sm text-center">
                  AI is working in the background. Leads will appear automatically.
                </p>
                <Button 
                  variant="ghost" 
                  onClick={handleRefresh}
                  className="mt-4 text-cyan-300 hover:text-cyan-200"
                >
                  Check again
                </Button>
              </div>
            ) : viewMode === "table" ? (
              <LeadTable leads={leads} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
