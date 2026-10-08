import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Sun, Moon, Scale, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import Logo from './Logo';

export default function TermsOfService() {
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
            <Scale size={14} />
            Legal Agreement
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
            Effective Date: September 25, 2026 • Last Updated: September 2026
          </p>
        </div>

        {/* Content Sections */}
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">1. Agreement to Terms</h2>
            <p>
              By accessing or using <strong>NextGen CMS</strong> (available via web browser or mobile application), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, you may not access or use the Platform.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">2. Permitted Use & Account Responsibility</h2>
            <div className="space-y-2">
              <p>NextGen CMS is provided for legitimate campaign administration, booth coordination, and voter sentiment analysis. Users agree to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Maintain the confidentiality of their login credentials and prevent unauthorized sharing.</li>
                <li>Operate within the permissions, rights, and geographic jurisdictions assigned to their profile.</li>
                <li>Comply with all applicable local election commission rules, statutory regulations, and data governance laws.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">3. Prohibited Activities</h2>
            <div className="space-y-2">
              <p>Users must not engage in any of the following prohibited actions:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Attempting to bypass access controls, escalate privileges, or reverse-engineer the platform.</li>
                <li>Uploading malicious software, automated scraping, or transmitting fraudulent or misleading campaign records.</li>
                <li>Using communication or messaging dispatch modules in violation of anti-spam laws or third-party platform terms.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">4. Intellectual Property</h2>
            <p>
              All software, source code, database structures, UI components, designs, and branding of NextGen CMS are the exclusive property of NextGen CMS and its licensors. Unauthorized duplication or commercial redistribution without prior written consent is strictly prohibited.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">5. Service Availability & Disclaimers</h2>
            <p>
              While we strive to maintain high availability and real-time synchronization, the Platform is provided on an "AS IS" and "AS AVAILABLE" basis. We do not guarantee uninterrupted or error-free operation during unexpected network outages or maintenance periods.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, NextGen CMS and its operators shall not be liable for indirect, incidental, special, or consequential damages resulting from unauthorized account access, data loss, or reliance on analytics summaries.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">7. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms or present security risks to the campaign infrastructure without prior notice.
            </p>
          </section>

          <section className="space-y-2.5">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">8. Contact Information</h2>
            <p>
              For legal inquiries, terms compliance, or permissions, reach out to our team at:
            </p>
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 space-y-1">
              <p className="font-bold text-zinc-900 dark:text-white">NextGen CMS Legal & Governance</p>
              <p className="text-zinc-500 dark:text-zinc-400">Email: <a href="mailto:support@nextgencms.app" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">support@nextgencms.app</a></p>
              <p className="text-zinc-500 dark:text-zinc-400">Website: <a href="https://app.nextgencms.workers.dev" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">https://app.nextgencms.workers.dev</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© 2026 NextGen CMS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-zinc-900 dark:hover:text-white hover:underline">Privacy Policy</Link>
            <Link to="/login" className="hover:text-zinc-900 dark:hover:text-white hover:underline">Sign In</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
