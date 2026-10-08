import React, { useState, useEffect, useMemo } from 'react';
import { 
  SlidersHorizontal, Check, ArrowUp, ArrowDown, 
  RotateCcw, Eye, EyeOff, Search, X, CheckSquare, Square,
  Layers, Filter, Sparkles, Columns
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UseTableColumnsReturn } from '../../hooks/useTableColumns';

interface TableColumnManagerProps<TKey extends string = string> {
  columnManager: UseTableColumnsReturn<TKey>;
  tableName?: string;
  className?: string;
  variant?: 'button' | 'compact' | 'icon';
}

export function TableColumnManager<TKey extends string = string>({
  columnManager,
  tableName = 'Table',
  className = '',
  variant = 'button'
}: TableColumnManagerProps<TKey>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const {
    columns,
    visibleColumns,
    toggleColumn,
    moveColumnById,
    showAllColumns,
    hideNonEssentialColumns,
    resetColumns
  } = columnManager;

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    columns.forEach(col => {
      if (col.category) cats.add(col.category);
    });
    return Array.from(cats);
  }, [columns]);

  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      const matchesSearch = 
        col.label.toLowerCase().includes(search.toLowerCase()) ||
        (col.category && col.category.toLowerCase().includes(search.toLowerCase()));
      
      const matchesCategory = 
        activeCategory === 'all' || 
        (col.category && col.category.toLowerCase() === activeCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [columns, search, activeCategory]);

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  return (
    <div className={`inline-block ${className}`}>
      {/* Trigger Button */}
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer shadow-xs"
          title="Customize Columns"
        >
          <SlidersHorizontal size={14} />
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
        >
          <SlidersHorizontal size={13} className="text-zinc-400" />
          <span>Columns</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
            {visibleCount}/{totalCount}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <SlidersHorizontal size={13} className="text-blue-500" />
          <span>Customize Columns</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
            {visibleCount}/{totalCount}
          </span>
        </button>
      )}

      {/* Centered Modal Popup Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Box Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shadow-xs">
                    <Columns size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">
                        Customize {tableName} Columns
                      </h3>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                        {visibleCount} of {totalCount} Visible
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Select which columns to display and arrange their sequence.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search & Quick Controls Toolbar */}
              <div className="p-3 sm:p-4 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search column name or category..."
                      className="w-full h-9 pl-9 pr-8 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 rounded"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Batch Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={showAllColumns}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={hideNonEssentialColumns}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                    <button
                      type="button"
                      onClick={resetColumns}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 transition-colors cursor-pointer"
                      title="Reset visibility and column positions"
                    >
                      <RotateCcw size={12} />
                      <span>Original</span>
                    </button>
                  </div>
                </div>

                {/* Category Filter Pills */}
                {categories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveCategory('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                        activeCategory === 'all'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-750'
                      }`}
                    >
                      All ({columns.length})
                    </button>
                    {categories.map(cat => {
                      const count = columns.filter(c => c.category === cat).length;
                      const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveCategory(isSelected ? 'all' : cat)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-tight shrink-0 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-750'
                          }`}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Body - Columns List */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                {filteredColumns.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-zinc-400">
                      <Search size={20} />
                    </div>
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      No columns match your search "{search}"
                    </p>
                    <button
                      onClick={() => { setSearch(''); setActiveCategory('all'); }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredColumns.map((col, index) => {
                      const isFirst = index === 0;
                      const isLast = index === filteredColumns.length - 1;

                      return (
                        <div
                          key={col.id}
                          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                            col.visible
                              ? 'bg-white dark:bg-zinc-900 border-zinc-200/90 dark:border-zinc-800 shadow-2xs hover:border-blue-300 dark:hover:border-blue-900/50'
                              : 'bg-zinc-50/80 dark:bg-zinc-950/40 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                          }`}
                        >
                          {/* Checkbox and Label */}
                          <button
                            type="button"
                            disabled={col.required}
                            onClick={() => !col.required && toggleColumn(col.id)}
                            className={`flex items-center gap-3 flex-1 min-w-0 text-left ${
                              col.required ? 'cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                              col.visible
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                            }`}>
                              {col.visible && <Check size={13} strokeWidth={3} />}
                            </div>

                            <div className="min-w-0 flex-1 pr-2">
                              <span className={`text-xs font-bold truncate block ${
                                col.visible ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 line-through'
                              }`}>
                                {col.label}
                              </span>
                              {col.category && (
                                <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono block">
                                  {col.category}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Reorder and Lock Controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            {col.required ? (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200/50 dark:border-zinc-700/50">
                                Required
                              </span>
                            ) : (
                              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
                                <button
                                  type="button"
                                  disabled={isFirst}
                                  onClick={() => moveColumnById(col.id, 'up')}
                                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                  title="Move column earlier"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLast}
                                  onClick={() => moveColumnById(col.id, 'down')}
                                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                  title="Move column later"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium text-center sm:text-left">
                  <span>Showing <strong className="text-zinc-900 dark:text-white font-bold">{visibleCount}</strong> of <strong className="text-zinc-900 dark:text-white font-bold">{totalCount}</strong> columns in table. Preferences are automatically saved.</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 sm:flex-none webapp-button-primary h-9 px-6 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

