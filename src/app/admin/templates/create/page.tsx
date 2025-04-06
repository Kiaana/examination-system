'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navbar } from '@/components/navbar';
import { adminAPI } from '@/lib/admin-api';
import { ProtectedRoute } from '@/components/protected-route';
import {
  QUESTION_TYPE_OPTIONS,
  COMMUNICATION_METHOD_OPTIONS,
  COMMUNICATION_SUBTYPE_OPTIONS
} from '@/lib/utils';

const ANY_SUBTYPE_VALUE = "__ANY__";

// 槽位接口
interface Slot {
  slot_order: number;
  required_question_type: string;
  required_communication_method?: string;
  required_communication_subtype?: string | null; // 明确可以为 null
}

export default function CreateTemplatePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // 模板基本信息
  const [name, setName] = useState('');
  const [baseType, setBaseType] = useState('intelligence'); // 'intelligence' 或 'communication'
  const [description, setDescription] = useState('');
  const [timeLimit, setTimeLimit] = useState(300); // 默认5分钟，单位秒

  // 槽位列表
  const [slots, setSlots] = useState<Slot[]>([]);

  // 错误信息
  const [error, setError] = useState<string | null>(null);
  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 添加新槽位
  const addSlot = () => {
    const newSlotOrder = slots.length > 0 ? Math.max(...slots.map(s => s.slot_order)) + 1 : 1;
    setSlots([...slots, {
      slot_order: newSlotOrder,
      required_question_type: 'coordinate', // 默认类型
    }]);
  };

  // 更新槽位信息
  const updateSlot = (index: number, field: string, value: string | null) => {
    const updatedSlots = [...slots];
    const slot = { ...updatedSlots[index] };

    // 更新字段
    (slot as any)[field] = value;

    // 如果更改了题目类型，清除通信相关字段
    if (field === 'required_question_type' && value !== 'communication') {
      delete slot.required_communication_method;
      delete slot.required_communication_subtype;
    }

    // 如果更改了通信方式，清除子类型
    if (field === 'required_communication_method' &&
      value !== 'sign_language' &&
      value !== 'semaphore') {
      delete slot.required_communication_subtype;
    }

    updatedSlots[index] = slot;
    setSlots(updatedSlots);
  };

  // 删除槽位
  const removeSlot = (index: number) => {
    const updatedSlots = [...slots];
    updatedSlots.splice(index, 1);

    // 重新排序
    updatedSlots.forEach((slot, idx) => {
      slot.slot_order = idx + 1;
    });

    setSlots(updatedSlots);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 表单验证
    if (!name.trim()) {
      setError('请输入模板名称');
      return;
    }

    if (slots.length === 0) {
      setError('请至少添加一个题目槽位');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 准备提交数据，确保 null 值被正确处理
      const templateData = {
        name,
        base_type: baseType,
        description,
        time_limit_seconds: timeLimit,
        is_active: true, // 默认激活
        slots: slots.map(slot => ({
          ...slot,
          required_communication_subtype: slot.required_communication_subtype || null
        })),
      };

      // 调用API创建模板
      await adminAPI.templates.createTemplate(templateData);

      // 创建成功，返回模板列表页
      router.push('/admin/templates');
    } catch (err: any) {
      setError(err.message || '创建模板失败');
      console.error('Failed to create template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 如果正在加载用户信息，显示加载状态
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">加载中...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute adminOnly>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <Button
            variant="outline"
            className="mb-6"
            onClick={() => router.push('/admin/templates')}
          >
            返回模板列表
          </Button>

          <h1 className="text-3xl font-bold mb-6">创建试卷模板</h1>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">基本信息</h2>

              <div className="grid gap-4 mb-6">
                <div>
                  <Label htmlFor="name">模板名称</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：基础情报收集"
                    className="mt-1"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="baseType">基础类型</Label>
                  <select
                    id="baseType"
                    value={baseType}
                    onChange={(e) => setBaseType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                  >
                    <option value="intelligence">情报收集</option>
                    <option value="communication">简易通信</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="description">描述</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="可选描述"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="timeLimit">时间限制（秒）</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                    min="60"
                    className="mt-1"
                    required
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">题目槽位</h2>
                <Button type="button" onClick={addSlot}>添加槽位</Button>
              </div>

              {slots.length === 0 ? (
                <p className="text-muted-foreground">暂无槽位，请点击"添加槽位"按钮添加</p>
              ) : (
                <div className="space-y-4">
                  {slots.map((slot, index) => (
                    <Card key={index} className="p-4 border border-muted">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">槽位 #{slot.slot_order}</h3>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeSlot(index)}
                        >
                          删除
                        </Button>
                      </div>

                      <div className="grid gap-4">
                        <div>
                          <Label>题目类型</Label>
                          <select
                            value={slot.required_question_type}
                            onChange={(e) => updateSlot(index, 'required_question_type', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                          >
                            {QUESTION_TYPE_OPTIONS.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {slot.required_question_type === 'communication' && (
                          <div>
                            <Label>通信方式</Label>
                            <select
                              value={slot.required_communication_method || ''}
                              onChange={(e) => updateSlot(index, 'required_communication_method', e.target.value)}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                              required
                            >
                              <option value="" disabled>选择通信方式</option>
                              {COMMUNICATION_METHOD_OPTIONS.map((method) => (
                                <option key={method.value} value={method.value}>
                                  {method.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {slot.required_question_type === 'communication' &&
                          (slot.required_communication_method === 'sign_language' ||
                            slot.required_communication_method === 'semaphore') && (
                            <div>
                              <Label>通信子类型</Label>
                              <select
                                value={slot.required_communication_subtype || ANY_SUBTYPE_VALUE}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // 修改这里，使用条件判断处理
                                  updateSlot(
                                    index,
                                    'required_communication_subtype',
                                    value === ANY_SUBTYPE_VALUE ? null : value
                                  );
                                }}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                              >
                                {/* 使用特殊值代替空字符串 */}
                                <option value={ANY_SUBTYPE_VALUE}>任意子类型</option>
                                {slot.required_communication_method &&
                                  COMMUNICATION_SUBTYPE_OPTIONS[slot.required_communication_method]?.map((subtype) => (
                                    <option key={subtype.value} value={subtype.value}>
                                      {subtype.label}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? '提交中...' : '创建模板'}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}