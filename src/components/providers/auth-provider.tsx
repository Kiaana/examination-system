// src/components/providers/auth-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation'; // 引入 usePathname
import { authAPI } from '@/lib/api-client';

// 用户接口定义
interface User {
  id: number;
  username: string;
  role: 'user' | 'admin'; // 明确角色类型
}

// Auth Context 类型定义
interface AuthContextType {
  user: User | null;
  error: string | null;
  isLoading: boolean; // 统一的加载状态
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  // error 状态可以移除，让调用方处理 Promise reject
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // 初始状态始终为加载中
  const router = useRouter();
  const pathname = usePathname(); // 获取当前路径

  // 核心：检查认证状态的函数
  const checkAuthStatus = useCallback(async () => {
    console.log("AuthProvider: Checking auth status...");
    setIsLoading(true);
    try {
      const userData = await authAPI.checkAuth(); // 成功则返回 User 对象
      console.log("AuthProvider: Auth check successful, user:", userData);
      setUser(userData);
    } catch (err) {
      console.log("AuthProvider: Auth check failed or user not logged in.");
      setUser(null); // 明确设置用户为 null
    } finally {
      console.log("AuthProvider: Auth check finished.");
      setIsLoading(false);
    }
  }, []); // useCallback 依赖为空，只创建一次

  // 组件挂载时首次检查认证状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]); // 依赖 checkAuthStatus

  // 登录函数
  const login = async (username: string, password: string) => {
    // 不需要 setIsLoading(true) 因为 checkAuthStatus 已经处理
    console.log("AuthProvider: Attempting login...");
    try {
      const response = await authAPI.login(username, password);
      if (response.user) {
        console.log("AuthProvider: Login successful, user:", response.user);
        setUser(response.user); // 更新用户状态
        // 登录后跳转到仪表盘，或根据来源跳转
        const redirectPath = pathname === '/login' ? '/dashboard' : pathname;
        router.push(redirectPath);
        // 可以选择在这里也调用 checkAuthStatus() 来确保状态同步，但通常 set User 就够了
      } else {
        // 理论上 login API 成功就应该返回 user，这里是防御性编程
         throw new Error(response.message || '登录响应无效');
      }
    } catch (err: any) {
      console.error("AuthProvider: Login failed:", err);
      // 让调用者处理错误，不在此处 setError
      throw err; // 重新抛出错误，让 Login 页面可以捕获并显示
    }
  };

  // 注册函数
  const register = async (username: string, password: string, role: string = 'user') => {
    console.log("AuthProvider: Attempting registration...");
    try {
      const response = await authAPI.register(username, password, role);
      if (response.user) {
        console.log("AuthProvider: Registration successful, user:", response.user);
        setUser(response.user);
        
        // 注册成功后，显式执行登录操作确保会话已建立
        try {
          await authAPI.login(username, password);
          // 重新验证身份状态，确保会话已正确设置
          await checkAuthStatus();
          router.push('/dashboard'); // 确认已登录后再跳转
        } catch (loginErr) {
          console.error("AuthProvider: Auto-login after registration failed:", loginErr);
          // 注册成功但自动登录失败，引导用户手动登录
          router.push('/login?registered=true');
          throw new Error('注册成功，但自动登录失败，请手动登录');
        }
      } else {
        throw new Error(response.message || '注册响应无效');
      }
    } catch (err: any) {
      console.error("AuthProvider: Registration failed:", err);
      throw err; // 重新抛出错误给 Register 页面处理
    }
  };

  // 登出函数
  const logout = async () => {
    console.log("AuthProvider: Attempting logout...");
    setIsLoading(true); // 登出时可以显示加载状态
    try {
      await authAPI.logout();
      console.log("AuthProvider: Logout successful.");
    } catch (err: any) {
      console.error("AuthProvider: Logout failed:", err);
      // 即便 API 调用失败，前端也应该清除状态并跳转
    } finally {
      setUser(null);
      // 不需要手动清除 localStorage，因为没有使用它持久化
      setIsLoading(false);
      console.log("AuthProvider: Redirecting to login page after logout.");
      router.push('/login'); // 登出后强制跳转到登录页
    }
  };

  // 移除 error 状态，由调用方处理错误
  const contextValue: AuthContextType = {
    user,
    isLoading,
    login,
    register,
    logout,
    error: null
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return context;
}