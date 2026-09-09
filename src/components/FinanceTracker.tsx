import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Trash2, Search, Download, AlertTriangle, 
  Filter, RefreshCw, 
  ChevronDown, X, Coins, Printer,
  ArrowUpRight, ArrowDownLeft, Edit2, Tag,
  CheckCircle2, AlertCircle
} from 'lucide-react';

interface Budget {
  id: string;
  adminId: string;
  totalBudget: number;
  electionYear: string;
  allocations: {
    [category: string]: number;
  };
  updatedAt?: unknown;
}

interface Transaction {
  id: string;
  adminId: string;
  type: 'expense' | 'income';
  title: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
  donorName?: string;
  notes?: string;
  createdAt?: unknown;
}

const CATEGORIES = [
  'Campaign Materials',
  'Events & Rallies',
  'Digital Marketing',
  'Office Operations',
  'Travel & Logistics',
  'Volunteer Support'
];

const DEFAULT_ALLOCATIONS = {
  'Campaign Materials': 500000,
  'Events & Rallies': 300000,
  'Digital Marketing': 200000,
  'Office Operations': 150000,
  'Travel & Logistics': 100000,
  'Volunteer Support': 75000
};

export default function FinanceTracker() {
  const { user, profile } = useAuth();
  const adminId = user?.uid || 'default_admin';
  const adminName = profile?.username || user?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Modals / Actions
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // State for custom alerts and confirmations
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setNotification({ message, type });
    if (type !== 'error') {
      setTimeout(() => {
        setNotification(prev => prev?.message === message ? null : prev);
      }, 5000);
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };
  
  // Transaction Form State
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('Campaign Materials');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txMethod, setTxMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Online'>('Online');
  const [txDonorName, setTxDonorName] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState('');
  const [txSaving, setTxSaving] = useState(false);

  const [customCategories, setCustomCategories] = useState<string[]>(CATEGORIES);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [yearInput, setYearInput] = useState<string>('2026');

  // Filters / Search
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setYearInput(selectedYear);
  }, [selectedYear]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly' | 'all'>('all');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const filterByTimeframe = (txList: Transaction[], selectedTimeframe: 'weekly' | 'monthly' | 'yearly' | 'all') => {
    if (selectedTimeframe === 'all') return txList;
    const baseDate = new Date('2026-07-07');
    return txList.filter(t => {
      const txDate = new Date(t.date);
      if (isNaN(txDate.getTime())) return true;
      const diffTime = baseDate.getTime() - txDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (selectedTimeframe === 'weekly') {
        return diffDays <= 7 && diffDays >= 0;
      } else if (selectedTimeframe === 'monthly') {
        return diffDays <= 30 && diffDays >= 0;
      } else if (selectedTimeframe === 'yearly') {
        return diffDays <= 365 && diffDays >= 0;
      }
      return true;
    });
  };

  // Load / Seed Data
  useEffect(() => {
    if (adminId) {
      fetchFinanceData(selectedYear);
    }
  }, [adminId, selectedYear]);

  const fetchFinanceData = async (targetYear: string) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    try {
      // 1. Fetch budgets and custom categories
      const budgets = await api.get<any[]>('/api/finance/budgets');
      const currentBudget = (budgets || []).find(b => (b.adminId === adminId || b.admin_id === adminId) && (b.electionYear === targetYear || b.election_year === targetYear));
      
      let loadedCats = CATEGORIES;
      if (currentBudget && currentBudget.allocations && Object.keys(currentBudget.allocations).length > 0) {
        loadedCats = Object.keys(currentBudget.allocations);
      }
      setCustomCategories(loadedCats);

      // 2. Fetch Transactions
      const txData = await api.get<any[]>('/api/finance/transactions');
      const txList: Transaction[] = (txData || []).map(d => ({
        id: d.id,
        adminId: d.adminId || d.admin_id || adminId,
        type: d.type || 'expense',
        title: d.title || '',
        amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount || '0'),
        category: d.category || 'General',
        date: d.date ? new Date(d.date).toISOString().split('T')[0] : (d.transaction_date ? new Date(d.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        paymentMethod: d.paymentMethod || d.payment_method || 'Cash',
        donorName: d.donorName || d.donor_name || '',
        notes: d.notes || '',
        createdAt: d.createdAt || d.created_at
      }));

      txList.sort((a, b) => b.date.localeCompare(a.date));
      setTransactions(txList);
    } catch (err) {
      console.error('Error fetching finance tracker metrics:', err);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  const yearNumStr = selectedYear.match(/\d{4}/)?.[0] || selectedYear;
  const yearTransactions = transactions.filter(t => t.date.substring(0, 4) === yearNumStr || t.date.includes(yearNumStr));
  const timeframeTransactions = filterByTimeframe(yearTransactions, timeframe);

  const expenses = timeframeTransactions.filter(t => t.type === 'expense');
  const incomes = timeframeTransactions.filter(t => t.type === 'income');
  
  const totalSpent = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalSpent;

  const formatCurrency = (val: number) => '₹' + (val || 0).toLocaleString('en-IN');
  const formatLakhs = (val: number) => {
    const num = Math.abs(val || 0);
    const sign = val < 0 ? '-' : '';
    if (num >= 10000000) return `${sign}₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${sign}₹${(num / 100000).toFixed(2)} L`;
    return `${sign}₹${num.toLocaleString('en-IN')}`;
  };

  const getCategorySpent = (category: string) => {
    return expenses.filter(t => t.category === category).reduce((sum, t) => sum + t.amount, 0);
  };

  const categorySpendingMap: Record<string, number> = {};
  expenses.forEach(t => {
    categorySpendingMap[t.category] = (categorySpendingMap[t.category] || 0) + t.amount;
  });
  let topCategoryName = 'None';
  let topCategorySpent = 0;
  Object.entries(categorySpendingMap).forEach(([cat, amt]) => {
    if (amt > topCategorySpent) {
      topCategorySpent = amt;
      topCategoryName = cat;
    }
  });

  const handleEditClick = (tx: Transaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxTitle(tx.title);
    setTxAmount(String(tx.amount));
    setTxCategory(tx.category);
    setTxDate(tx.date);
    setTxMethod(tx.paymentMethod as any);
    setTxDonorName(tx.donorName || '');
    setTxNotes(tx.notes || '');
    setTxError('');
    setIsTxModalOpen(true);
  };

  const handleAddTransaction = (type: 'expense' | 'income') => {
    setEditingTx(null);
    setTxType(type);
    setTxTitle('');
    setTxAmount('');
    setTxCategory(customCategories[0] || 'Campaign Materials');
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxMethod('Online');
    setTxDonorName('');
    setTxNotes('');
    setTxError('');
    setIsTxModalOpen(true);
  };

  const getChartData = () => {
    const yearNum = parseInt(selectedYear.match(/\d{4}/)?.[0] || new Date().getFullYear().toString());

    if (timeframe === 'weekly') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        const targetBase = yearNum === new Date().getFullYear() ? new Date() : new Date(`${yearNum}-12-31`);
        d.setDate(targetBase.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayExpenses = yearTransactions.filter(t => t.type === 'expense' && t.date === dateStr).reduce((sum, t) => sum + t.amount, 0);
        const dayIncomes = yearTransactions.filter(t => t.type === 'income' && t.date === dateStr).reduce((sum, t) => sum + t.amount, 0);
        
        days.push({ label, expenses: dayExpenses, income: dayIncomes });
      }
      return days;
    } else if (timeframe === 'monthly') {
      const weeks = [];
      const targetBase = yearNum === new Date().getFullYear() ? new Date() : new Date(`${yearNum}-12-31`);
      for (let i = 3; i >= 0; i--) {
        const startDaysAgo = (i + 1) * 7;
        const endDaysAgo = i * 7;
        const label = i === 0 ? 'This Week' : `${i}w ago`;
        
        const weekExpenses = yearTransactions.filter(t => {
          if (t.type !== 'expense') return false;
          const txDate = new Date(t.date);
          const diffTime = targetBase.getTime() - txDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays >= endDaysAgo && diffDays < startDaysAgo;
        }).reduce((sum, t) => sum + t.amount, 0);

        const weekIncomes = yearTransactions.filter(t => {
          if (t.type !== 'income') return false;
          const txDate = new Date(t.date);
          const diffTime = targetBase.getTime() - txDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays >= endDaysAgo && diffDays < startDaysAgo;
        }).reduce((sum, t) => sum + t.amount, 0);

        weeks.push({ label, expenses: weekExpenses, income: weekIncomes });
      }
      return weeks;
    } else if (timeframe === 'yearly') {
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(`${yearNum}-12-31`);
        d.setMonth(d.getMonth() - i);
        const yearMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        
        const monthExpenses = yearTransactions.filter(t => t.type === 'expense' && t.date.substring(0, 7) === yearMonthStr).reduce((sum, t) => sum + t.amount, 0);
        const monthIncomes = yearTransactions.filter(t => t.type === 'income' && t.date.substring(0, 7) === yearMonthStr).reduce((sum, t) => sum + t.amount, 0);
        
        months.push({ label, expenses: monthExpenses, income: monthIncomes });
      }
      return months;
    } else {
      const allMonths: Record<string, { label: string, expenses: number, income: number }> = {};
      yearTransactions.forEach(t => {
        const yearMonth = t.date.substring(0, 7);
        const d = new Date(t.date);
        const label = isNaN(d.getTime()) ? yearMonth : d.toLocaleDateString('en-US', { month: 'short' });
        
        if (!allMonths[yearMonth]) {
          allMonths[yearMonth] = { label, expenses: 0, income: 0 };
        }
        if (t.type === 'expense') {
          allMonths[yearMonth].expenses += t.amount;
        } else {
          allMonths[yearMonth].income += t.amount;
        }
      });
      
      if (Object.keys(allMonths).length === 0) {
        const monthsList = [];
        for (let m = 0; m < 12; m++) {
          const d = new Date(yearNum, m, 1);
          monthsList.push({
            label: d.toLocaleDateString('en-US', { month: 'short' }),
            expenses: 0,
            income: 0
          });
        }
        return monthsList;
      }
      return Object.entries(allMonths).map(([_, val]) => val);
    }
  };

  const handleOpenNewTx = (type: 'expense' | 'income') => {
    setEditingTx(null);
    setTxType(type);
    setTxTitle('');
    setTxAmount('');
    setTxCategory(type === 'income' ? 'Income' : (customCategories[0] || 'General'));
    setTxDate(new Date().toISOString().split('T')[0]);
    setTxMethod('Online');
    setTxDonorName('');
    setTxNotes('');
    setTxError('');
    setIsTxModalOpen(true);
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setTxTitle(tx.title);
    setTxAmount(tx.amount.toString());
    setTxCategory(tx.category);
    setTxDate(tx.date);
    setTxMethod(tx.paymentMethod);
    setTxDonorName(tx.donorName || '');
    setTxNotes(tx.notes || '');
    setTxError('');
    setIsTxModalOpen(true);
  };

  const handleSaveTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim()) {
      setTxError('Please enter a description for the transaction.');
      return;
    }
    const amountVal = parseFloat(txAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setTxError('Please enter a valid amount greater than zero.');
      return;
    }

    setTxSaving(true);
    setTxError('');

    const txPayload = {
      id: editingTx ? editingTx.id : `tx_${Date.now()}`,
      adminId,
      type: txType,
      title: txTitle.trim(),
      amount: amountVal,
      category: txType === 'income' ? 'Income' : txCategory,
      date: txDate,
      paymentMethod: txMethod,
      donorName: txType === 'income' ? txDonorName.trim() || 'Anonymous' : '',
      notes: txNotes.trim()
    };

    try {
      await api.post('/api/finance/transactions', txPayload);
      if (editingTx) {
        setTransactions(prev => prev.map(t => t.id === editingTx.id ? { ...t, ...txPayload } : t).sort((a, b) => b.date.localeCompare(a.date)));
      } else {
        setTransactions(prev => [txPayload, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
      }
      setIsTxModalOpen(false);
      setEditingTx(null);
      setTxTitle('');
      setTxAmount('');
      setTxDonorName('');
      setTxNotes('');
      showNotification(editingTx ? 'Transaction updated successfully.' : 'Transaction recorded successfully.', 'success');
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      setTxError(err?.message || 'Failed to save transaction.');
    } finally {
      setTxSaving(false);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (customCategories.includes(trimmed)) {
      showNotification('This category already exists.', 'error');
      return;
    }

    const updatedCats = [...customCategories, trimmed];
    setCustomCategories(updatedCats);
    setNewCategoryName('');

    const defaultAllocations: Record<string, number> = {};
    updatedCats.forEach(cat => {
      defaultAllocations[cat] = 0;
    });

    const updatedBudget = {
      id: `${adminId}_${selectedYear}`,
      adminId,
      totalBudget: 0,
      electionYear: selectedYear,
      allocations: defaultAllocations
    };

    try {
      await api.post('/api/finance/budgets', updatedBudget);
      showNotification('New category added successfully.', 'success');
    } catch (err) {
      console.error('Failed to save category:', err);
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    const isUsed = transactions.some(t => t.category === catToDelete);
    if (isUsed) {
      showNotification(`Cannot delete "${catToDelete}" because there are transaction records logged under this category. Please delete or re-categorize those transactions first.`, 'error');
      return;
    }

    showConfirm(
      'Delete Category',
      `Are you sure you want to delete the category "${catToDelete}"?`,
      async () => {
        const updatedCats = customCategories.filter(c => c !== catToDelete);
        setCustomCategories(updatedCats);

        const defaultAllocations: Record<string, number> = {};
        updatedCats.forEach(cat => {
          defaultAllocations[cat] = 0;
        });

        const updatedBudget = {
          id: `${adminId}_${selectedYear}`,
          adminId,
          totalBudget: 0,
          electionYear: selectedYear,
          allocations: defaultAllocations
        };

        try {
          await api.post('/api/finance/budgets', updatedBudget);
          showNotification('Category deleted successfully.', 'success');
        } catch (err) {
          console.error('Failed to delete category:', err);
        }
      }
    );
  };

  const handleDeleteTx = async (txId: string) => {
    showConfirm(
      'Delete Transaction Record',
      'Are you sure you want to permanently delete this transaction record from the database?',
      async () => {
        try {
          await api.delete(`/api/finance/transactions/${txId}`);
          setTransactions(prev => prev.filter(t => t.id !== txId));
          showNotification('Transaction record deleted successfully.', 'success');
        } catch (err: any) {
          console.error('Error deleting transaction:', err);
          showNotification(err?.message || 'Failed to delete transaction.', 'error');
        }
      }
    );
  };

  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Title,Type,Category,Amount(INR),Date,Method,Donor Name,Notes"].join(",") + "\n"
      + transactions.map(t => [
          `"${t.title.replace(/"/g, '""')}"`,
          t.type.toUpperCase(),
          t.category,
          t.amount,
          t.date,
          t.paymentMethod,
          `"${(t.donorName || '').replace(/"/g, '""')}"`,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ].join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Campaign_Finance_Report_${adminName}_${selectedYear.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and Search Transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesYear = t.date.substring(0, 4) === selectedYear;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.donorName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    return matchesYear && matchesSearch && matchesCategory && matchesType;
  }).sort((a, b) => {
    return sortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });

  // Income Details
  const activeIncomesThisMonth = incomes.filter(t => {
    const txMonth = t.date.substring(0, 7); // YYYY-MM
    const currentMonth = new Date().toISOString().substring(0, 7);
    return txMonth === currentMonth;
  });
  
  const totalIncomeSources = new Set(incomes.map(i => i.donorName || 'Anonymous')).size;
  const avgIncomeAmount = incomes.length > 0 ? (totalIncome / incomes.length) : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 text-zinc-800 dark:text-zinc-200" />
        <p className="text-sm font-medium">Loading Campaign Budgets & Financial Ledgers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-zinc-900 dark:text-zinc-100 pb-16">
      
      {/* Module Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-md">
            Campaign Ledger
          </span>
          <h1 className="text-3xl font-bold tracking-tight mt-2 text-zinc-900 dark:text-white">
            Finance & Budget
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 max-w-xl">
            Personal workspace for **{adminName}** to track campaign funds, register income and expense transactions, and manage custom spending categories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm animate-button-glow"
          >
            <Printer className="w-3.5 h-3.5" />
            Generate Report
          </button>

          <button
            onClick={() => {
              setEditingTx(null);
              setTxType('expense');
              setTxTitle('');
              setTxAmount('');
              setTxCategory(customCategories[0] || 'Campaign Materials');
              setTxDate(new Date().toISOString().split('T')[0]);
              setTxMethod('Online');
              setTxDonorName('');
              setTxNotes('');
              setTxError('');
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        </div>
      </div>

      {/* Timeframe & Year Selector filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="md:col-span-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Fiscal Period & Ledger Filter</h3>
          <p className="text-xs text-zinc-500">Select active year to configure custom categories and view matching transactions.</p>
        </div>
        <div className="md:col-span-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-end">
          {/* Year selector manual type */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <input
              type="text"
              list="configured-years"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSelectedYear(yearInput);
                }
              }}
              placeholder="Type Year (e.g. 2026)"
              className="w-full sm:w-44 px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 shadow-sm"
            />
            <datalist id="configured-years">
              {['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033', '2034', '2035'].map(y => (
                <option key={y} value={y} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={() => setSelectedYear(yearInput)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all shrink-0"
            >
              Go
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="flex bg-zinc-200/60 dark:bg-zinc-950 p-1 rounded-xl font-sans">
            {(['weekly', 'monthly', 'yearly', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize cursor-pointer whitespace-nowrap ${
                  timeframe === tf
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {tf === 'all' ? 'All-Time' : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total Funds In */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-sans uppercase tracking-wider text-[10px]">Total Funds In</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {formatLakhs(totalIncome)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                +{incomes.length} receipts
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500" />
        </div>

        {/* Card 2: Total Funds Out */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-sans uppercase tracking-wider text-[10px]">Total Funds Out</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {formatLakhs(totalSpent)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                -{expenses.length} payments
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500" />
        </div>

        {/* Card 3: Net Balance */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-sans uppercase tracking-wider text-[10px]">Net Balance</span>
            <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-bold tracking-tight ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {formatLakhs(netBalance)}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
                {netBalance >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
          </div>
          <div className={`absolute bottom-0 inset-x-0 h-1 ${netBalance >= 0 ? 'bg-emerald-600' : 'bg-red-500'}`} />
        </div>

        {/* Card 4: Top Category */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-sans uppercase tracking-wider text-[10px]">Top Spending</span>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white truncate" title={topCategoryName}>
              {topCategoryName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                {formatLakhs(topCategorySpent)}
              </span>
              <span className="text-[10px] text-zinc-400">spent</span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-500" />
        </div>

      </div>

      {/* Financial Flow Interactive SVG Trend Chart */}
      {(() => {
        const chartData = getChartData();
        const maxVal = Math.max(...chartData.map(d => Math.max(d.expenses, d.income, 10000)));
        const formatYLabel = (val: number) => {
          if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
          if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
          return val.toString();
        };

        return (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Financial Trend Visualizer</h2>
                <p className="text-xs text-zinc-500">Compare incoming support and outflows over the selected period. Hover over any bar for details.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Income (₹)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Expense (₹)</span>
                </div>
              </div>
            </div>

            <div className="relative w-full overflow-hidden">
              <svg viewBox="0 0 600 240" className="w-full h-auto">
                {/* Y-Axis dashed grid lines and labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 20 + 170 * (1 - ratio);
                  const val = maxVal * ratio;
                  return (
                    <g key={idx}>
                      <line 
                        x1="55" 
                        y1={y} 
                        x2="580" 
                        y2={y} 
                        stroke="currentColor" 
                        className="text-zinc-100 dark:text-zinc-800" 
                        strokeDasharray="4 4" 
                      />
                      <text 
                        x="45" 
                        y={y + 4} 
                        textAnchor="end" 
                        className="fill-zinc-400 dark:fill-zinc-500 text-[10px] font-mono"
                      >
                        {formatYLabel(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Render Bars */}
                {chartData.map((d, i) => {
                  const N = chartData.length;
                  const slotWidth = 510 / N;
                  const barWidth = Math.min(16, slotWidth * 0.22);
                  const centerX = 65 + i * slotWidth + slotWidth / 2;
                  
                  const expHeight = (d.expenses / maxVal) * 170;
                  const incHeight = (d.income / maxVal) * 170;
                  
                  const expY = 20 + 170 - expHeight;
                  const incY = 20 + 170 - incHeight;
                  
                  const isHovered = hoveredBar === i;

                  return (
                    <g 
                      key={i} 
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                      className="cursor-pointer group"
                    >
                      {/* Transparent slot trigger overlay for easy hovering */}
                      <rect
                        x={65 + i * slotWidth}
                        y="10"
                        width={slotWidth}
                        height="190"
                        fill="transparent"
                      />

                      {/* Expense Bar */}
                      {d.expenses > 0 && (
                        <rect
                          x={centerX - barWidth - 1}
                          y={expY}
                          width={barWidth}
                          height={Math.max(4, expHeight)}
                          rx="2"
                          className={`transition-all duration-300 ${
                            isHovered 
                              ? 'fill-amber-400' 
                              : 'fill-amber-500/80 dark:fill-amber-500/70 group-hover:fill-amber-500'
                          }`}
                        />
                      )}

                      {/* Income Bar */}
                      {d.income > 0 && (
                        <rect
                          x={centerX + 1}
                          y={incY}
                          width={barWidth}
                          height={Math.max(4, incHeight)}
                          rx="2"
                          className={`transition-all duration-300 ${
                            isHovered 
                              ? 'fill-emerald-400' 
                              : 'fill-emerald-500/80 dark:fill-emerald-500/70 group-hover:fill-emerald-500'
                          }`}
                        />
                      )}

                      {/* Hover Background highlighting */}
                      {isHovered && (
                        <rect
                          x={65 + i * slotWidth + 4}
                          y="15"
                          width={slotWidth - 8}
                          height="180"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-zinc-200 dark:text-zinc-850"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* X Axis label */}
                      <text
                        x={centerX}
                        y="210"
                        textAnchor="middle"
                        className={`text-[10px] font-medium transition-colors duration-200 ${
                          isHovered 
                            ? 'fill-zinc-900 dark:fill-white font-bold' 
                            : 'fill-zinc-400 dark:fill-zinc-500'
                        }`}
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Base Line */}
                <line 
                  x1="55" 
                  y1="190" 
                  x2="580" 
                  y2="190" 
                  stroke="currentColor" 
                  className="text-zinc-200 dark:text-zinc-800" 
                />
              </svg>

              {/* Informative Floating Tooltip Box */}
              {hoveredBar !== null && chartData[hoveredBar] && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-950/95 dark:bg-zinc-900/95 text-white p-3 rounded-xl border border-zinc-800 shadow-xl flex gap-4 pointer-events-none animate-fade-in text-[11px] max-w-xs leading-normal">
                  <div>
                    <p className="text-zinc-450 font-bold uppercase tracking-wider text-[9px] mb-1">Period</p>
                    <p className="font-semibold text-zinc-100">{chartData[hoveredBar].label}</p>
                  </div>
                  <div className="border-l border-zinc-800 pl-3">
                    <p className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider mb-0.5">Total Income</p>
                    <p className="font-bold text-emerald-450">{formatCurrency(chartData[hoveredBar].income)}</p>
                  </div>
                  <div className="border-l border-zinc-800 pl-3">
                    <p className="text-amber-500 font-bold text-[9px] uppercase tracking-wider mb-0.5">Total Expense</p>
                    <p className="font-bold text-amber-450">{formatCurrency(chartData[hoveredBar].expenses)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Two-Column Midsection: Custom Categories & Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        
        {/* Left Column: Custom Categories Manager (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Custom Expense Categories
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Manage, add, and review spending distribution across custom campaign categories.
              </p>
            </div>
          </div>

          {/* Add Category Form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New Category (e.g. Social Media Ad)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddCategory();
                }
              }}
              className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          </div>

          <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
            {customCategories.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs border border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl">
                No custom categories defined. Add one above to start tracking.
              </div>
            ) : (
              customCategories.map((cat) => {
                const spent = getCategorySpent(cat);
                const count = expenses.filter(t => t.category === cat).length;

                return (
                  <div key={cat} className="flex justify-between items-center p-3.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-200 dark:hover:border-zinc-700/60 transition-all">
                    <div>
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{cat}</span>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                        <span>{count} {count === 1 ? 'transaction' : 'transactions'} logged</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs font-black text-zinc-950 dark:text-white block">{formatCurrency(spent)}</span>
                        <span className="text-[9px] text-zinc-400 uppercase tracking-wider block font-medium">total spent</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Visual Charts & Donation Summary (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Custom SVG Expense Distribution Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Expense Share Breakdown</h2>
            
            {totalSpent === 0 ? (
              <div className="h-[200px] flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-400">
                No campaign expenses logged yet to visualize distribution.
              </div>
            ) : (
              <div className="space-y-5">
                {/* Visual donut bar */}
                <div className="flex h-4 rounded-full overflow-hidden">
                  {customCategories.map((cat, idx) => {
                    const spent = getCategorySpent(cat);
                    const share = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                    if (share === 0) return null;
                    const colors = [
                      'bg-blue-600', 'bg-purple-600', 'bg-amber-500', 
                      'bg-emerald-500', 'bg-pink-600', 'bg-cyan-500', 'bg-violet-600', 'bg-orange-500'
                    ];
                    return (
                      <div 
                        key={cat} 
                        className={colors[idx % colors.length]} 
                        style={{ width: `${share}%` }} 
                        title={`${cat}: ${share.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>

                {/* Legend list */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {customCategories.map((cat, idx) => {
                    const spent = getCategorySpent(cat);
                    const share = totalSpent > 0 ? (spent / totalSpent) * 100 : 0;
                    const colors = [
                      'bg-blue-600', 'bg-purple-600', 'bg-amber-500', 
                      'bg-emerald-500', 'bg-pink-600', 'bg-cyan-500', 'bg-violet-600', 'bg-orange-500'
                    ];
                    return (
                      <div key={cat} className="flex items-start gap-2 text-xs">
                        <span className={`w-2.5 h-2.5 rounded shrink-0 mt-0.5 ${colors[idx % colors.length]}`} />
                        <div className="min-w-0">
                          <p className="text-zinc-500 dark:text-zinc-400 font-medium truncate">{cat}</p>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">
                            {formatCurrency(spent)} <span className="text-[10px] text-zinc-400 font-normal">({share.toFixed(0)}%)</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Income Summary Section */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Income Insights</h2>
            
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl space-y-4">
              <div className="grid grid-cols-3 gap-2 divide-x divide-zinc-200 dark:divide-zinc-700">
                <div className="text-center">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block">This Month</span>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                    {formatCurrency(activeIncomesThisMonth.reduce((sum, d) => sum + d.amount, 0))}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block">Income Sources</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1 block">
                    {totalIncomeSources}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide block">Avg Receipt</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                    {formatCurrency(Math.round(avgIncomeAmount))}
                  </span>
                </div>
              </div>

              {/* Quick Income highlight list */}
              <div className="pt-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">Recent Income Logs</p>
                {incomes.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-2">No income registered yet.</p>
                ) : (
                  <div className="space-y-2">
                    {incomes.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-xs p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{item.donorName || 'General Income'}</p>
                          <p className="text-[10px] text-zinc-400">{item.date} • {item.paymentMethod}</p>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Transaction Ledgers Table / List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        
        {/* Ledgers Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5 mb-5">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Transaction Ledgers & Audit Trail</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Comprehensive list of all expense allocations and campaign income logs.</p>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer text-zinc-700 dark:text-zinc-300 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel/CSV
          </button>
        </div>

        {/* Ledgers Filters Row */}
        <div className="flex flex-col md:flex-row gap-3.5 mb-5">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by description, payer source, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 transition-all text-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full md:w-48 relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 appearance-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Income">Income Receipts</option>
              {customCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Type Filter */}
          <div className="w-full md:w-40 relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="income">Income Only</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Sort Filter */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
          >
            <Filter className="w-3.5 h-3.5" />
            Sort: Date {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>

        {/* Transaction Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-150 dark:border-zinc-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-150 dark:border-zinc-800">
                <th className="py-3 px-4">Title / Ledger</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800 text-xs">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-400">
                    No transactions match your search query or filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                      <td className="py-3 px-4 max-w-xs md:max-w-md">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          {isExpense ? (
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          ) : (
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          )}
                          {tx.title}
                        </div>
                        {tx.notes && <p className="text-[10px] text-zinc-400 truncate mt-0.5">{tx.notes}</p>}
                        {tx.donorName && <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">Source: {tx.donorName}</p>}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          tx.category === 'Income' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}>
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                        {tx.paymentMethod}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                        isExpense ? 'text-zinc-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isExpense ? `-${formatCurrency(tx.amount)}` : `+${formatCurrency(tx.amount)}`}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(tx)}
                            className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-all cursor-pointer"
                            title="Edit record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD TRANSACTION */}
      <AnimatePresence>
        {isTxModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-500" />
                  {editingTx ? 'Edit Campaign Transaction' : 'Log New Campaign Transaction'}
                </h3>
                <button
                  onClick={() => setIsTxModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                {txError && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-lg">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{txError}</span>
                  </div>
                )}

                {/* Tx Type Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('expense');
                      setTxCategory('Campaign Materials');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      txType === 'expense' 
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('income');
                      setTxCategory('Income');
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      txType === 'income' 
                        ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                    }`}
                  >
                    Income
                  </button>
                </div>

                {/* Ledger Title */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Description / Ledger Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={txType === 'expense' ? 'e.g. Rally Ground Rental, Video Ads' : 'e.g. General Funding Support'}
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 15000"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Transaction Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {txType === 'expense' ? (
                  /* Expense Category Selector */
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Campaign Allocation Category
                    </label>
                    <select
                      value={txCategory}
                      onChange={(e) => setTxCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 cursor-pointer"
                    >
                      {customCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* Income Payer Name input */
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Source / Payer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. State Party HQ, Anonymous Payer"
                      value={txDonorName}
                      onChange={(e) => setTxDonorName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                )}

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Payment Method / Channel
                  </label>
                  <select
                    value={txMethod}
                    onChange={(e) => setTxMethod(e.target.value as 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online')}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 cursor-pointer"
                  >
                    <option value="Online">Online / UPI</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash Ledger</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Internal Campaign Notes
                  </label>
                  <textarea
                    placeholder="Brief description for audit and accounting context..."
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2.5 pt-4 border-t border-zinc-150 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsTxModalOpen(false)}
                    className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={txSaving}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                  >
                    {txSaving ? 'Saving Record...' : editingTx ? 'Save Changes' : 'Confirm Transaction'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: GENERATE REPORT (PRINT VIEW) */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 shrink-0">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  Campaign Financial Health Audit Report
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV File
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print / PDF
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Body Content */}
              <div id="printable-report" className="flex-1 overflow-y-auto p-8 space-y-6 text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900">
                {/* Letterhead */}
                <div className="flex justify-between items-start border-b-2 border-zinc-900 dark:border-zinc-100 pb-5">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-zinc-950 dark:text-white">NextGen CMS Ledgers</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Audit Trail & Transaction Ledger Summary</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Context</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white">{adminName}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Year {selectedYear}</p>
                  </div>
                </div>

                {/* Audit Health Summary Score */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 block">Total Income (Receipts)</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{formatCurrency(totalIncome)}</span>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 block">Total Audited Expense</span>
                    <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block">{formatCurrency(totalSpent)}</span>
                  </div>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 block">Net Balance Surplus/Deficit</span>
                    <span className={`text-lg font-black mt-1 block ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{formatCurrency(netBalance)}</span>
                  </div>
                </div>

                {/* Categories allocation list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Category-wise Spending Distributions</h4>
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800">
                    <div className="grid grid-cols-12 bg-zinc-50 dark:bg-zinc-800/30 p-3 text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
                      <div className="col-span-6">Category Name</div>
                      <div className="col-span-3 text-right">Transactions</div>
                      <div className="col-span-3 text-right">Total Expensed</div>
                    </div>
                    {customCategories.map(cat => {
                      const spent = getCategorySpent(cat);
                      const count = expenses.filter(t => t.category === cat).length;
                      return (
                        <div key={cat} className="grid grid-cols-12 p-3 text-xs">
                          <div className="col-span-6 font-semibold text-zinc-900 dark:text-zinc-100">{cat}</div>
                          <div className="col-span-3 text-right text-zinc-500">{count}</div>
                          <div className="col-span-3 text-right text-zinc-900 dark:text-zinc-100 font-semibold">{formatCurrency(spent)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Audit Trial detailed list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Chronological Ledgers Log</h4>
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800">
                    {yearTransactions.map((t) => (
                      <div key={t.id} className="p-3 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{t.title}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{t.date} • {t.category} • Method: {t.paymentMethod}</p>
                          {t.notes && <p className="text-[10px] text-zinc-400 italic mt-0.5">"{t.notes}"</p>}
                        </div>
                        <span className={`font-bold ${t.type === 'expense' ? 'text-zinc-900 dark:text-white' : 'text-emerald-600'}`}>
                          {t.type === 'expense' ? `-${formatCurrency(t.amount)}` : `+${formatCurrency(t.amount)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer/Signature */}
                <div className="pt-8 flex justify-between items-end border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400">
                  <p className="max-w-md">
                    This document is generated server-side within the NextGen CMS secure sandbox environment. Access and storage is strictly isolated per designated MLA Administrator context.
                  </p>
                  <div className="text-right w-48 border-t border-zinc-400 dark:border-zinc-600 pt-3">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">{adminName}</p>
                    <p>Signing Authority</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{confirmDialog.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer text-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION BANNER */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-2xl shadow-2xl border border-zinc-800 dark:border-zinc-200 max-w-sm text-xs font-semibold"
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <span className="flex-1">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-lg text-zinc-400 dark:text-zinc-500 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
