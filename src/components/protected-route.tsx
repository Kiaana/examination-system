'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers/auth-provider';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

/**
 * 路由保护组件，用于限制未登录用户访问受保护页面
 * 如果设置了adminOnly为true，则只有管理员可以访问
 */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 如果用户信息加载完成且未登录，重定向到登录页面
    if (!isLoading && !user) {
      router.push('/login');
    }
    
    // 如果需要管理员权限但用户不是管理员，重定向到仪表盘
    if (!isLoading && user && adminOnly && user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, isLoading, router, adminOnly]);

  // 如果正在加载用户信息，显示加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">加载中...</p>
      </div>
    );
  }

  // 如果用户未登录或需要管理员权限但用户不是管理员，不渲染内容（会被重定向）
  if (!user || (adminOnly && user.role !== 'admin')) {
    return null;
  }

  // 用户已登录且满足权限要求，渲染子组件
  return <>{children}</>;
}