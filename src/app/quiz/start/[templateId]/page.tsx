// src/app/quiz/start/[templateId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useSocket } from '@/components/providers/socket-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { attemptsAPI, ApiTemplateSummary, templatesAPI } from '@/lib/api-client';
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, Copy, Check, LinkIcon, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

// 组件内部状态接口
interface TemplateInfo extends ApiTemplateSummary { }

interface StartPageState {
  templateInfo: TemplateInfo | null;
  isLoadingTemplate: boolean;
  isStartingAttempt: boolean; // 用于发送方或情报题调用 start API
  isJoiningPairing: boolean; // 用于接收方调用 join_pairing
  startError: string | null; // startAttempt 的错误
  pairingError: string | null; // joinPairing 的错误
  attemptId: number | null; // 创建的 attemptId
  pairingCodeInput: string; // 接收方输入的配对码
  pairingCodeDisplay: string | null; // 发送方显示的配对码
  role: 'sender' | 'receiver' | null;
  isPartnerConnected: boolean; // 接收方是否已连接
}

export default function QuizStartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ templateId: string }>();
  const templateIdStr = params.templateId;
  const templateId = templateIdStr ? parseInt(templateIdStr) : NaN;
  const { user, isLoading: isAuthLoading } = useAuth();
  const { socket, isConnected, emit, on, connectError: socketConnectError } = useSocket();

  const [state, setState] = useState<StartPageState>({
    templateInfo: null,
    isLoadingTemplate: true,
    isStartingAttempt: false,
    isJoiningPairing: false,
    startError: null,
    pairingError: null,
    attemptId: null,
    pairingCodeInput: '',
    pairingCodeDisplay: null,
    role: null,
    isPartnerConnected: false // 新增字段，表示接收方是否已连接
  });
  const [copied, setCopied] = useState(false);

  // 1. 获取角色
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'sender' || roleParam === 'receiver') {
      setState(prev => ({ ...prev, role: roleParam }));
    } else {
      setState(prev => ({ ...prev, role: null }));
    }
  }, [searchParams]);

  // 2. 获取模板详情
  const fetchTemplateDetails = useCallback(async () => {
    if (isNaN(templateId) || !user) {
      if (isNaN(templateId)) {
        setState(prev => ({ ...prev, startError: "无效的试卷 ID。", isLoadingTemplate: false }));
      } else if (!user && !isAuthLoading) { // Only set error if auth check is complete and no user
        setState(prev => ({ ...prev, startError: "请先登录。", isLoadingTemplate: false }));
      } else {
        setState(prev => ({ ...prev, isLoadingTemplate: false })); // Still loading auth or user will load
      }
      return;
    }

    setState(prev => ({ ...prev, isLoadingTemplate: true, startError: null }));
    try {
      const templates = await templatesAPI.getActiveTemplates();
      const foundTemplate = templates.find(t => t.id === templateId);
      if (foundTemplate) {
        setState(prev => ({ ...prev, templateInfo: foundTemplate, isLoadingTemplate: false }));
        // 自动开始逻辑移至下面的 useEffect
      } else {
        throw new Error("无法找到指定的试卷模板，或该模板未激活。");
      }
    } catch (err: any) {
      console.error("获取模板详情失败:", err);
      setState(prev => ({
        ...prev,
        startError: err.message || '无法加载试卷详情，请返回重试。',
        isLoadingTemplate: false
      }));
    }
  }, [templateId, user, isAuthLoading]); // 添加 isAuthLoading 依赖

  useEffect(() => {
    // 只有在 user 认证状态明确后才获取模板详情
    if (!isAuthLoading) {
      fetchTemplateDetails();
    }
  }, [fetchTemplateDetails, isAuthLoading]);

  // 3. 调用后端 API 开始答题尝试 (由 useEffect 触发)
  const handleStartAttempt = useCallback(async () => {
    if (!user || !state.templateInfo || isNaN(templateId) || state.isStartingAttempt) return;

    // 防御性检查
    if (state.templateInfo.base_type === 'communication' && state.role !== 'sender') {
      console.warn("Attempted to auto-start non-sender/non-intelligence quiz. Blocked.");
      return;
    }

    setState(prev => ({ ...prev, isStartingAttempt: true, startError: null }));
    try {
      const response = await attemptsAPI.startAttempt(templateId, state.role ?? undefined);
      console.log("开始尝试 API 响应:", response);
      if (response.attemptId) {
        setState(prev => ({
          ...prev,
          attemptId: response.attemptId,
          pairingCodeDisplay: response.pairingCode || null,
          isStartingAttempt: false, // 完成
        }));
        if (!(state.role === 'sender' && response.pairingCode)) { // 如果不是需要显示配对码的发送方
          router.push(`/quiz/attempt/${response.attemptId}`);
        }
      } else {
        throw new Error(response.message || "开始答题失败，未返回尝试 ID。");
      }
    } catch (err: any) {
      console.error("开始答题尝试失败:", err);
      setState(prev => ({
        ...prev,
        startError: err.message || '开始答题时发生未知错误，请重试。',
        isStartingAttempt: false, // 完成
      }));
    }
  }, [user, templateId, state.role, state.templateInfo, router, state.isStartingAttempt]);

  // 4. 新增: useEffect 来触发 handleStartAttempt
  useEffect(() => {
    if (state.templateInfo && state.role !== null && !state.attemptId && !state.isStartingAttempt && !state.isLoadingTemplate) {
      if (state.role === 'sender' || state.templateInfo.base_type === 'intelligence') {
        console.log("Template and role ready, calling handleStartAttempt...");
        handleStartAttempt();
      }
    }
    // 注意: handleStartAttempt 已经在 useCallback 中并有正确的依赖项
  }, [state.templateInfo, state.role, state.attemptId, state.isStartingAttempt, state.isLoadingTemplate, handleStartAttempt]);


  // 5. 复制配对码
  const copyPairingCode = () => {
    if (state.pairingCodeDisplay) { // 使用 pairingCodeDisplay
      navigator.clipboard.writeText(state.pairingCodeDisplay).then(() => {
        setCopied(true);
        toast.success("配对码已复制", { duration: 2000 });
        setTimeout(() => setCopied(false), 2000);
      }, (err) => {
        console.error('复制失败: ', err);
        toast.error("复制失败", { description: "无法将配对码复制到剪贴板。" });
      });
    }
  };

  // 6. 处理接收方提交配对码
  const handleJoinPairing = useCallback(async () => {
    if (!state.pairingCodeInput.trim()) {
      setState(prev => ({ ...prev, pairingError: "请输入有效的配对码。" }));
      return;
    }

    setState(prev => ({ ...prev, isJoiningPairing: true, pairingError: null }));
    toast.info("正在尝试加入配对...");

    try {
      // 使用API客户端直接调用新接口
      const response = await attemptsAPI.joinPairing(
        state.pairingCodeInput.trim().toUpperCase(),
        templateId
      );

      if (response.attemptId) {
        toast.success("配对成功！正在进入答题...");
        router.push(`/quiz/attempt/${response.attemptId}`);
      } else {
        throw new Error(response.message || "配对失败，未能获取答题ID");
      }
    } catch (err: any) {
      console.error("加入配对失败:", err);
      const errorMsg = err.message || '加入配对失败，请重试。';
      setState(prev => ({ ...prev, pairingError: errorMsg, isJoiningPairing: false }));
      toast.error("加入失败", { description: errorMsg });
    }
  }, [state.pairingCodeInput, templateId, router]);

  // 7. 处理 WebSocket 配对结果事件 (接收方)
  useEffect(() => {
    if (!socket || !isConnected || state.role !== 'receiver') return;

    let unsubscribeSuccess: (() => void) | undefined;
    let unsubscribeFailed: (() => void) | undefined;
    let unsubscribeStart: (() => void) | undefined;

    // 只有在尝试加入时才监听 (isJoiningPairing is true)
    if (state.isJoiningPairing) {
      console.log("Receiver is waiting for pairing results...");

      unsubscribeSuccess = on('pairing_success', (data) => {
        console.log("Pairing Success event received:", data);
        toast.success("配对成功！", { description: `已与 ${data.senderUsername || '发送方'} 配对。` });
        // 不需要设置 isJoiningPairing false，等待 start_exam
      });

      unsubscribeFailed = on('pairing_failed', (data) => {
        console.log("Pairing Failed event received:", data);
        const errorMsg = data.message || '配对失败，请检查配对码或稍后重试。';
        setState(prev => ({ ...prev, pairingError: errorMsg, isJoiningPairing: false })); // 配对失败，重置 joining 状态
        toast.error("配对失败", { description: errorMsg });
      });

      unsubscribeStart = on('start_exam', (data) => {
        console.log("Start Exam event received:", data);
        if (data.attemptId) {
          toast.success("即将开始答题！");
          // 不需要 setState attemptId，因为直接跳转
          // setState(prev => ({ ...prev, isJoiningPairing: false, attemptId: data.attemptId }));
          router.push(`/quiz/attempt/${data.attemptId}`);
        } else {
          console.error("Start Exam event missing attemptId!");
          setState(prev => ({ ...prev, pairingError: "配对成功但无法开始考试，请重试。", isJoiningPairing: false }));
          toast.error("无法开始", { description: "配对成功但未能获取考试信息。" });
        }
      });
    }

    // 清理监听器
    return () => {
      unsubscribeSuccess?.();
      unsubscribeFailed?.();
      unsubscribeStart?.();
    };
  }, [socket, isConnected, state.role, state.isJoiningPairing, on, router]); // 依赖 isJoiningPairing

  // 在现有接收方的 WebSocket 监听器之后添加这个新的 useEffect

  // 7A. 处理 WebSocket 配对结果事件 (发送方专用)
  useEffect(() => {
    // 这个 Effect 只处理发送方监听配对成功
    if (!socket || !isConnected || state.role !== 'sender') return;

    let unsubscribeSuccess: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;
    let unsubscribeOpponentDisconnect: (() => void) | undefined;

    // 只有在显示了配对码且正在等待配对时监听
    if (state.pairingCodeDisplay) {
      console.log(`发送方 ${user?.username} 正在等待配对成功 (配对码: ${state.pairingCodeDisplay})...`);

      unsubscribeSuccess = on('pairing_success', (data) => {
        console.log("发送方收到配对成功事件:", data);
        toast.success(`接收方 ${data.receiverUsername || ''} 已加入！`);

        // 更新状态，同时更新状态为'inprogress'
        setState(prev => ({
          ...prev,
          isPartnerConnected: true
        }));

        // 跳转到答题页面，让发送方能够看到题目
        if (state.attemptId) {
          router.push(`/quiz/attempt/${state.attemptId}`);
        } else {
          console.error("缺少attemptId，无法跳转到答题页面");
          toast.error("配对成功，但无法加载题目，请刷新页面");
        }
      });

      unsubscribeError = on('error', (data) => {
        console.error("发送方收到 Socket 错误:", data);
        setState(prev => ({
          ...prev,
          startError: `配对过程中发生错误: ${data.message || '未知错误'}`,
          isStartingAttempt: false
        }));
      });

      unsubscribeOpponentDisconnect = on('opponent_disconnected', (data) => {
        console.log("发送方收到对方断开连接事件:", data);
        toast.warning("接收方已断开连接。");
        setState(prev => ({
          ...prev,
          isPartnerConnected: false,
          startError: "接收方已断开连接。"
        }));
      });
    }

    return () => {
      unsubscribeSuccess?.();
      unsubscribeError?.();
      unsubscribeOpponentDisconnect?.();
    };
  }, [socket, isConnected, state.role, state.pairingCodeDisplay, on, user?.username]);

  // 8. 处理 WebSocket 连接错误
  useEffect(() => {
    if (socketConnectError) {
      // 当 socket 连接出错时，也应该停止加入配对的状态
      setState(prev => ({
        ...prev,
        pairingError: `无法连接到服务器: ${socketConnectError}`,
        isJoiningPairing: false, // 重置加入状态
        isStartingAttempt: false // 重置开始状态
      }))
    }
  }, [socketConnectError]);


  // --- 渲染逻辑 ---

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-muted-foreground">验证用户信息...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto py-8 px-4 flex flex-col items-center">
          <div className="w-full max-w-2xl">
            <Button
              variant="outline"
              className="mb-6 self-start"
              onClick={() => router.push('/dashboard')}
              disabled={state.isStartingAttempt || state.isJoiningPairing} // 防止在操作时返回
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回试卷列表
            </Button>

            {/* 主要错误提示 */}
            {(state.startError || state.pairingError) && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>操作失败</AlertTitle>
                <AlertDescription>
                  {state.startError || state.pairingError}
                  {/* 提供不同的重试操作 */}
                  {state.startError && !state.isLoadingTemplate && (
                    <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={fetchTemplateDetails}>
                      重试加载模板
                    </Button>
                  )}
                  {state.pairingError && !state.isJoiningPairing && (
                    <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={handleJoinPairing}>
                      重试加入配对
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 模板信息加载或显示 */}
            {state.isLoadingTemplate ? (
              <Card className="p-6 text-center">
                <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mx-auto mb-6" />
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-12 w-full" />
              </Card>
            ) : state.templateInfo ? (
              <Card className="p-6 text-center shadow-md bg-white">
                <CardHeader className="p-0 mb-4">
                  <CardTitle className="text-2xl font-bold text-gray-800">{state.templateInfo.name}</CardTitle>
                  <CardDescription className="text-gray-600 mt-1">{state.templateInfo.description || '暂无描述'}</CardDescription>
                </CardHeader>

                <CardContent className="p-0 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-100 p-4 rounded-md">
                      <p className="text-sm text-gray-500">题目数量</p>
                      <p className="text-xl font-semibold text-gray-900">{state.templateInfo.question_count} 题</p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-md">
                      <p className="text-sm text-gray-500">时间限制</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {Math.ceil(state.templateInfo.time_limit_seconds / 60)} 分钟
                      </p>
                    </div>
                  </div>

                  {state.role && (
                    <div className="mt-4 text-sm text-indigo-600 font-medium">
                      您将以 <span className="font-bold">{state.role === 'sender' ? '发送方' : '接收方'}</span> 身份参与
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4 p-0 pt-6">
                  {/* --- 根据角色和状态显示不同内容 --- */}

                  {/* 发送方 */}
                  {state.role === 'sender' && (
                    state.isStartingAttempt ? (
                      <Button size="lg" className="w-full" disabled>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在获取配对码...
                      </Button>
                    ) : state.pairingCodeDisplay ? (
                      <div className="w-full bg-blue-50 border border-blue-200 p-4 rounded-md text-center">
                        <p className="text-sm text-blue-700 mb-2 font-medium">您的配对码</p>
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-3xl font-bold tracking-widest text-blue-900">{state.pairingCodeDisplay}</p>
                          <Button variant="ghost" size="icon" onClick={copyPairingCode} aria-label="复制配对码">
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500 hover:text-gray-700" />}
                          </Button>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          请将此配对码告知您的搭档（接收方）。<br />
                          接收方加入后，答题将自动开始。
                        </p>
                        <div className="mt-4 flex justify-center items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="ml-2 text-sm text-blue-700">
                            {state.isPartnerConnected
                              ? "接收方已连接！请等待对方完成答题..."
                              : "等待接收方加入..."}
                          </span>
                        </div>

                        {/* 如果已连接，显示额外提示 */}
                        {state.isPartnerConnected && (
                          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-700">
                              接收方已成功加入！正在进行答题，请耐心等待。
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert variant="default">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>获取失败</AlertTitle>
                        <AlertDescription>
                          {state.startError || "未能从服务器获取配对码。"}
                          <Button variant="link" className="p-0 h-auto ml-2 text-destructive hover:underline" onClick={handleStartAttempt}>重试</Button>
                        </AlertDescription>
                      </Alert>
                    )
                  )}

                  {/* 接收方 */}
                  {state.role === 'receiver' && (
                    <div className="w-full space-y-4">
                      <Label htmlFor="pairingCodeInput" className="text-sm font-medium text-gray-700">输入配对码</Label>
                      <div className="flex gap-2">
                        <Input
                          id="pairingCodeInput"
                          value={state.pairingCodeInput}
                          onChange={(e) => setState(prev => ({ ...prev, pairingCodeInput: e.target.value, pairingError: null }))} // 输入时清除错误
                          placeholder="请输入6位配对码"
                          maxLength={6}
                          className="flex-grow text-center text-lg tracking-widest font-mono uppercase" // 强制大写
                          disabled={state.isJoiningPairing}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !state.isJoiningPairing) handleJoinPairing(); }}
                          autoCapitalize="characters" // 移动端键盘大写
                        />
                        <Button
                          onClick={handleJoinPairing}
                          disabled={state.isJoiningPairing || !state.pairingCodeInput.trim() || !isConnected}
                          className="min-w-[100px]"
                        >
                          {state.isJoiningPairing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <LinkIcon className="mr-2 h-4 w-4" />
                          )}
                          {state.isJoiningPairing ? '加入中...' : '加入配对'}
                        </Button>
                      </div>
                      {!isConnected && <p className="text-xs text-red-500 mt-1">未连接到服务器，无法加入配对。</p>}
                    </div>
                  )}

                  {/* 情报题 (或未确定角色时，但模板是情报) */}
                  {(!state.role || state.role === null) && state.templateInfo.base_type === 'intelligence' && (
                    <Button
                      onClick={handleStartAttempt}
                      size="lg"
                      className="w-full"
                      disabled={state.isStartingAttempt || state.isLoadingTemplate || !!state.attemptId || isNaN(templateId) || !!state.startError}
                    >
                      {state.isStartingAttempt ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {state.isStartingAttempt ? '正在准备试卷...' : (state.attemptId ? '已开始，请稍候...' : '确认开始')}
                    </Button>
                  )}

                </CardFooter>
              </Card>
            ) : (
              !state.startError && <p className="text-muted-foreground text-center">无法加载试卷信息。</p>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}