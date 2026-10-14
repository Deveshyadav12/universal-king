"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Building, ArrowLeft, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ClientProfile {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  companyRole: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ClientProfilePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'client')) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/clients/me/profile');
      if (response.ok) {
        const data = await response.json();
        const profileData = data.profile || data;
        setProfile(profileData);
        setName(profileData.name || '');
        setCompanyName(profileData.companyName || '');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'client') {
      fetchProfile();
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const response = await fetch('/api/clients/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          companyName: companyName || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile || data);
        setEditing(false);
        setSuccess('Profile updated successfully!');
        
        // Refresh auth state if name changed
        if (name !== user?.name) {
          // In a real app, you might want to trigger a re-authentication
          // For now, just show success message
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setSuccess(null);
    setSaving(true);

    // Validate
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      setSaving(false);
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/clients/me/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('Password changed successfully!');
      } else {
        const errorData = await response.json();
        setPasswordError(errorData.message || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSaving(false);
    }
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
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/client/dashboard">
            <Button variant="outline" className="border-slate-600 hover:bg-slate-700/80">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">My Profile</h1>
            <p className="text-slate-400 mt-1">Manage your account information</p>
          </div>
        </div>

        {/* Error/Success Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <X className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" className="mb-6">
            <Check className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Profile Card */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Account Information</CardTitle>
            <CardDescription className="text-slate-400">
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    required
                    minLength={2}
                    maxLength={100}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-slate-300">
                    Company Name (Optional)
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter your company name"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    maxLength={120}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">
                    Email Address
                  </Label>
                  <p className="text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">
                    Email cannot be changed. Contact support if you need to update it.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditing(false)}
                    className="border-slate-600 hover:bg-slate-700/80"
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-cyan-600 hover:bg-cyan-700"
                    disabled={saving}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        Saving...
                      </span>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{profile?.name || user.name}</h3>
                    <p className="text-slate-400">{user.email}</p>
                  </div>
                </div>
                
                {profile?.companyName && (
                  <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                    <Building className="h-5 w-5 text-cyan-400" />
                    <div>
                      <p className="text-sm text-slate-300">Company</p>
                      <p className="font-medium text-white">{profile.companyName}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <Mail className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-sm text-slate-300">Email</p>
                    <p className="font-medium text-white">{user.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                  <div>
                    <p className="text-sm text-slate-400">Account Created</p>
                    <p className="font-medium text-white">{formatDate(profile?.createdAt || user.createdAt || new Date().toISOString())}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Last Updated</p>
                    <p className="font-medium text-white">{formatDate(profile?.updatedAt || profile?.createdAt || new Date().toISOString())}</p>
                  </div>
                </div>
                
                <Button
                  onClick={() => setEditing(true)}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Edit Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Change Password</CardTitle>
            <CardDescription className="text-slate-400">
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-slate-300">
                  Current Password
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-slate-300">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter a new password (min 8 characters)"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                  minLength={8}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  required
                />
              </div>
              
              {passwordError && (
                <Alert variant="destructive" className="mb-4">
                  <X className="h-4 w-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit" 
                className="bg-amber-600 hover:bg-amber-700"
                disabled={saving}
              >
                {saving ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-slate-800/50 border-red-700/30 mt-8">
          <CardHeader>
            <CardTitle className="text-red-400">Danger Zone</CardTitle>
            <CardDescription className="text-red-400/60">
              Irreversible actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <X className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white">Delete Account</h4>
                <p className="text-sm text-slate-400">
                  Permanently delete your account and all associated data.
                  This action cannot be undone.
                </p>
              </div>
              <Button 
                variant="destructive" 
                className="text-sm"
                onClick={() => {
                  if (confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.')) {
                    router.push('/client/delete-account');
                  }
                }}
              >
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
