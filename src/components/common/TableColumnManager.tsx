import React, { useState, useRef, useEffect } from 'react';
import { 
  SlidersHorizontal, Check, ArrowUp, ArrowDown, 
  RotateCcw, Eye, EyeOff, Search, X, CheckSquare, Square
} from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    columns,
    visibleColumns,
    toggleColumn,
    moveColumnById,
    showAllColumns,
    hideNonEssentialColumns,
    resetColumns
  } = columnManager;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredColumns = columns.filter(col => 
    col.label.toLowerCase().includes(search.toLowerCase()) ||
    (col.category && col.category.toLowerCase().includes(search.toLowerCase()))
  );

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2 rounded-xl border transition-all cursor-pointer ${
            isOpen
              ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500/50 dark:text-blue-400'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850'
          }`}
          title="Customize Columns"
        >
          <SlidersHorizontal size={14} />
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            isOpen
              ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500/50 dark:text-blue-400 shadow-xs'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850'
          }`}
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
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-xs ${
            isOpen
              ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500/50 dark:text-blue-400 ring-2 ring-blue-500/20'
              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-850'
          }`}
        >
          <SlidersHorizontal size={13} className="text-zinc-400" />
          <span>Customize Columns</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
            {visibleCount}/{totalCount}
          </span>
        </button>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-blue-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                {tableName} Columns
              </h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                {visibleCount} of {totalCount}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick Filter Search */}
          <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find column..."
                className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Action Toggles */}
          <div className="px-3 py-2 bg-zinc-50/50 dark:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={showAllColumns}
                className="px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-bold transition-colors"
              >
                Select All
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <button
                type="button"
                onClick={hideNonEssentialColumns}
                className="px-2 py-1 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold transition-colors"
              >
                Defaults
              </button>
            </div>
            <button
              type="button"
              onClick={resetColumns}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-bold transition-colors"
              title="Reset order & visibility to original defaults"
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>

          {/* Column Checklist & Reorder List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-1">
            {filteredColumns.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                No matching columns found
              </div>
            ) : (
              filteredColumns.map((col, index) => {
                const isFirst = index === 0;
                const isLast = index === filteredColumns.length - 1;

                return (
                  <div
                    key={col.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors ${
                      col.visible
                        ? 'bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                        : 'opacity-50 hover:opacity-80 bg-zinc-50/50 dark:bg-zinc-950/30'
                    }`}
                  >
                    {/* Checkbox & Name */}
                    <button
                      type="button"
                      disabled={col.required}
                      onClick={() => !col.required && toggleColumn(col.id)}
                      className={`flex items-center gap-2.5 flex-1 min-w-0 text-left transition-all ${
                        col.required ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                        col.visible
                          ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                          : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                      }`}>
                        {col.visible && <Check size={11} strokeWidth={3} />}
                      </div>

                      <div className="min-w-0">
                        <span className={`text-xs font-bold truncate block ${
                          col.visible ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 line-through'
                        }`}>
                          {col.label}
                        </span>
                        {col.category && (
                          <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-mono">
                            {col.category}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Order buttons & Required indicator */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {col.required ? (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          Locked
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => moveColumnById(col.id, 'up')}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move column left / up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => moveColumnById(col.id, 'down')}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            title="Move column right / down"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div className="p-2.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-[10px] text-zinc-400 text-center font-medium">
            💡 Preferences are saved automatically to your device.
          </div>

        </div>
      )}
    </div>
  );
}
