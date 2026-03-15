import { useEffect, useState } from 'react';

import { ENDPOINTS } from '@/constants/config';
import { apiClient } from '@/services/api/client';

type ConnectionStatus = 'checking' | 'connected' | 'disconnected';

export const useApiHealth = (checkInterval = 30000) => {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkConnection = async () => {
    try {
      await apiClient.get(ENDPOINTS.STUDENTS);
      setStatus('connected');
    } catch {
      setStatus('disconnected');
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkConnection();
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
