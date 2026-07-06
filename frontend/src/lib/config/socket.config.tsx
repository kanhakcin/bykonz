import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/use-auth';

const baseUserURLSocket = import.meta.env.VITE_URI_SOCKET || '';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = useAuth.getState().token;
    if (!token) {
      return;
    }

    const newSocket = io(baseUserURLSocket, {
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {});

    newSocket.on('connect_error', (_error) => {
      // Logic to handle failures (e.g., renew token)
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context.socket;
}

/**
 * Safe wrapper that returns null when SocketProvider is not mounted,
 * instead of throwing. Uses useContext directly to avoid Rules-of-Hooks violation.
 */
export function useSocketSafe() {
  const context = useContext(SocketContext);
  return context?.socket ?? null;
}
