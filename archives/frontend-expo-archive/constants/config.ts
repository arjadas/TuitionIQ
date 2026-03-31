import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extractHost = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const withoutProtocol = value.replace(/^[a-zA-Z]+:\/\//, '');
  const hostPort = withoutProtocol.split('/')[0];
  const host = hostPort.split(':')[0];
  return host || null;
};

const getLanHostFromExpo = (): string | null => {
  const fromExpoConfig = extractHost((Constants.expoConfig as { hostUri?: string } | null)?.hostUri);
  if (fromExpoConfig) {
    return fromExpoConfig;
  }

  const fromLinkingUri = extractHost(Constants.linkingUri);
  if (fromLinkingUri) {
    return fromLinkingUri;
  }

  // Expo Go development runtime often exposes debuggerHost.
  return extractHost(
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost
  );
};

const resolveApiBaseUrl = () => {
  const envApiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (envApiBaseUrl) {
    // On real devices, localhost points to the device itself.
    if (Platform.OS !== 'web' && /(localhost|127\.0\.0\.1|::1)/i.test(envApiBaseUrl)) {
      const lanHost = getLanHostFromExpo();
      if (lanHost) {
        return envApiBaseUrl.replace(/localhost|127\.0\.0\.1|::1/gi, lanHost);
      }
    }

    return envApiBaseUrl;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  const lanHost = getLanHostFromExpo();
  if (lanHost) {
    return `http://${lanHost}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

export const ENDPOINTS = {
  STUDENTS: '/students',
  PAYMENT_RECORDS: '/paymentrecords',
} as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const CURRENT_YEAR = new Date().getFullYear();
export const CURRENT_MONTH = new Date().getMonth() + 1;
