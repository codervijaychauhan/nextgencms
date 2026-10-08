import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Sun, Moon, Lock, Database, Eye, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import Logo from './Logo';

export default function PrivacyPolicy() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo size={26} />
            <span className="font-extrabold text-sm text-zinc-900 dark:text-white tracking-tight">NextGen CMS</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold transition-all shadow-xs hover:opacity-90 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Title Card */}
        <div className="space-y-3 pb-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShieldCheck size={14} />
            Privacy Policy
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Effective Date: September 25, 2026 • Last Updated: September 2026
          </p>
        </div>

        {/* Content Sections */}
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">1. Introduction</h2>
            <p>
              Welcome to <strong>NextGen CMS</strong> ("we", "our", or "the Platform"). NextGen CMS is an enterprise-grade Election Campaign, Booth, and Voter Management System. We are committed to protecting the privacy, security, and integrity of your data. This Privacy Policy explains how we collect, process, store, and safeguard information when you use our web platform and mobile applications.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">2. Information We Collect</h2>
            <div className="space-y-2">
              <p>We collect information to authenticate users and coordinate campaign field management:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li><strong>Account Credentials:</strong> Email address, display name, profile avatar, and authentication identifiers through Google Sign-In or administrative email login.</li>
                <li><strong>Campaign & Cadre Data:</strong> Booth assignments, organizational hierarchy roles (Super Admin, Admin, Constituency Incharge, Booth Level Officer, Volunteer), and survey response records.</li>
                <li><strong>Usage & Device Metrics:</strong> Browser type, operating system, IP address, and platform diagnostic telemetry for security and fraud prevention.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">3. Google User Data & OAuth Policy</h2>
            <p>
              When you authenticate with Google Sign-In, NextGen CMS accesses your public profile information (name, email address, and profile photo) solely to verify your identity and link your account to designated campaign access privileges. We strictly adhere to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements. We do not sell, rent, or transfer your Google user data to third parties.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">4. Data Security & Storage</h2>
            <p>
              All communication between your device and NextGen CMS is encrypted in transit using industry-standard Transport Layer Security (TLS 1.3 / HTTPS). Data is stored in secure database clusters with strict role-based access control (RBAC), multi-layered authentication validation, and parameterized query execution to prevent unauthorized access or disclosure.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">5. Cookies & Local Session Storage</h2>
            <p>
              We use necessary session tokens, local storage, and cookies to keep you signed in, remember your theme preference, and maintain uninterrupted application state across sessions. We do not use third-party behavioral advertising cookies.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">6. Data Retention & Account Deletion</h2>
            <p>
              We retain user information as long as your account is active within an assigned campaign cycle. Administrators and users may request data modification or account deactivation by contacting their campaign administrator or emailing our security contact below.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">7. Contact & Inquiries</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or data security, please contact us at:
            </p>
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 space-y-1">
              <p className="font-bold text-zinc-900 dark:text-white">NextGen CMS Privacy & Security Team</p>
              <p className="text-zinc-500 dark:text-zinc-400">Email: <a href="mailto:support@nextgencms.app" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">support@nextgencms.app</a></p>
              <p className="text-zinc-500 dark:text-zinc-400">Website: <a href="https://app.nextgencms.workers.dev" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">https://app.nextgencms.workers.dev</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 NextGen CMS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-zinc-900 dark:hover:text-white hover:underline">Terms of Service</Link>
            <Link to="/login" className="hover:text-zinc-900 dark:hover:text-white hover:underline">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
