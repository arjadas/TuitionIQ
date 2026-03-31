import { useState, useEffect } from 'react';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/constants/config';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

/**
 * Hook to check if the backend API is reachable.
 * Performs a lightweight health check on mount and periodically.
 * 
 * @param checkInterval - How often to check connection (ms). Default: 30000 (30s)
 * @returns Connection status and manual retry function
 */
export const useApiHealth = (checkInterval = 30000) => {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    try {
      // Use a lightweight endpoint to check connectivity
      await apiClient.get(ENDPOINTS.STUDENTS);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkConnection();

    // Set up periodic health checks
    const interval = setInterval(checkConnection, checkInterval);

    return () => clearInterval(interval);
  }, [checkInterval]);

  return {
    status,
    isConnected: status === 'connected',
    isChecking: status === 'checking',
    lastChecked,
    retry: checkConnection,
  };
};
