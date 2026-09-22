import { useState, useEffect, useMemo, useCallback } from 'react';

export interface ColumnDef<TKey extends string = string> {
  id: TKey;
  label: string;
  category?: string;
  required?: boolean; // If true, cannot be hidden (e.g. actions or name)
  defaultVisible?: boolean;
  minWidth?: string;
}

export interface UseTableColumnsReturn<TKey extends string = string> {
  columns: (ColumnDef<TKey> & { visible: boolean })[];
  visibleColumns: ColumnDef<TKey>[];
  visibleColumnIds: Set<TKey>;
  isColumnVisible: (id: TKey) => boolean;
  toggleColumn: (id: TKey) => void;
  setColumnVisibility: (id: TKey, visible: boolean) => void;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
  moveColumnById: (id: TKey, direction: 'up' | 'down') => void;
  showAllColumns: () => void;
  hideNonEssentialColumns: () => void;
  resetColumns: () => void;
}

export function useTableColumns<TKey extends string = string>(
  storageKey: string,
  initialColumns: ColumnDef<TKey>[]
): UseTableColumnsReturn<TKey> {
  // Map of column id -> visibility
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    initialColumns.forEach(col => {
      defaults[col.id] = col.defaultVisible !== false;
    });

    try {
      const saved = localStorage.getItem(`cols_vis_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load column visibility from localStorage:', e);
    }
    return defaults;
  });

  // Array of column ids representing order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const defaultOrder = initialColumns.map(c => c.id);
    try {
      const saved = localStorage.getItem(`cols_order_${storageKey}`);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        // Ensure all current columns are in the order, and remove defunct ones
        const validSaved = parsed.filter(id => defaultOrder.includes(id as any));
        const missing = defaultOrder.filter(id => !validSaved.includes(id));
        return [...validSaved, ...missing];
      }
    } catch (e) {
      console.warn('Failed to load column order from localStorage:', e);
    }
    return defaultOrder;
  });

  // Save to localStorage whenever visibility changes
  useEffect(() => {
    try {
      localStorage.setItem(`cols_vis_${storageKey}`, JSON.stringify(visibilityMap));
    } catch (e) {
      console.warn('Failed to save column visibility:', e);
    }
  }, [storageKey, visibilityMap]);

  // Save to localStorage whenever column order changes
  useEffect(() => {
    try {
      localStorage.setItem(`cols_order_${storageKey}`, JSON.stringify(columnOrder));
    } catch (e) {
      console.warn('Failed to save column order:', e);
    }
  }, [storageKey, columnOrder]);

  const initialColumnsMap = useMemo(() => {
    const map = new Map<string, ColumnDef<TKey>>();
    initialColumns.forEach(col => map.set(col.id, col));
    return map;
  }, [initialColumns]);

  // Ordered list of all column definitions with visibility flag
  const columns = useMemo(() => {
    return columnOrder
      .map(id => {
        const col = initialColumnsMap.get(id);
        if (!col) return null;
        return {
          ...col,
          visible: col.required ? true : (visibilityMap[id] ?? (col.defaultVisible !== false))
        };
      })
      .filter((c): c is ColumnDef<TKey> & { visible: boolean } => c !== null);
  }, [columnOrder, initialColumnsMap, visibilityMap]);

  // List of only visible columns in custom order
  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visible);
  }, [columns]);

  const visibleColumnIds = useMemo(() => {
    return new Set<TKey>(visibleColumns.map(c => c.id));
  }, [visibleColumns]);

  const isColumnVisible = useCallback(
    (id: TKey) => {
      const col = initialColumnsMap.get(id);
      if (col?.required) return true;
      return visibilityMap[id] ?? (col?.defaultVisible !== false);
    },
    [initialColumnsMap, visibilityMap]
  );

  const toggleColumn = useCallback((id: TKey) => {
    setVisibilityMap(prev => {
      const current = prev[id] ?? true;
      return { ...prev, [id]: !current };
    });
  }, []);

  const setColumnVisibility = useCallback((id: TKey, visible: boolean) => {
    setVisibilityMap(prev => ({ ...prev, [id]: visible }));
  }, []);

  const moveColumn = useCallback((dragIndex: number, hoverIndex: number) => {
    setColumnOrder(prev => {
      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);
      return updated;
    });
  }, []);

  const moveColumnById = useCallback((id: TKey, direction: 'up' | 'down') => {
    setColumnOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const updated = [...prev];
      const [removed] = updated.splice(idx, 1);
      updated.splice(targetIdx, 0, removed);
      return updated;
    });
  }, []);

  const showAllColumns = useCallback(() => {
    const allVisible: Record<string, boolean> = {};
    initialColumns.forEach(c => {
      allVisible[c.id] = true;
    });
    setVisibilityMap(allVisible);
  }, [initialColumns]);

  const hideNonEssentialColumns = useCallback(() => {
    const essentialOnly: Record<string, boolean> = {};
    initialColumns.forEach(c => {
      essentialOnly[c.id] = c.required || c.defaultVisible !== false;
    });
    setVisibilityMap(essentialOnly);
  }, [initialColumns]);

  const resetColumns = useCallback(() => {
    const defaults: Record<string, boolean> = {};
    initialColumns.forEach(c => {
      defaults[c.id] = c.defaultVisible !== false;
    });
    setVisibilityMap(defaults);
    setColumnOrder(initialColumns.map(c => c.id));
  }, [initialColumns]);

  return {
    columns,
    visibleColumns,
    visibleColumnIds,
    isColumnVisible,
    toggleColumn,
    setColumnVisibility,
    moveColumn,
    moveColumnById,
    showAllColumns,
    hideNonEssentialColumns,
    resetColumns
  };
}
