import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, User, LayoutDashboard, Menu, X, Bell, 
  Command, Sun, Moon, ChevronUp, Settings, Users,
  ChevronLeft, ChevronRight, Database, Flag, BarChart3, ClipboardList,
  Building2, Gift, TrendingUp, UserCog, Wallet, MessageSquare, Layers
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../ThemeProvider';
import { useSidebar } from '../SidebarContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Navigation() {
  const { signOut, user, isAdmin, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canAccess = (moduleId: string) => {
    if (isAdmin) return true; // super_admin or owner
    if (!profile) return false;
    
    // Explicit module check
    const perms = profile.permissions?.[moduleId] || '';
    return perms.includes('v');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, alwaysShow: true },
    { name: 'Voters', path: '/voters', icon: Users, moduleId: 'voters' },
    { name: 'Karyakartas', path: '/admin/volunteers', icon: Users, moduleId: 'volunteers' },
    { name: 'Mandal Management', path: '/admin/mandals', icon: Layers, moduleId: 'mandals' },
    { name: 'Booth Management', path: '/admin/booths', icon: Building2, moduleId: 'booths' },
    { name: 'Benefits', path: '/admin/benefits', icon: Gift, moduleId: 'benefits' },
    { name: 'Finance Tracker', path: '/admin/finance', icon: Wallet, moduleId: 'finance' },
    { name: 'WB Sender', path: '/admin/whatsapp', icon: MessageSquare, moduleId: 'whatsapp' },
    { name: 'Survey', path: '/surveys', icon: BarChart3, moduleId: 'surveys' },
    { name: 'Analytics', path: '/admin/analytics', icon: TrendingUp, moduleId: 'predictions' }
  ];

  const adminItems = [
    { name: 'User Management', path: '/admin/users', icon: UserCog, moduleId: 'users' },
    { name: 'Survey Management', path: '/admin/surveys', icon: ClipboardList, moduleId: 'survey_campaigns' },
    { name: 'Election Setting', path: '/admin/demographics', icon: Flag, moduleId: 'demographics' },
    { name: 'Election Setup', path: '/admin/elections', icon: Database, moduleId: 'elections' },
  ];

  const SidebarContent = ({ isMobile = false }) => {
    const filteredNavItems = navItems.filter(item => item.alwaysShow || canAccess(item.moduleId || ''));
    const filteredAdminItems = adminItems.filter(item => canAccess(item.moduleId || ''));
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-950 transition-all duration-300">
      {/* Brand Header */}
      <div className={`h-16 flex items-center border-b border-zinc-200 dark:border-zinc-800 transition-all duration-300 relative ${isCollapsed && !isMobile ? 'px-4 justify-center' : 'px-6'}`}>
        <Link to="/" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
          <div className="w-7 h-7 bg-zinc-950 dark:bg-zinc-100 rounded flex items-center justify-center shrink-0">
            <Command size={16} className="text-white dark:text-zinc-950" />
          </div>
          {(!isCollapsed || isMobile) && (
            <span className="font-bold tracking-tight text-zinc-900 dark:text-white transition-opacity duration-300">NextGen CMS </span>
          )}
        </Link>
        {!isMobile && (
          <button 
            onClick={toggleSidebar}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 shadow-sm hover:text-zinc-900 dark:hover:text-white transition-all z-20"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto px-3 py-5 transition-all duration-300 ${isCollapsed && !isMobile ? 'space-y-4' : 'space-y-7'}`}>
        {/* Navigation Section */}
        <div>
          {(!isCollapsed || isMobile) ? (
            <h3 className="px-3 mb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap overflow-hidden">Main Menu</h3>
          ) : (
            <div className="h-px bg-zinc-100 dark:bg-zinc-800 mb-4 mx-2" />
          )}
          <nav className="space-y-0.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsUserMenuOpen(false);
                  }}
                  title={isCollapsed && !isMobile ? item.name : undefined}
                  className={`webapp-sidebar-item overflow-hidden ${
                    isCollapsed && !isMobile ? 'justify-center px-0' : ''
                  } ${
                    isActive 
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  }`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
                  {(!isCollapsed || isMobile) && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Admin Section */}
        {filteredAdminItems.length > 0 && (
          <div>
            {(!isCollapsed || isMobile) ? (
              <h3 className="px-3 mb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap overflow-hidden">Administration</h3>
            ) : (
              <div className="h-px bg-zinc-100 dark:bg-zinc-800 mb-4 mx-2" />
            )}
            <nav className="space-y-0.5">
              {filteredAdminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    title={isCollapsed && !isMobile ? item.name : undefined}
                    className={`webapp-sidebar-item overflow-hidden ${
                      isCollapsed && !isMobile ? 'justify-center px-0' : ''
                    } ${
                      isActive 
                        ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
                    {(!isCollapsed || isMobile) && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

      </div>

      {/* User Footer */}
      <div className={`p-4 mt-auto border-t border-zinc-200 dark:border-zinc-800 relative transition-all duration-300 ${isCollapsed && !isMobile ? 'flex justify-center' : ''}`} ref={userMenuRef}>
        {/* Dropup Menu */}
        <AnimatePresence>
          {isUserMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`absolute bottom-full mb-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 ${
                isCollapsed && !isMobile ? 'left-4 w-48' : 'left-4 right-4'
              }`}
            >
              <div className="p-2 space-y-0.5">
                <Link
                  to="/profile"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <User size={14} className="shrink-0" />
                  My Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  <Settings size={14} className="shrink-0" />
                  Settings
                </Link>
                <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1 mx-2" />
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                >
                  {theme === 'light' ? <Moon size={14} className="shrink-0" /> : <Sun size={14} className="shrink-0" />}
                  Dark Mode
                </button>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <LogOut size={14} className="shrink-0" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          className={`group transition-all text-left ${
            isCollapsed && !isMobile 
              ? 'p-0 h-8 w-8 rounded-full overflow-hidden' 
              : `w-full flex items-center gap-3 p-2 rounded-xl ${isUserMenuOpen ? 'bg-zinc-50 dark:bg-zinc-900 shadow-sm' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`
          }`}
        >
          <div className={`rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-950 font-bold text-xs shrink-0 ring-2 ring-transparent group-hover:ring-zinc-200 dark:group-hover:ring-zinc-800 transition-all ${
            isCollapsed && !isMobile ? 'h-8 w-8' : 'w-8 h-8'
          }`}>
            {user?.email?.[0].toUpperCase()}
          </div>
          {(!isCollapsed || isMobile) && (
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate flex items-center justify-between">
                {user?.displayName || 'User'}
                <ChevronUp size={12} className={`text-zinc-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </p>
              <p className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                <span className="capitalize">{user?.email?.split('@')[0]}</span>
                <span className="opacity-50">•</span>
                <span className="uppercase text-[9px] font-bold tracking-tighter text-blue-600 dark:text-blue-400">
                  {profile?.role?.replace('_', ' ') || 'Guest'}
                </span>
              </p>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col border-r border-zinc-200 dark:border-zinc-800 z-30 shadow-sm transition-all duration-300 ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 h-14 flex items-center justify-between px-4 z-40">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-zinc-950 dark:bg-zinc-100 rounded flex items-center justify-center">
            <Command size={14} className="text-white dark:text-zinc-950" />
          </div>
          <span className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-tight">Command</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="text-zinc-400 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="text-zinc-400 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg">
            <Bell size={18} />
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-zinc-950 z-[60] md:hidden shadow-xl"
            >
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
              >
                <X size={20} />
              </button>
              <SidebarContent isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
