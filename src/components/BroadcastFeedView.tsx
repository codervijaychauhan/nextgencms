import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Loader2, 
  List, 
  Code, 
  FileText, 
  Eye, 
  Lock,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';

interface FeedRecipient {
  phone: string;
  name: string;
  relation_name?: string;
  relation_type?: string;
  epic_no?: string;
  house_no?: string;
  ward_name?: string;
  booth_name?: string;
  age?: number | string;
  gender?: string;
  caste?: string;
  occupation?: string;
  part_no?: string;
  sr_no?: string;
  voting_status?: string;
  party_inclination?: string;
  is_karyakarta?: string;
  [key: string]: any;
}

interface FeedResponse {
  success: boolean;
  title: string;
  token: string;
  totalCount: number;
  columns: string[];
  expiresAt: string | null;
  createdAt?: string;
  recipients: FeedRecipient[];
}

export const BroadcastFeedView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [feedData, setFeedData] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [activeView, setActiveView] = useState<'table' | 'text' | 'json'>('table');
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string>('');

  const fetchFeed = async () => {
    if (!token) {
      setError('Invalid or missing broadcast feed token.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.get<FeedResponse>(`/api/broadcast-feed/${token}`);
      if (res && res.success) {
        setFeedData(res);
      } else {
        setError((res as any)?.error || 'Failed to load broadcast feed.');
      }
    } catch (err: any) {
      setError(err?.message || 'This broadcast link has expired, been revoked, or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [token]);

  const copyToClipboard = (text: string, formatName: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setCopiedFormat(formatName);
    setTimeout(() => {
      setCopied(false);
      setCopiedFormat('');
    }, 2500);
  };

  const generateFormattedText = () => {
    if (!feedData || !feedData.recipients) return '';
    const cols = feedData.columns || ['phone', 'name', 'relation_name', 'ward_name'];
    const lines = feedData.recipients.map(r => {
      return cols.map(c => r[c] || '').join('\t');
    });
    return `${cols.join('\t')}\n${lines.join('\n')}`;
  };

  const generateExtensionCSV = () => {
    if (!feedData || !feedData.recipients) return '';
    const cols = feedData.columns || ['phone', 'name'];
    const lines = feedData.recipients.map(r => {
      return cols.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',');
    });
    return `${cols.join(',')}\n${lines.join('\n')}`;
  };

  const getColumnLabel = (colKey: string): string => {
    const labels: Record<string, string> = {
      phone: 'Mobile / Phone Number',
      name: 'Voter Name',
      relation_name: 'Relative Name',
      relation_type: 'Relation',
      epic_no: 'EPIC / Voter ID',
      house_no: 'House No',
      ward_name: 'Ward / Village',
      booth_name: 'Polling Booth',
      age: 'Age',
      gender: 'Gender',
      caste: 'Caste',
      part_no: 'Part No',
      sr_no: 'Serial No',
      occupation: 'Occupation',
      voting_status: 'Voting Status',
      party_inclination: 'Favored Party',
      is_karyakarta: 'Karyakarta Status'
    };
    return labels[colKey] || colKey;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <MessageCircle size={32} className="animate-pulse" />
          </div>
          <Loader2 size={24} className="animate-spin text-emerald-500 absolute -bottom-1 -right-1" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold text-zinc-100">Connecting WhatsApp Broadcast Feed...</h2>
          <p className="text-xs text-zinc-500">Querying verified recipient numbers &amp; placeholders</p>
        </div>
      </div>
    );
  }

  if (error || !feedData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white">Feed Inaccessible or Expired</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {error || 'This temporary broadcast stream has expired, been revoked, or is invalid.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={fetchFeed}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Retry Feed Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = feedData.expiresAt ? new Date(feedData.expiresAt).getTime() < Date.now() : false;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Header Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <MessageCircle size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                {feedData.title || 'WhatsApp Broadcast Feed'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck size={11} /> Live Stream
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              <strong className="text-emerald-400 font-mono">{feedData.totalCount} Recipient Numbers</strong> Verified &bull; Extension-Optimized Feed
            </p>
          </div>
        </div>

        {/* View Switchers & Copy Helpers */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/60 text-xs">
            <button
              onClick={() => setActiveView('table')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'table' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List size={13} /> Table (DOM)
            </button>
            <button
              onClick={() => setActiveView('text')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'text' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileText size={13} /> TSV / Text
            </button>
            <button
              onClick={() => setActiveView('json')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeView === 'json' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Code size={13} /> JSON
            </button>
          </div>

          <button
            onClick={() => copyToClipboard(generateFormattedText(), 'TSV Tab-Separated Data')}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            title="Copy all rows formatted for Chrome extension or clipboard"
          >
            {copied && copiedFormat.includes('TSV') ? (
              <>
                <Check size={14} className="text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Data</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-5">
        
        {/* Stream Banner Info */}
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0 mt-0.5">
              <Sparkles size={16} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-100">
                Direct WhatsApp Chrome Extension Integration
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your WhatsApp sender extension can read the <code className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded font-mono">Phone Number</code> and custom placeholder columns directly from this structured URL.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0 self-end md:self-center">
            {feedData.expiresAt && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400">
                <Clock size={13} className={isExpired ? 'text-red-400' : 'text-amber-400'} />
                <span>Expires: <strong className="text-zinc-200">{new Date(feedData.expiresAt).toLocaleString()}</strong></span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono text-[11px]">
              Token: <span className="text-emerald-400">{feedData.token.substring(0, 12)}...</span>
            </div>
          </div>
        </div>

        {/* View Mode 1: Clean Structured HTML Table for Scraping / Extension Crawlers */}
        {activeView === 'table' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-bold">WhatsApp Recipient Rows ({feedData.recipients.length}):</span>
              <span className="text-[11px] font-mono text-zinc-500">Table DOM ID: <code className="text-zinc-400">#wa-broadcast-table</code></span>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl overflow-x-auto max-h-[70vh]">
              <table 
                id="wa-broadcast-table" 
                data-role="wa-broadcast-table" 
                data-total={feedData.totalCount}
                className="w-full text-left text-xs border-collapse whitespace-nowrap"
              >
                <thead className="bg-zinc-950/90 text-[10px] font-black uppercase text-zinc-400 border-b border-zinc-800 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-4 font-mono">#</th>
                    <th className="py-3 px-4 text-emerald-400">Mobile / Phone</th>
                    {feedData.columns.filter(c => c !== 'phone').map((col, idx) => (
                      <th key={idx} className="py-3 px-4 text-zinc-300">
                        {getColumnLabel(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody id="wa-recipients" className="divide-y divide-zinc-800/60 font-sans text-xs">
                  {feedData.recipients.map((voter, index) => (
                    <tr 
                      key={index} 
                      data-row-index={index + 1}
                      data-phone={voter.phone}
                      data-name={voter.name}
                      className="hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-zinc-600 text-[11px]">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-sm">
                        {voter.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="text-emerald-400">{voter.phone}</span>
                            <a
                              href={`https://wa.me/${voter.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Namaste ${voter.name || ''},`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                              title={`Chat with ${voter.name || 'voter'} on WhatsApp`}
                            >
                              <MessageCircle size={13} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-zinc-500 font-normal text-xs italic">No Mobile</span>
                        )}
                      </td>
                      {feedData.columns.filter(c => c !== 'phone').map((col, cIdx) => (
                        <td key={cIdx} className="py-2.5 px-4 text-zinc-200">
                          {voter[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View Mode 2: Clean TSV / Text Output */}
        {activeView === 'text' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-bold">Tab-Separated Stream (Extension Clipboard Format):</span>
              <button
                onClick={() => copyToClipboard(generateFormattedText(), 'TSV Tab-Separated Data')}
                className="text-xs font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Copy size={13} /> Copy All
              </button>
            </div>
            <textarea
              readOnly
              value={generateFormattedText()}
              className="w-full h-[65vh] p-4 font-mono text-xs bg-zinc-900 border border-zinc-800 rounded-2xl text-emerald-300 focus:outline-hidden resize-none selection:bg-emerald-600"
            />
          </div>
        )}

        {/* View Mode 3: JSON Output */}
        {activeView === 'json' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-bold">Structured JSON Feed API Output:</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(feedData, null, 2), 'JSON Data')}
                className="text-xs font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Copy size={13} /> Copy JSON
              </button>
            </div>
            <pre className="w-full h-[65vh] p-4 font-mono text-xs bg-zinc-900 border border-zinc-800 rounded-2xl text-blue-300 overflow-auto selection:bg-blue-600">
              {JSON.stringify(feedData, null, 2)}
            </pre>
          </div>
        )}

        {/* Footer Security Notice */}
        <footer className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-zinc-500">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Protected WhatsApp Broadcast Gateway &bull; NextGen Electoral CMS</span>
          </div>
          <div>
            <span>No bulk raw exports &bull; Dedicated extension automation interface</span>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default BroadcastFeedView;
