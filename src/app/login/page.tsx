'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

// 定义表单验证模式
const loginSchema = z.object({
  username: z.string().min(2, {
    message: '用户名至少需要2个字符',
  }),
  password: z.string().min(5, {
    message: '密码至少需要5个字符',
  }),
});

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // 添加本地 error 状态

  // 初始化表单
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  // 提交表单
  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setIsLoading(true);
      setError(null); // 重置错误信息
      await login(values.username, values.password);
    } catch (error: any) {
      console.error('Login failed:', error);
      setError(error.message || '登录失败，请检查用户名和密码');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">答题系统</h1>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">登录</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              注册
            </Link>
          </p>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>用户名</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入用户名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="请输入密码" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}