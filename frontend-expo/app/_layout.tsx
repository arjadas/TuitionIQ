import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';
import { AppDataProvider } from '@/providers/AppDataProvider';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AppDataProvider>
        <StatusBar style="dark" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="student-form"
            options={{ presentation: 'modal', title: 'Student' }}
          />
          <Stack.Screen
            name="payment-form"
            options={{ presentation: 'modal', title: 'Record Payment' }}
          />
        </Stack>
      </AppDataProvider>
    </AppErrorBoundary>
  );
}

