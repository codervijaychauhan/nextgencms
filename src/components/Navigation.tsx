import React, { useState, useRef, useEffect } from 'react';
import {
  LogOut, User, LayoutDashboard, Menu, X, Bell,
  Command, Sun, Moon, ChevronUp, Settings, Users,
  ChevronLeft, ChevronRight, Database, Flag, BarChart3, ClipboardList,
  Building2, Gift, TrendingUp, UserCog, Wallet, MessageSquare, Layers,
  Search, ShieldCheck, Sparkles, ExternalLink
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthProvider';
import { useTheme } from '../ThemeProvider';
import { useSidebar } from '../SidebarContext';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

export default function Navigation() {
  const { signOut, user, isSuperAdmin, profile } = useAuth();
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

  const canAccess = (item: { moduleId?: string; alwaysShow?: boolean; superAdminOnly?: boolean }) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    const isSuper = userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin;
    if (item.superAdminOnly) {
      return isSuper;
    }
    if (isSuper) return true;
    if (item.alwaysShow) return true;
    if (!profile || profile.role === 'guest' || profile.disabled) return false;

    const userRole = (profile.role || (user as any)?.role || '').toLowerCase();
    if (userRole === 'super_admin') return true;

    const moduleId = item.moduleId || '';
    if (!moduleId) return false;

    const perms = profile.permissions?.[moduleId] ?? profile.rights?.[moduleId] ?? 
      (moduleId === 'predictions' ? (profile.permissions?.analytics ?? profile.rights?.analytics) : undefined) ??
      (moduleId === 'survey_campaigns' ? (profile.permissions?.surveys ?? profile.rights?.surveys) : undefined);

    if (perms === true || perms === 1 || perms === '*') return true;
    if (typeof perms === 'string') {
      return perms.includes('v') || perms.includes('c') || perms.includes('u') || perms.includes('d') || perms.length > 0;
    }
    if (Array.isArray(perms)) {
      return perms.length > 0;
    }
    return false;
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
    { name: 'Sentiment Comparison', path: '/admin/sentiment-comparison', icon: BarChart3, moduleId: 'sentiment_comparison', superAdminOnly: true },
  ];

  const currentItem = [...navItems, ...adminItems].find(item => item.path === location.pathname);
  const currentTitle = currentItem?.name || 'Overview';

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const filteredNavItems = navItems.filter(item => canAccess(item));
    const filteredAdminItems = adminItems.filter(item => canAccess(item));

    return (
      <div className="flex flex-col h-full bg-white dark:bg-[#09090b] transition-all duration-200">
        {/* Brand Header */}
        <div className={`h-16 flex items-center border-b border-zinc-200/90 dark:border-zinc-800/80 transition-all duration-200 relative ${isCollapsed && !isMobile ? 'px-3 justify-center' : 'px-5 justify-between'}`}>
          <Link to="/" className="flex items-center gap-3 overflow-hidden whitespace-nowrap group">
            <Logo size={28} />
            {(!isCollapsed || isMobile) && (
              <span className="font-bold tracking-tight text-zinc-900 dark:text-white text-base">
                NextGen CMS
              </span>
            )}
          </Link>
          {!isMobile && (
            <button
              onClick={toggleSidebar}
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-2xs transition-all z-20 hover:scale-105 active:scale-95"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={11} strokeWidth={3} /> : <ChevronLeft size={11} strokeWidth={3} />}
            </button>
          )}
        </div>

        {/* Nav Links */}
        <div className={`flex-1 overflow-y-auto px-3 py-3 space-y-4 transition-all duration-200`}>
          {/* Main Navigation */}
          <div>
            <nav className="space-y-1">
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
                    className={`group flex items-center h-9 rounded-md text-xs font-semibold transition-all duration-150 ${
                      isCollapsed && !isMobile 
                        ? 'justify-center w-full px-0' 
                        : 'gap-2.5 px-3 w-full'
                    } ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-white dark:text-black' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'}`} />
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
                <h3 className="px-2.5 mb-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap overflow-hidden">
                  Administration
                </h3>
              ) : (
                <div className="h-px bg-zinc-200/60 dark:bg-zinc-800/80 my-2 mx-1" />
              )}
              <nav className="space-y-1">
                {filteredAdminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      title={isCollapsed && !isMobile ? item.name : undefined}
                      className={`group flex items-center h-9 rounded-md text-xs font-semibold transition-all duration-150 ${
                        isCollapsed && !isMobile 
                          ? 'justify-center w-full px-0' 
                          : 'gap-2.5 px-3 w-full'
                      } ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60'
                      }`}
                    >
                      <Icon size={15} strokeWidth={isActive ? 2.5 : 2} className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? 'text-white dark:text-black' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'}`} />
                      {(!isCollapsed || isMobile) && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* User Footer Card */}
        <div className={`p-3 mt-auto border-t border-zinc-200/90 dark:border-zinc-800/80 relative ${isCollapsed && !isMobile ? 'flex justify-center' : ''}`} ref={userMenuRef}>
          {/* Dropup Menu */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className={`absolute bottom-full mb-2 bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 p-1.5 space-y-1 ${isCollapsed && !isMobile ? 'left-3 w-52' : 'left-3 right-3'
                  }`}
              >
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60 mb-1">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{user?.displayName || 'Active Admin'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-all"
                >
                  <User size={14} className="text-zinc-400" />
                  Account Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-all"
                >
                  <Settings size={14} className="text-zinc-400" />
                  Preferences
                </Link>
                <div className="h-px bg-zinc-100 dark:bg-zinc-800/80 my-1 mx-2" />
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md transition-all"
                >
                  <span className="flex items-center gap-2.5">
                    {theme === 'light' ? <Moon size={14} className="text-zinc-400" /> : <Sun size={14} className="text-zinc-400" />}
                    Theme Mode
                  </span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">{theme}</span>
                </button>
                <button
                  onClick={() => signOut()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-all"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`group transition-all text-left ${isCollapsed && !isMobile
              ? 'p-0 h-9 w-9 rounded-md overflow-hidden'
              : `w-full flex items-center gap-3 p-2 rounded-md border border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-50/70 dark:bg-[#121214]/70 ${isUserMenuOpen ? 'ring-2 ring-zinc-400/20 border-zinc-400 dark:border-zinc-600' : 'hover:border-zinc-300 dark:hover:border-zinc-700'}`
              }`}
          >
            <div className={`rounded bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-xs shrink-0 shadow-2xs ${isCollapsed && !isMobile ? 'h-9 w-9' : 'w-8 h-8'
              }`}>
              {user?.email?.[0].toUpperCase()}
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center justify-between">
                  {user?.displayName || (user?.email ? user.email.split('@')[0] : 'User')}
                  <ChevronUp size={12} className={`text-zinc-400 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate font-mono">
                  {profile?.role?.replace('_', ' ') || 'admin'}
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
      {/* Desktop Top Header Bar (Vercel / Cloudflare Style) */}
      <header className={`hidden md:flex fixed top-0 right-0 h-16 z-20 bg-white/80 dark:bg-[#050506]/80 backdrop-blur-xl border-b border-zinc-200/90 dark:border-zinc-800/80 transition-all duration-200 items-center justify-end px-6 ${isCollapsed ? 'left-20' : 'left-64'
        }`}>
        {/* Quick controls & actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-md bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-95"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle Color Theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col border-r border-zinc-200/90 dark:border-zinc-800/80 z-30 transition-all duration-200 ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden sticky top-0 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 h-16 flex items-center justify-between px-4 z-40">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="font-black text-sm text-zinc-900 dark:text-white tracking-tight">NextGen CMS</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="text-zinc-400 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-md"
            aria-label="Open Navigation Menu"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-[#09090b] z-[60] md:hidden shadow-2xl border-r border-zinc-200 dark:border-zinc-800"
            >
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl z-10"
                aria-label="Close Navigation Menu"
              >
                <X size={18} />
              </button>
              <SidebarContent isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
