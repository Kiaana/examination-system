'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminAPI } from '@/lib/admin-api';
// 导入 utils 中的类型显示函数
import { getQuestionTypeName, getCommunicationTypeDisplay, formatUtcToLocal } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProtectedRoute } from '@/components/protected-route';
import { Navbar } from '@/components/navbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, X, Link as LinkIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

// Interfaces (保持不变)
interface QuestionDetail {
  slot_order: number;
  question_id: number;
  content: string;
  type: string;
  communication_method: string | null;
  communication_subtype: string | null;
  user_answer: string | null;
  is_correct: boolean;
  score_awarded: number;
  correct_answer: string;
}

interface AttemptDetail {
  attemptId: number;
  userId: number;
  username: string;
  templateId: number;
  templateName: string;
  role: string | null;
  pairingCode: string | null;
  pairAttemptId: number | null;
  score: number | null;
  status: string;
  startTime: string;
  submissionTime: string | null;
  timeLimit: number | null;
  questions: QuestionDetail[];
  duration?: number;
}

export default function AdminAttemptDetailPage() {
  const router = useRouter();
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttemptDetail = async () => {
       if (!attemptId || typeof attemptId !== 'string') {
        console.error('Invalid attemptId:', attemptId);
        setError('无效的答题记录ID');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const numericAttemptId = parseInt(attemptId, 10);
        if (isNaN(numericAttemptId)) {
          throw new Error('Attempt ID必须是数字');
        }
        const data = await adminAPI.attempts.getAttempt(numericAttemptId);
        if (data.submissionTime && data.startTime) {
            const start = new Date(data.startTime).getTime();
            const end = new Date(data.submissionTime).getTime();
            data.duration = (end - start) / 1000;
        }
        setAttempt(data);
        setError(null);
      } catch (err: any) {
        console.error('加载答题详情失败:', err);
        setError(err.message || '加载答题详情失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (attemptId) {
      loadAttemptDetail();
    } else {
      setIsLoading(false);
      setError('无法获取答题记录ID');
    }

  }, [attemptId]);

  // 格式化时长 (保持不变)
  const formatDuration = (seconds: number | undefined | null) => {
    if (seconds === undefined || seconds === null) return '-';
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes} 分 ${remainingSeconds} 秒`;
  };

  // 计算得分和问题总数 (保持不变)
  const totalQuestions = attempt?.questions?.length ?? 0;
  const score = attempt?.score ?? 0;
  const scorePercentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          {/* ... (返回按钮, 加载状态, 错误状态 JSX 保持不变) ... */}
           <div className="flex justify-between items-center mb-6">
            <Button variant="outline" onClick={() => router.push('/admin/attempts')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>
          </div>

           {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">加载中...</span>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-red-500 mb-4"><X className="h-12 w-12 mx-auto" /></div>
                <h3 className="text-lg font-medium">加载失败</h3>
                <p className="text-gray-500 mt-2">{error}</p>
                <Button className="mt-4" onClick={() => router.push('/admin/attempts')}>返回列表</Button>
              </CardContent>
            </Card>
           ) : attempt ? (
            <>
              {/* 基础信息卡片 (保持不变) */}
              <Card className="mb-6">
                 <CardHeader>
                  <CardTitle className="text-xl">答题记录详情 #{attempt.attemptId}</CardTitle>
                </CardHeader>
                <CardContent>
                   {/* Grid content remains the same */}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">用户信息</p>
                      <p className="font-medium">{attempt.username} (ID: {attempt.userId})</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">试卷模板</p>
                      <p className="font-medium">{attempt.templateName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">角色</p>
                      <p className="font-medium">{attempt.role ? { 'sender': '发送方', 'receiver': '接收方' }[attempt.role] : '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">开始时间</p>
                      <p className="font-medium">{formatUtcToLocal(attempt.startTime)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">提交时间</p>
                      <p className="font-medium">{formatUtcToLocal(attempt.submissionTime)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">答题时长</p>
                      <p className="font-medium">{formatDuration(attempt.duration)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">状态</p>
                      <Badge className={
                        {
                          'completed': 'bg-green-100 text-green-800',
                          'timed_out': 'bg-orange-100 text-orange-800',
                          'started': 'bg-blue-100 text-blue-800',
                          'waiting_pair': 'bg-purple-100 text-purple-800',
                          'inprogress': 'bg-yellow-100 text-yellow-800'
                        }[attempt.status] || 'bg-gray-100 text-gray-800'
                      }>
                        {{
                          'completed': '已完成',
                          'timed_out': '已超时',
                          'started': '已开始',
                          'waiting_pair': '等待配对',
                          'inprogress': '进行中'
                        }[attempt.status] || attempt.status}
                      </Badge>
                    </div>
                    {attempt.pairingCode && (<div className="space-y-1"><p className="text-sm text-gray-500">配对码</p><p className="font-medium tracking-wider">{attempt.pairingCode}</p></div>)}
                    {attempt.pairAttemptId && (<div className="space-y-1"><p className="text-sm text-gray-500">配对记录</p><div className="flex items-center"><Button variant="link" className="h-auto p-0 text-blue-600 hover:text-blue-800" onClick={() => router.push(`/admin/attempts/${attempt.pairAttemptId}`)}>记录 #{attempt.pairAttemptId}<LinkIcon className="h-3 w-3 ml-1" /></Button></div></div>)}
                  </div>
                  {(attempt.status === 'completed' || attempt.status === 'timed_out') && totalQuestions > 0 && (
                    <div className="mt-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">得分: {score} / {totalQuestions}</span>
                        <span className="text-sm">正确率: {Math.round(scorePercentage)}%</span>
                      </div>
                      <Progress value={scorePercentage} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 题目详情表格 */}
              <Card className="mt-6">
                <CardHeader><CardTitle className="text-xl">题目详情</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">序号</TableHead>
                          <TableHead>题型</TableHead> {/* Title is "题型" */}
                          <TableHead>题目内容</TableHead>
                          <TableHead>用户答案</TableHead>
                          <TableHead>正确答案</TableHead>
                          <TableHead className="text-center w-[80px]">结果</TableHead>
                        </TableRow>
                      </TableHeader>
                      {/* 使用 utils.ts 中的函数显示类型 */}
                      <TableBody>
                        {attempt.questions?.length > 0 ? (
                            attempt.questions.map((q) => (
                            <TableRow key={`${q.question_id}-${q.slot_order}`}>
                              <TableCell>{q.slot_order}</TableCell>
                              {/* Use imported utility functions for type display */}
                              <TableCell>
                                {getQuestionTypeName(q.type)}
                                {q.type === 'communication' && (q.communication_method || q.communication_subtype) && (
                                  ` (${getCommunicationTypeDisplay(q.communication_method, q.communication_subtype)})`
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs md:max-w-md lg:max-w-lg whitespace-normal break-words">
                                  {q.content}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[150px] md:max-w-[200px] whitespace-normal break-words font-mono">
                                  {q.user_answer === null || q.user_answer === undefined || q.user_answer === '' ? '-' : q.user_answer}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[150px] md:max-w-[200px] whitespace-normal break-words font-mono">
                                  {q.correct_answer}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {q.user_answer !== null && q.user_answer !== undefined ? (
                                  q.is_correct ? (
                                    <span title="正确" className="inline-flex items-center justify-center rounded-full bg-green-100 text-green-800 p-1">
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : (
                                    <span title="错误" className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-800 p-1">
                                      <X className="h-4 w-4" />
                                    </span>
                                  )
                                ) : (
                                    <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-gray-500">
                                    没有找到题目详情。
                                </TableCell>
                            </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            // 未找到记录的 JSX (保持不变)
            <Card>
              <CardContent className="p-8 text-center">
                <h3 className="text-lg font-medium">记录未找到</h3>
                <p className="text-gray-500 mt-2">无法找到 ID 为 {attemptId} 的答题记录。</p>
                <Button className="mt-4" onClick={() => router.push('/admin/attempts')}>返回列表</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}