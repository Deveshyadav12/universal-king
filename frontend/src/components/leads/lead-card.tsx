"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Star, Clock, Globe, Building, Mail, Phone, User } from "lucide-react";

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

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
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
    if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    if (score >= 40) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  const truncate = (text: string | null, length: number = 25) => {
    if (!text) return null;
    return text.length > length ? text.slice(0, length) + "..." : text;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-cyan-500/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-white text-sm font-bold">
                {lead.company_name.slice(0, 2).toUpperCase()}
              </div>
              {truncate(lead.company_name, 20)}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {lead.industry || "Industry not specified"}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={`px-2 py-1 ${getScoreColor(lead.lead_score || 0)}`}>
              Score: {lead.lead_score || 0}/100
            </Badge>
            <Badge className={`px-2 py-1 ${getStatusColor(lead.qualification)}`}>
              {lead.qualification || "UNSCORED"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Contact Info */}
        <div className="space-y-2 text-sm">
          {lead.contact_name && (
            <div className="flex items-center gap-2 text-slate-300">
              <User className="h-4 w-4 text-cyan-400" />
              <span>{truncate(lead.contact_name, 25)}</span>
            </div>
          )}
          {lead.job_title && (
            <div className="flex items-center gap-2 text-slate-400">
              <Building className="h-4 w-4" />
              <span>{truncate(lead.job_title, 30)}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="h-4 w-4 text-cyan-400" />
              <span>{truncate(lead.email, 30)}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="h-4 w-4 text-cyan-400" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>

        {/* Website */}
        {lead.website && (
          <div className="text-sm">
            <a 
              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span>{truncate(lead.website, 30) || "Website"}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Location and Size */}
        <div className="flex flex-wrap gap-2 text-sm">
          {lead.location && (
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {truncate(lead.location, 20)}
            </Badge>
          )}
          {lead.company_size && (
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              Size: {lead.company_size}
            </Badge>
          )}
          {lead.target_size_segment && (
            <Badge variant="outline" className="border-cyan-600 text-cyan-300">
              Target: {lead.target_size_segment}
            </Badge>
          )}
        </div>

        {/* Description */}
        {lead.description && (
          <div className="text-sm text-slate-400 line-clamp-3">
            {lead.description}
          </div>
        )}

        {/* AI Processing Info */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {lead.ai_processed && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <span>AI Processed</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(lead.created_at)}</span>
            </div>
          </div>
          <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
            {lead.source || "AI Discovery"}
          </Badge>
        </div>

        {/* Score Reasons */}
        {lead.score_reasons && lead.score_reasons.length > 0 && (
          <div className="pt-2 border-t border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Scoring Factors:</div>
            <div className="space-y-1">
              {lead.score_reasons.slice(0, 3).map((reason, index) => (
                <div key={index} className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="text-emerald-400">+</span>
                  <span>{reason}</span>
                </div>
              ))}
              {lead.score_reasons.length > 3 && (
                <div className="text-xs text-slate-500">
                  +{lead.score_reasons.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
