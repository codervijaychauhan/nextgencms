import React from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate 
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
import FinanceTracker from './components/FinanceTracker';
import WBSender from './components/WBSender';
import MandalManagement from './components/MandalManagement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isCollapsed } = useSidebar();

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300 flex flex-col md:flex-row">
      <Navigation />
      <main className={`flex-1 min-w-0 overflow-x-hidden transition-all duration-300 min-h-screen bg-zinc-50 dark:bg-zinc-950 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="max-w-full mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 min-w-0">
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
  const { profile, isAdmin, loading } = useAuth();
  
  if (loading) return null;
  
  const canAccess = isAdmin || moduleId === 'dashboard' || (profile?.permissions?.[moduleId]?.includes('v'));
  
  if (!canAccess) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AuthProvider>
          <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
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
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Router>
      </AuthProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
