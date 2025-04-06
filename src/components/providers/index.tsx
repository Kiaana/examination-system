'use client';

import { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { SocketProvider } from './socket-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SocketProvider>
        {children}
      </SocketProvider>
    </AuthProvider>
  );
}