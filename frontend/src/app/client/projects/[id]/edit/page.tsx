"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FileText, Loader2, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

interface TechnologyOption {
  value: string;
  label: string;
}

const SERVICE_TYPES = [
  { value: '', label: 'Select Service Type' },
  { value: 'Web Development', label: 'Web Development' },
  { value: 'Mobile App Development', label: 'Mobile App Development' },
  { value: 'Software Development', label: 'Software Development' },
  { value: 'AI/ML Solutions', label: 'AI/ML Solutions' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
  { value: 'Consulting', label: 'Consulting' },
  { value: 'Maintenance', label: 'Maintenance & Support' },
  { value: 'Other', label: 'Other' },
];

const PROJECT_CATEGORIES = [
  { value: '', label: 'Select Category' },
  { value: 'Web Development', label: 'Web Development' },
  { value: 'Mobile App', label: 'Mobile App' },
  { value: 'Software Development', label: 'Software Development' },
  { value: 'AI/ML Solutions', label: 'AI/ML Solutions' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'UI/UX Design', label: 'UI/UX Design' },
  { value: 'Consulting', label: 'Consulting' },
  { value: 'Other', label: 'Other' },
];

const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
];

const TECHNOLOGY_OPTIONS: TechnologyOption[] = [
  { value: 'React', label: 'React' },
  { value: 'Next.js', label: 'Next.js' },
  { value: 'Node.js', label: 'Node.js' },
  { value: 'Express', label: 'Express' },
  { value: 'NestJS', label: 'NestJS' },
  { value: 'Python', label: 'Python' },
  { value: 'Django', label: 'Django' },
  { value: 'Flask', label: 'Flask' },
  { value: 'Vue.js', label: 'Vue.js' },
  { value: 'Angular', label: 'Angular' },
  { value: 'TypeScript', label: 'TypeScript' },
  { value: 'JavaScript', label: 'JavaScript' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MongoDB', label: 'MongoDB' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'Redis', label: 'Redis' },
  { value: 'Docker', label: 'Docker' },
  { value: 'AWS', label: 'AWS' },
  { value: 'Tailwind CSS', label: 'Tailwind CSS' },
  { value: 'HTML/CSS', label: 'HTML/CSS' },
  { value: 'Other', label: 'Other' },
];

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

interface FormData {
  title: string;
  description: string;
  category: string;
  serviceType: string;
  technologyStack: string[];
  budget: string;
  currency: string;
  deadline: string;
}

export default function EditProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    serviceType: '',
    technologyStack: [],
    budget: '',
    currency: 'INR',
    deadline: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchProject = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/clients/me/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        const projectData = data.project || data;
        setProject(projectData);
        
        // Populate form data
        setFormData({
          title: projectData.title || '',
          description: projectData.description || '',
          category: projectData.category || '',
          serviceType: projectData.serviceType || '',
          technologyStack: projectData.technologyStack || [],
          budget: projectData.budget ? String(projectData.budget) : '',
          currency: projectData.currency || 'INR',
          deadline: projectData.deadline ? new Date(projectData.deadline).toISOString().slice(0, 10) : '',
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch project');
        // Redirect to projects list if not found
        setTimeout(() => router.push('/client/projects'), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client' && projectId) {
      fetchProject();
    }
  }, [user, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    // Validate
    if (!formData.title.trim()) {
      setError('Project title is required');
      setSaving(false);
      return;
    }
    
    if (formData.budget && isNaN(Number(formData.budget))) {
      setError('Budget must be a valid number');
      setSaving(false);
      return;
    }
    
    if (formData.deadline && new Date(formData.deadline) < new Date()) {
      setError('Deadline must be in the future');
      setSaving(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category || null,
        serviceType: formData.serviceType || null,
        technologyStack: formData.technologyStack.length > 0 ? formData.technologyStack : null,
        budget: formData.budget ? Number(formData.budget) : null,
        currency: formData.currency,
        deadline: formData.deadline || null,
      };
      
      const response = await fetch(`/api/clients/me/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project || data);
        setSuccess('Project updated successfully!');
        
        // Redirect to project details after a delay
        setTimeout(() => {
          router.push(`/client/projects/${projectId}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update project');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/client/projects/${projectId}`);
  };

  const handleTechnologyToggle = (tech: string) => {
    const currentIndex = formData.technologyStack.indexOf(tech);
    const newTechStack = [...formData.technologyStack];
    
    if (currentIndex === -1) {
      newTechStack.push(tech);
    } else {
      newTechStack.splice(currentIndex, 1);
    }
    
    setFormData({ ...formData, technologyStack: newTechStack });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
              <div className="space-y-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
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
              The project you are looking for does not exist or you do not have permission to access it.
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
            <FileText className="h-8 w-8 text-cyan-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Edit Project</h1>
              <p className="text-slate-400 mt-1">
                Update your project details below
              </p>
            </div>
          </div>
        </div>

        {/* Error/Success Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" className="mb-6">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Project Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Project Details</CardTitle>
            <CardDescription className="text-slate-400">
              Update your project information. All fields can be edited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-300">
                  Project Title *
                </Label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter project title"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                  minLength={3}
                  maxLength={255}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-300">
                  Project Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your project in detail. Include requirements, objectives, and any specific features you need."
                  className="bg-slate-700/50 border-slate-600 text-white min-h-[120px]"
                  maxLength={4000}
                />
              </div>

              {/* Category and Service Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-slate-300">
                    Category
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {PROJECT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-slate-200">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceType" className="text-slate-300">
                    Service Type
                  </Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => setFormData({ ...formData, serviceType: value })}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {SERVICE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="text-slate-200">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Technology Stack */}
              <div className="space-y-2">
                <Label className="text-slate-300">
                  Technology Stack
                </Label>
                <p className="text-sm text-slate-400">
                  Select the technologies you want to use for this project
                </p>
                <div className="flex flex-wrap gap-3 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                  {TECHNOLOGY_OPTIONS.map((tech) => (
                    <label
                      key={tech.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        id={`tech-${tech.value}`}
                        checked={formData.technologyStack.includes(tech.value)}
                        onCheckedChange={() => handleTechnologyToggle(tech.value)}
                        className="border-slate-500 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                      />
                      <span className="text-slate-300 text-sm">{tech.label}</span>
                    </label>
                  ))}
                </div>
                {formData.technologyStack.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="text-sm text-slate-400">Selected:</span>
                    {formData.technologyStack.map((tech) => (
                      <span
                        key={tech}
                        className="bg-cyan-600/20 text-cyan-400 text-xs px-2 py-0.5 rounded"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Budget and Currency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="budget" className="text-slate-300">
                    Budget (Optional)
                  </Label>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="Enter budget amount"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    min={0}
                    max={10000000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-slate-300">
                    Currency
                  </Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value} className="text-slate-200">
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-slate-300">
                  Deadline (Optional)
                </Label>
                <div className="relative">
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              </div>

              {/* Created Info */}
              <div className="pt-4 border-t border-slate-700/50">
                <p className="text-sm text-slate-400">
                  Created: {formatDate(project?.createdAt || '')}
                </p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-4 pt-6 border-t border-slate-700/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="border-slate-600 hover:bg-slate-700/80 text-white"
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 min-w-[150px]"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
