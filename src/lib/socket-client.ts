// src/lib/socket-client.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getSocketUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:7575'; // 确认端口是 5000
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    return `http://${baseUrl}`;
  }
  return baseUrl;
}

export const initSocket = (): Socket => {
  if (!socket) {
    const socketUrl = getSocketUrl();
    const path = "/socket.io";
    // **修改这里：明确连接到 /quiz 命名空间**
    const namespace = "/quiz";
    console.log(`Initializing socket connection to namespace ${namespace} at: ${socketUrl} with path ${path}`);
    // Socket.IO v3+ 连接方式：URL + options
    // 命名空间通常附加在 URL 后面 *不是* v3/v4 的推荐方式
    // 正确方式通常是 io(url, options) 连接默认 ns，由服务器路由
    // 但如果服务器严格区分，客户端连接时指定也可以
    // 我们尝试在 io() 的第一个参数指定命名空间路径
    socket = io(`${socketUrl}${namespace}`, { // 将 /quiz 附加到 URL
      path: path,
      withCredentials: true,
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      transports: ['websocket', 'polling'],
    });

    // ---- 可选：添加全局调试监听器 ----
    // socket.onAny((event, ...args) => {
    //   console.log(`Socket event received on namespace ${socket?.nsp}: ${event}`, args); // 显示命名空间
    // });
    // socket.onAnyOutgoing((event, ...args) => {
    //    console.log(`Socket event sent on namespace ${socket?.nsp}: ${event}`, args); // 显示命名空间
    //  });
    // ---- 结束调试监听器 ----

  }
  return socket;
};

// connectSocket, disconnectSocket, getSocket, onSocketEvent, emitSocketEvent 保持不变

export const connectSocket = (): Socket => {
  const socket = initSocket();
  if (!socket.connected) {
    console.log("Attempting to connect socket...");
    socket.connect(); // 手动连接
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    console.log("Disconnecting socket...");
    socket.disconnect();
    // 可以选择将 socket 变量设为 null，以便下次重新初始化
    // socket = null;
  } else if (socket) {
     console.log("Socket exists but not connected, no action needed for disconnect.");
  } else {
     console.log("No socket instance to disconnect.");
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};

// onSocketEvent 现在直接操作 socket 实例
export const onSocketEvent = (event: string, callback: (...args: any[]) => void): (() => void) => {
  const currentSocket = getSocket(); // 获取当前 socket 实例
  if (!currentSocket) {
    console.error(`Cannot attach listener for "${event}": Socket not initialized.`);
    return () => {}; // 返回一个空的清理函数
  }
  console.log(`Attaching listener for event: ${event}`);
  currentSocket.on(event, callback);
  // 返回一个函数用于移除监听器
  return () => {
    console.log(`Removing listener for event: ${event}`);
    currentSocket.off(event, callback);
  };
};

// emitSocketEvent 现在直接操作 socket 实例
export const emitSocketEvent = (event: string, ...args: any[]) => {
  const currentSocket = getSocket(); // 获取当前 socket 实例
  if (currentSocket && currentSocket.connected) {
    currentSocket.emit(event, ...args);
  } else {
    console.error(`Cannot emit event "${event}": Socket not connected or initialized.`);
  }
};

// 默认导出可以移除或保留，取决于你的导入习惯
/*
export default {
  initSocket,
  connectSocket,
  disconnectSocket,
  getSocket,
  onSocketEvent,
  emitSocketEvent,
};
*/