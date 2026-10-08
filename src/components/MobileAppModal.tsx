import React, { useState } from 'react';
import { 
  Smartphone, 
  Download, 
  QrCode, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface MobileAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MEDIAN_APK_DOWNLOAD_URL = 'https://median.co/share/abpzqkb#apk';

export default function MobileAppModal({ isOpen, onClose }: MobileAppModalProps) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(MEDIAN_APK_DOWNLOAD_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3.5 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Minimalist Card Container */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 10 }} 
        className="relative bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800/90 rounded-2xl shadow-2xl w-full max-w-[380px] z-10 overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                  NextGen CMS
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Android APK
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5">
          {/* Main Download Button */}
          <a
            href={MEDIAN_APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Download size={15} />
            <span>Download APK Package</span>
            <ExternalLink size={12} className="opacity-70" />
          </a>

          {/* Quick Actions Row: Copy Link & Show QR Code */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#141417] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-zinc-400" />}
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQR(!showQR)}
              className="py-2 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#141417] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <QrCode size={13} className="text-zinc-400" />
              <span>{showQR ? 'Hide QR' : 'Scan QR'}</span>
            </button>
          </div>

          {/* Collapsible Minimal QR Code (for scanning on phone from desktop) */}
          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#141417] border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                  <div className="w-32 h-32 mx-auto bg-zinc-900 p-2.5 rounded-lg flex items-center justify-center shadow-inner">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
                      <rect x="5" y="5" width="26" height="26" rx="3" />
                      <rect x="9" y="9" width="18" height="18" fill="#18181b" rx="2" />
                      <rect x="13" y="13" width="10" height="10" rx="1" />
                      
                      <rect x="69" y="5" width="26" height="26" rx="3" />
                      <rect x="73" y="9" width="18" height="18" fill="#18181b" rx="2" />
                      <rect x="77" y="13" width="10" height="10" rx="1" />

                      <rect x="5" y="69" width="26" height="26" rx="3" />
                      <rect x="9" y="73" width="18" height="18" fill="#18181b" rx="2" />
                      <rect x="13" y="77" width="10" height="10" rx="1" />

                      <rect x="36" y="8" width="5" height="5" />
                      <rect x="44" y="8" width="5" height="5" />
                      <rect x="55" y="8" width="8" height="5" />
                      <rect x="36" y="18" width="12" height="5" />
                      <rect x="52" y="18" width="5" height="5" />
                      <rect x="8" y="36" width="5" height="12" />
                      <rect x="18" y="36" width="10" height="5" />
                      <rect x="36" y="36" width="14" height="14" rx="2" />
                      <rect x="55" y="36" width="8" height="5" />
                      <rect x="68" y="36" width="10" height="8" />
                      <rect x="83" y="36" width="9" height="5" />
                      <rect x="36" y="55" width="6" height="8" />
                      <rect x="46" y="55" width="12" height="5" />
                      <rect x="63" y="48" width="12" height="12" />
                      <rect x="36" y="68" width="10" height="5" />
                      <rect x="50" y="68" width="8" height="10" />
                      <rect x="63" y="65" width="5" height="8" />
                      <rect x="73" y="65" width="19" height="5" />
                      <rect x="36" y="78" width="8" height="14" />
                      <rect x="48" y="83" width="14" height="9" />
                      <rect x="67" y="75" width="10" height="17" />
                      <rect x="82" y="75" width="10" height="5" />
                    </svg>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-medium">Scan with camera to download on phone</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between text-[10px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span>Verified Android Build</span>
          </div>
          <span>v1.0.0</span>
        </div>
      </motion.div>
    </div>
  );
}
