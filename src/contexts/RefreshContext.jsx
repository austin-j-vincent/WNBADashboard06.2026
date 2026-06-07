import { createContext, useContext, useState, useCallback, useRef } from 'react';

const RefreshContext = createContext();

export function RefreshProvider({ children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const modulesRef = useRef(new Set());

  // Modules call this to register their refresh function (cleanup on unmount)
  const registerModule = useCallback((refreshFn) => {
    modulesRef.current.add(refreshFn);
    return () => modulesRef.current.delete(refreshFn);
  }, []);

  // Called by RefreshButton; calls all registered modules' refresh functions
  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const promises = Array.from(modulesRef.current).map(refreshFn =>
        Promise.resolve(refreshFn())
      );
      await Promise.all(promises);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <RefreshContext.Provider value={{ triggerRefresh, isRefreshing, registerModule }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used inside RefreshProvider');
  return ctx;
}
