import React, { useEffect, useRef, type ReactNode } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation 
} from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthProvider';
import { ThemeProvider } from './ThemeProvider';
import { SidebarProvider, useSidebar } from './SidebarContext';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ForgotPassword from './components/ForgotPassword';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Settings from './components/Settings';
import UserManagement from './components/UserManagement';
import DemographicSettings from './components/DemographicSettings';
import VoterManagement from './components/VoterManagement';
import VoterSurvey from './components/VoterSurvey';
import ElectionSetup from './components/ElectionSetup';
import SurveyManagement from './components/SurveyManagement';
import ResetPassword from './components/ResetPassword';
import Navigation from './components/Navigation';
import VolunteerManagement from './components/VolunteerManagement';
import BoothAgentManagement from './components/BoothAgentManagement';
import Benefits from './components/Benefits';
import { PredictionsAnalytics } from './components/PredictionsAnalytics';
import AdminSentimentComparison from './components/AdminSentimentComparison';
import FinanceTracker from './components/FinanceTracker';
import WBSender from './components/WBSender';
import MandalManagement from './components/MandalManagement';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import BroadcastFeedView from './components/BroadcastFeedView';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTo(0, 0);
    document.body.scrollTo(0, 0);
    const scrollContainers = document.querySelectorAll('main, [data-scroll-container]');
    scrollContainers.forEach((el) => {
      el.scrollTo(0, 0);
    });
  }, [pathname, search]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isCollapsed } = useSidebar();
  const { pathname } = useLocation();
  const mainRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    window.scrollTo(0, 0);
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row">
      <Navigation />
      <main ref={mainRef} className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-200 min-h-screen ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-6 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}

function PermissionRoute({ children, moduleId }: { children: React.ReactNode, moduleId: string }) {
  const { profile, isSuperAdmin, user, loading } = useAuth();
  
  if (loading) return null;
  
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isSuper = isSuperAdmin || userEmail === 'vijaychauhanofficial01@gmail.com';
  const userRole = (profile?.role || (user as any)?.role || '').toLowerCase();

  // Super admins and dashboard route are always allowed
  if (isSuper || userRole === 'super_admin' || moduleId === 'dashboard') {
    return <>{children}</>;
  }

  if (!profile || profile.disabled || userRole === 'guest') {
    return <Navigate to="/dashboard" replace />;
  }

  const permKey = moduleId === 'predictions'
    ? (profile.permissions?.predictions ?? profile.permissions?.analytics ?? profile.rights?.predictions ?? profile.rights?.analytics)
    : (moduleId === 'survey_campaigns' ? (profile.permissions?.survey_campaigns ?? profile.permissions?.surveys ?? profile.rights?.survey_campaigns ?? profile.rights?.surveys)
    : (profile.permissions?.[moduleId] ?? profile.rights?.[moduleId]));

  const hasAccess = Boolean(
    permKey === true || 
    permKey === 1 || 
    permKey === '*' ||
    (typeof permKey === 'string' && permKey.length > 0) ||
    (Array.isArray(permKey) && permKey.length > 0)
  );
  
  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, isSuperAdmin, user, loading } = useAuth();
  
  if (loading) return null;
  
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isSuper = isSuperAdmin || userEmail === 'vijaychauhanofficial01@gmail.com';

  if (!isSuper) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AuthProvider>
          <Router>
            <ScrollToTop />
            <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Public Legal & Policy Pages (accessible without login) */}
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />

            {/* Public WhatsApp Extension Live Stream Feeds (Token-verified, accessible without app login) */}
            <Route path="/broadcast-feed/:token" element={<BroadcastFeedView />} />
            <Route path="/voter-feed/:token" element={<BroadcastFeedView />} />
            <Route path="/w/:token" element={<BroadcastFeedView />} />
            
            <Route path="/dashboard" element={<ProtectedRoute><PermissionRoute moduleId="dashboard"><Dashboard /></PermissionRoute></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><PermissionRoute moduleId="users"><UserManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/surveys" element={<ProtectedRoute><PermissionRoute moduleId="survey_campaigns"><SurveyManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/demographics" element={<ProtectedRoute><PermissionRoute moduleId="demographics"><DemographicSettings /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/elections" element={<ProtectedRoute><PermissionRoute moduleId="elections"><ElectionSetup /></PermissionRoute></ProtectedRoute>} />
            <Route path="/voters" element={<ProtectedRoute><PermissionRoute moduleId="voters"><VoterManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/surveys" element={<ProtectedRoute><PermissionRoute moduleId="surveys"><VoterSurvey /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/volunteers" element={<ProtectedRoute><PermissionRoute moduleId="volunteers"><VolunteerManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/booths" element={<ProtectedRoute><PermissionRoute moduleId="booths"><BoothAgentManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/benefits" element={<ProtectedRoute><PermissionRoute moduleId="benefits"><Benefits /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/finance" element={<ProtectedRoute><PermissionRoute moduleId="finance"><FinanceTracker /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/whatsapp" element={<ProtectedRoute><PermissionRoute moduleId="whatsapp"><WBSender /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/mandals" element={<ProtectedRoute><PermissionRoute moduleId="mandals"><MandalManagement /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute><PermissionRoute moduleId="predictions"><PredictionsAnalytics /></PermissionRoute></ProtectedRoute>} />
            <Route path="/admin/sentiment-comparison" element={<ProtectedRoute><PermissionRoute moduleId="sentiment_comparison"><AdminSentimentComparison /></PermissionRoute></ProtectedRoute>} />
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
