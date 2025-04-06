'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { templatesAPI, ApiTemplateSummary } from '@/lib/api-client';
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Template {
  id: number;
  title: string; // 组件内使用 title (来自 api.name)
  type: 'intelligence' | 'communication'; // 组件内使用 type (来自 api.base_type)
  description: string; // description 可以直接用或处理 null
  questionCount: number; // 组件内使用 questionCount (来自 api.question_count)
  timeLimitMinutes: number; // 存储分钟数 (来自 api.time_limit_seconds)
}

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCommTemplate, setSelectedCommTemplate] = useState<Template | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (isAuthLoading || !user) {
        if(!isAuthLoading && !user) setIsTemplatesLoading(false);
        return;
    }
    try {
      setError(null);
      setIsTemplatesLoading(true);
      const activeApiTemplates = await templatesAPI.getActiveTemplates();

      const formattedTemplates: Template[] = activeApiTemplates.map((apiTemplate) => ({
        id: apiTemplate.id,
        title: apiTemplate.name,
        type: apiTemplate.base_type,
        description: apiTemplate.description || '暂无详细描述',
        questionCount: apiTemplate.question_count,
        timeLimitMinutes: Math.ceil(apiTemplate.time_limit_seconds / 60),
      }));

      setTemplates(formattedTemplates);
    } catch (err: any) {
      const errorMessage = err.message || '加载试卷模板失败，请检查网络连接或稍后重试。';
      setError(errorMessage);
      console.error('加载试卷模板失败:', err);
    } finally {
      setIsTemplatesLoading(false);
    }
  }, [user, isAuthLoading]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleStartQuiz = (template: Template) => {
    if (template.type === 'communication') {
      setSelectedCommTemplate(template);
      setIsRoleDialogOpen(true);
    } else {
      router.push(`/quiz/start/${template.id}`);
    }
  };

  const handleSelectRoleAndStart = (role: 'sender' | 'receiver') => {
    if (selectedCommTemplate) {
       setIsRoleDialogOpen(false);
       router.push(`/quiz/start/${selectedCommTemplate.id}?role=${role}`);
    }
  };

  const TemplateSkeleton = () => (
    <Card className="p-6">
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-full mb-4" />
      <Skeleton className="h-4 w-5/6 mb-4" />
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-10 w-full" />
    </Card>
  );

  const showLoading = isAuthLoading || isTemplatesLoading;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <h1 className="text-3xl font-bold mb-8 text-gray-800">选择试卷开始答题</h1>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>加载错误</AlertTitle>
              <AlertDescription>
                {error}
                <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={fetchTemplates}>
                   点此重试
                 </Button>
              </AlertDescription>
            </Alert>
          )}

          {showLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <TemplateSkeleton key={`skeleton-${i}`} />)}
            </div>
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <Card key={template.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow duration-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-gray-900">{template.title}</CardTitle>
                    <CardDescription className="text-gray-600">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                      <span>题目数量:</span>
                      <span className="font-medium text-gray-700">{template.questionCount} 题</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>答题时间:</span>
                      <span className="font-medium text-gray-700">约 {template.timeLimitMinutes} 分钟</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => handleStartQuiz(template)}
                      aria-label={`开始答题 - ${template.title}`}
                    >
                      开始答题
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-lg shadow">
              <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-5 text-lg font-medium text-gray-600">暂无可用试卷</p>
              <p className="mt-1 text-sm text-gray-500">
                {user?.role === 'admin' ? '请管理员前往后台添加或激活试卷模板。' : '请等待管理员发布新的试卷。'}
              </p>
              {user?.role === 'admin' && (
                <Button className="mt-6" onClick={() => router.push('/admin/templates')}>
                  前往模板管理
                </Button>
              )}
            </div>
          )}
        </main>

        <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>选择角色 (通信试卷)</DialogTitle>
              <DialogDescription>
                您选择了通信类试卷：<span className="font-semibold">{selectedCommTemplate?.title}</span>。<br/>
                请选择您要扮演的角色。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row sm:justify-center gap-2 pt-4">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleSelectRoleAndStart('sender')}>
                  我是发送方 (看答案)
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => handleSelectRoleAndStart('receiver')}>
                  我是接收方 (做题目)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </ProtectedRoute>
  );
}