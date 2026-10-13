"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Eye, Star, TrendingUp, TrendingDown, Minus } from "lucide-react";

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

interface LeadTableProps {
  leads: Lead[];
}

export function LeadTable({ leads }: LeadTableProps) {
  const [sortBy, setSortBy] = useState<keyof Lead | null>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const getScoreTrend = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-4 w-4 text-emerald-400" />;
    if (score >= 60) return <TrendingUp className="h-4 w-4 text-amber-400" />;
    if (score >= 40) return <Minus className="h-4 w-4 text-orange-400" />;
    return <TrendingDown className="h-4 w-4 text-slate-400" />;
  };

  const handleSort = (column: keyof Lead) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const sortedLeads = [...leads].sort((a, b) => {
    if (!sortBy) return 0;
    
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString();
  };

  const truncate = (text: string | null, length: number = 30) => {
    if (!text) return "-";
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  const getSortIndicator = (column: keyof Lead) => {
    if (sortBy !== column) return null;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-slate-700/50">
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("company_name")}
            >
              Company {getSortIndicator("company_name")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("contact_name")}
            >
              Contact {getSortIndicator("contact_name")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("industry")}
            >
              Industry {getSortIndicator("industry")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("location")}
            >
              Location {getSortIndicator("location")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white text-right"
              onClick={() => handleSort("lead_score")}
            >
              Score {getSortIndicator("lead_score")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("qualification")}
            >
              Qualification {getSortIndicator("qualification")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white"
              onClick={() => handleSort("status")}
            >
              Status {getSortIndicator("status")}
            </TableHead>
            <TableHead 
              className="text-slate-300 text-sm font-medium cursor-pointer hover:text-white text-right"
              onClick={() => handleSort("created_at")}
            >
              Discovered {getSortIndicator("created_at")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLeads.map((lead) => (
            <TableRow 
              key={lead.id} 
              className="border-slate-700 hover:bg-slate-700/50 transition-colors"
            >
              <TableCell className="text-slate-200">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white text-xs font-bold">
                    {lead.company_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-white">{truncate(lead.company_name, 25)}</div>
                    {lead.website && (
                      <a 
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {truncate(lead.website, 20)}
                      </a>
                    )}
                  </div>
                </div>
              </TableCell>
              
              <TableCell className="text-slate-300 text-sm">
                {lead.contact_name || lead.job_title || "-"}
              </TableCell>
              
              <TableCell className="text-slate-300 text-sm">
                {lead.industry || "-"}
              </TableCell>
              
              <TableCell className="text-slate-300 text-sm">
                {truncate(lead.location, 20)}
              </TableCell>
              
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span className={`font-bold ${getScoreColor(lead.lead_score || 0)}`}>
                    {lead.lead_score || 0}
                  </span>
                  {getScoreTrend(lead.lead_score || 0)}
                </div>
              </TableCell>
              
              <TableCell>
                <Badge className={`px-2 py-1 ${getStatusColor(lead.qualification)}`}>
                  {lead.qualification || "UNSCORED"}
                </Badge>
              </TableCell>
              
              <TableCell className="text-slate-300 text-sm">
                <div className="flex items-center gap-2">
                  {lead.ai_processed && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                  <span>{lead.status}</span>
                </div>
              </TableCell>
              
              <TableCell className="text-right text-slate-400 text-sm">
                {formatDate(lead.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
