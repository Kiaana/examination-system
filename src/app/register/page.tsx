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
const registerSchema = z.object({
  username: z.string().min(3, {
    message: '用户名至少需要3个字符',
  }),
  password: z.string().min(6, {
    message: '密码至少需要6个字符',
  }),
  confirmPassword: z.string().min(6, {
    message: '确认密码至少需要6个字符',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

export default function RegisterPage() {
  const { register, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // 初始化表单
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
    },
  });

  // 提交表单
  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      setIsLoading(true);
      await register(values.username, values.password);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">答题系统</h1>
          <h2 className="mt-6 text-2xl font-bold tracking-tight">注册</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            已有账号？{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              登录
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

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="请再次输入密码" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}