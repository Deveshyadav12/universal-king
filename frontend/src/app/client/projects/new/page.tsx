"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
  { value: 'Business', label: 'Business' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'Startup', label: 'Startup' },
  { value: 'Enterprise', label: 'Enterprise' },
  { value: 'Personal', label: 'Personal' },
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

const initialFormData: FormData = {
  title: '',
  description: '',
  category: '',
  serviceType: '',
  technologyStack: [],
  budget: '',
  currency: 'INR',
  deadline: '',
};

export default function CreateProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
          ? [...(prev[name] as string[]), value]
          : (prev[name] as string[]).filter(item => item !== value),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleTechnologyChange = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      technologyStack: checked
        ? [...prev.technologyStack, value]
        : prev.technologyStack.filter(tech => tech !== value),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title || formData.title.length < 3) {
      newErrors.title = 'Title is required and must be at least 3 characters';
    }
    
    if (!formData.description || formData.description.length < 10) {
      newErrors.description = 'Description is required and must be at least 10 characters';
    }
    
    if (!formData.serviceType) {
      newErrors.serviceType = 'Service type is required';
    }
    
    if (formData.budget && (isNaN(Number(formData.budget)) || Number(formData.budget) <= 0)) {
      newErrors.budget = 'Budget must be a positive number';
    }
    
    if (formData.deadline && new Date(formData.deadline) < new Date()) {
      newErrors.deadline = 'Deadline must be in the future';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setLoading(true);
    setServerError(null);
    
    try {
      const response = await fetch('/api/clients/me/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category || null,
          serviceType: formData.serviceType,
          technologyStack: formData.technologyStack.length > 0 ? formData.technologyStack : null,
          budget: formData.budget ? Number(formData.budget) : null,
          currency: formData.currency,
          deadline: formData.deadline || null,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setFormData(initialFormData);
          setSuccess(false);
          router.push('/client/projects');
        }, 3000);
      } else {
        setServerError(data.message || 'Failed to create project');
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
          <p className="text-slate-400 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'client') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/client/projects">
              <Button variant="ghost" className="text-slate-300 hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Create New Project</h1>
              <p className="text-slate-400 mt-1">Fill in the details below to create your project</p>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {success && (
          <Alert className="mb-6 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Project Created Successfully!</AlertTitle>
            <AlertDescription>
              Redirecting to your projects list...
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {serverError && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-xl text-white">Project Details</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              All fields marked with * are required
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium text-slate-300">
                  Project Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  placeholder="Enter project title"
                  value={formData.title}
                  onChange={handleChange}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
                {errors.title && (
                  <p className="text-sm text-red-400">{errors.title}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-300">
                  Project Description *
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe your project in detail. What are your requirements? What problem are you trying to solve?"
                  value={formData.description}
                  onChange={handleChange}
                  rows={5}
                  className="bg-slate-700/50 border-slate-600 text-white resize-none"
                />
                {errors.description && (
                  <p className="text-sm text-red-400">{errors.description}</p>
                )}
              </div>

              {/* Category and Service Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-slate-300">
                    Category
                  </Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {PROJECT_CATEGORIES.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-slate-200">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="serviceType" className="text-sm font-medium text-slate-300">
                    Service Type *
                  </Label>
                  <Select value={formData.serviceType} onValueChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}>
                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {SERVICE_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-slate-200">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.serviceType && (
                    <p className="text-sm text-red-400">{errors.serviceType}</p>
                  )}
                </div>
              </div>

              {/* Technology Stack */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-300">
                  Technology Stack
                </Label>
                <p className="text-xs text-slate-400 mb-2">
                  Select the technologies you prefer or need for this project
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {TECHNOLOGY_OPTIONS.map((tech) => (
                    <div
                      key={tech.value}
                      className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600 hover:bg-slate-700/80 transition-colors"
                    >
                      <Checkbox
                        id={`tech-${tech.value}`}
                        checked={formData.technologyStack.includes(tech.value)}
                        onCheckedChange={(checked) => handleTechnologyChange(tech.value, checked as boolean)}
                        className="border-slate-600"
                      />
                      <Label htmlFor={`tech-${tech.value}`} className="text-sm text-slate-300 cursor-pointer">
                        {tech.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {formData.technologyStack.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.technologyStack.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-xs rounded"
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
                  <Label htmlFor="budget" className="text-sm font-medium text-slate-300">
                    Budget (Optional)
                  </Label>
                  <Input
                    id="budget"
                    name="budget"
                    type="number"
                    placeholder="Enter your budget"
                    value={formData.budget}
                    onChange={handleChange}
                    min="0"
                    step="1000"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                  {errors.budget && (
                    <p className="text-sm text-red-400">{errors.budget}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency" className="text-sm font-medium text-slate-300">
                    Currency
                  </Label>
                  <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
                    <SelectTrigger className="w-full bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value} className="text-slate-200">
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-sm font-medium text-slate-300">
                  Deadline (Optional)
                </Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
                {errors.deadline && (
                  <p className="text-sm text-red-400">{errors.deadline}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-32"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mt-8 bg-slate-800/30 border-slate-700/50">
          <CardContent className="pt-6">
            <h3 className="font-medium text-white mb-3">Tips for a better project submission:</h3>
            <ul className="space-y-2 text-sm text-slate-400 list-disc list-inside">
              <li>Provide as much detail as possible in the description</li>
              <li>Specify your timeline expectations</li>
              <li>Mention any specific technologies or frameworks you prefer</li>
              <li>Set a realistic budget range if you have one in mind</li>
              <li>Be clear about your project goals and deliverables</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
