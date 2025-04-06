// src/components/providers/socket-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './auth-provider'; // 引入 useAuth
// 复用 socket-client.ts 中的函数
import { initSocket, connectSocket, disconnectSocket, onSocketEvent, emitSocketEvent, getSocket } from '@/lib/socket-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectError: string | null; // 重命名 error -> connectError 更清晰
  emit: (event: string, ...args: any[]) => boolean; // 返回是否成功发送 (socket存在且连接)
  on: (event: string, callback: (...args: any[]) => void) => (() => void) | undefined; // 返回清理函数或 undefined
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth(); // 获取用户和认证加载状态
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  // --- Socket 连接和断开逻辑 ---
  useEffect(() => {
    // 确保认证流程结束且用户存在
    if (!isAuthLoading && user) {
      console.log("SocketProvider: Auth complete and user exists. Attempting to connect socket...");
      // 初始化并连接 Socket
      const socket = connectSocket(); // connectSocket 内部会调用 initSocket 和 connect()
      setSocketInstance(socket); // 保存 socket 实例到 state

      // --- 事件监听器 ---
      const handleConnect = () => {
        setIsConnected(true);
        setConnectError(null);
        console.log(`Socket connected: ${socket.id} for user ${user.username}`);
      };

      const handleDisconnect = (reason: Socket.DisconnectReason) => {
        setIsConnected(false);
        // 可以根据 reason 提供更具体的错误信息
        console.log(`Socket disconnected: ${reason}`);
        if (reason === "io server disconnect") {
            // 服务器主动断开连接，可能是认证问题
            setConnectError("与服务器断开连接，可能需要重新登录。");
            // 可以在这里触发 AuthProvider 的 logout 或 checkAuth
        } else if (reason === "io client disconnect") {
            // 客户端主动断开
             console.log("Socket disconnected by client call.");
        } else {
            setConnectError("连接已断开。");
        }
      };

      const handleConnectError = (err: Error) => {
        // 仅当未连接时设置错误，避免覆盖 disconnect 的原因
        if (!isConnected) {
          setConnectError(`连接错误: ${err.message}`);
        }
        console.error('Socket connection error:', err);
      };

      // 注册事件监听
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('connect_error', handleConnectError);

      // --- 清理函数 ---
      return () => {
        console.log("SocketProvider: Cleaning up socket connection...");
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        // 当用户登出或组件卸载时断开连接
        disconnectSocket();
        setSocketInstance(null); // 清理 state 中的实例
        setIsConnected(false); // 重置连接状态
        setConnectError(null); // 清理错误
      };
    } else if (!isAuthLoading && !user) {
      // 如果认证结束但用户不存在，确保断开连接
      console.log("SocketProvider: Auth complete but no user. Ensuring socket is disconnected.");
      disconnectSocket(); // 确保断开
      setSocketInstance(null);
      setIsConnected(false);
      setConnectError(null);
    }
    // 依赖项：当 isAuthLoading 变化或 user 变化时重新执行
  }, [user, isAuthLoading]);

  // --- 事件发送和监听的封装 ---
  const emit = useCallback((event: string, ...args: any[]): boolean => {
    // 使用 state 中的 socketInstance
    if (socketInstance && socketInstance.connected) {
      emitSocketEvent(event, ...args);
      return true;
    } else {
      console.error(`Socket not connected or available. Cannot emit event: ${event}`);
      return false;
    }
  }, [socketInstance]); // 依赖 socketInstance

  const on = useCallback((event: string, callback: (...args: any[]) => void): (() => void) | undefined => {
    // 使用 state 中的 socketInstance
    if (socketInstance) {
      return onSocketEvent(event, callback); // onSocketEvent 返回清理函数
    } else {
      console.warn(`Socket not available. Cannot attach listener for event: ${event}`);
      return undefined; // 返回 undefined 表示未成功添加监听器
    }
  }, [socketInstance]); // 依赖 socketInstance

  // --- Context Value ---
  const contextValue: SocketContextType = {
    socket: socketInstance, // 提供当前的 socket 实例
    isConnected,
    connectError,
    emit,
    on,
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket 必须在 SocketProvider 内部使用');
  }
  return context;
}