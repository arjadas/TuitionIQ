import { useApiHealth } from '@/hooks/useApiHealth';

/**
 * Displays a banner when the backend API is not reachable.
 * Shows at the top of the page to alert users of connectivity issues.
 */
export const ConnectionStatus: React.FC = () => {
  const { status, retry, lastChecked } = useApiHealth();

  // Don't show anything if connected
  if (status === 'connected') {
    return null;
  }

  // Show checking state briefly
  if (status === 'checking') {
    return (
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center">
        <span className="text-yellow-800 text-sm">
          🔄 Checking connection to server...
        </span>
      </div>
    );
  }

  // Show disconnected state with retry option
  return (
    <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-3">
        <span className="text-red-800 text-sm font-medium">
          ⚠️ Cannot connect to server. Please try again after some time.
        </span>
        <button
          onClick={retry}
          className="bg-red-600 text-white text-xs px-3 py-1 rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
      {lastChecked && (
        <p className="text-red-600 text-xs mt-1">
          Last checked: {lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};
