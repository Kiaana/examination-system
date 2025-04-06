'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from '@/components/navbar';
import { ProtectedRoute } from '@/components/protected-route';
import { adminAPI } from '@/lib/admin-api';
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Loader2, Save, ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  QUESTION_TYPE_OPTIONS,
  COMMUNICATION_METHOD_OPTIONS,
  COMMUNICATION_SUBTYPE_OPTIONS,
  BASE_TYPE_OPTIONS
} from '@/lib/utils';

const ANY_SUBTYPE_VALUE = "__ANY__";  // 使用特殊字符串而非空字符串

// --- 类型定义 ---

interface Slot {
  slot_id?: number;
  slot_order: number;
  required_question_type: 'coordinate' | 'elevation' | 'communication';
  required_communication_method?: 'sign_language' | 'semaphore' | 'sound' | 'light' | null;
  required_communication_subtype?: string | null;
}

interface AdminTemplateDetail {
  id: number;
  name: string;
  base_type: 'intelligence' | 'communication';
  description: string | null;
  time_limit_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  slots: Slot[];
}

interface TemplateFormData {
  name: string;
  base_type: 'intelligence' | 'communication';
  description: string;
  time_limit_seconds: number;
  is_active: boolean;
}


export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams<{ templateId: string }>();
  const templateIdStr = params.templateId;
  const templateId = parseInt(templateIdStr);
  const { user, isLoading: isAuthLoading } = useAuth();

  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    base_type: 'intelligence',
    description: '',
    time_limit_seconds: 300,
    is_active: true,
  });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTemplate = useCallback(async () => {
    if (isNaN(templateId) || !user || user.role !== 'admin') {
      setIsLoading(false);
      setError("无效的模板ID或权限不足。");
      return;
    }
    console.log(`Fetching template ${templateId}`);
    setIsLoading(true); setError(null);
    try {
      const templateData: AdminTemplateDetail = await adminAPI.templates.getTemplate(templateId);
      setFormData({
        name: templateData.name,
        base_type: templateData.base_type,
        description: templateData.description || '',
        time_limit_seconds: templateData.time_limit_seconds,
        is_active: templateData.is_active,
      });
      setSlots(templateData.slots?.sort((a, b) => a.slot_order - b.slot_order).map(s => ({
        ...s,
        required_communication_method: s.required_communication_method || null,
        required_communication_subtype: s.required_communication_subtype || null,
      })) || []);
    } catch (err: any) {
      setError(err.message || '获取模板详情失败');
      console.error(`获取模板 #${templateId} 失败:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId, user]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, is_active: checked }));
  };

  const handleBaseTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, base_type: value as 'intelligence' | 'communication' }));
  };

  const addSlot = () => {
    const newSlotOrder = slots.length > 0 ? Math.max(...slots.map(s => s.slot_order)) + 1 : 1;
    setSlots(prevSlots => [...prevSlots, {
      slot_order: newSlotOrder,
      required_question_type: 'coordinate',
      required_communication_method: null,
      required_communication_subtype: null,
    }]);
  };

  const updateSlotField = (index: number, field: keyof Slot, value: any) => {
    setSlots(prevSlots => {
      const updatedSlots = [...prevSlots];
      const slotToUpdate = { ...updatedSlots[index] };
      
      // 处理通信子类型的特殊值
      if (field === 'required_communication_subtype' && value === ANY_SUBTYPE_VALUE) {
        slotToUpdate[field] = null;  // 将特殊值转换为 null
      } else {
        (slotToUpdate as any)[field] = value;
      }
  
      if (field === 'required_question_type' && value !== 'communication') {
        slotToUpdate.required_communication_method = null;
        slotToUpdate.required_communication_subtype = null;
      } else if (field === 'required_communication_method') {
        if (value !== 'sign_language' && value !== 'semaphore') {
          slotToUpdate.required_communication_subtype = null;
        }
      }
      updatedSlots[index] = slotToUpdate;
      return updatedSlots;
    });
  };

  const removeSlot = (index: number) => {
    setSlots(prevSlots => {
      const updatedSlots = prevSlots.filter((_, i) => i !== index);
      return updatedSlots.map((slot, idx) => ({ ...slot, slot_order: idx + 1 }));
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return;
    }
    setSlots(prevSlots => {
      const items = Array.from(prevSlots);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      return items.map((item, index) => ({ ...item, slot_order: index + 1 }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) return setError('请输入模板名称');
    if (formData.time_limit_seconds <= 0) return setError('时间限制必须大于0秒');
    if (slots.length === 0) return setError('请至少添加一个题目槽位');

    for (const slot of slots) {
      if (slot.required_question_type === 'communication') {
        if (!slot.required_communication_method) {
          return setError(`槽位 #${slot.slot_order}: 通信题必须选择通信方式`);
        }
        // 子类型可以为 null (任意)
      }
    }

    const templateData = {
      ...formData,
      slots: slots.map(s => ({
        slot_order: s.slot_order,
        required_question_type: s.required_question_type,
        required_communication_method: s.required_communication_method || null,
        required_communication_subtype: s.required_communication_subtype || null,
      })),
    };

    console.log("准备更新的数据:", templateData);
    setIsSubmitting(true);

    try {
      await adminAPI.templates.updateTemplate(templateId, templateData);
      toast.success(`模板 #${templateId} 更新成功！`);
      router.push('/admin/templates');
      router.refresh();
    } catch (err: any) {
      const errorMsg = err.message || '更新模板失败，请检查输入或稍后重试。';
      setError(errorMsg);
      toast.error("更新失败", { description: errorMsg });
      console.error(`更新模板 #${templateId} 失败:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSkeleton = () => (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto py-8 px-4">
        <Skeleton className="h-10 w-40 mb-6" /> {/* Back Button Skeleton */}
        <h1 className="text-2xl md:text-3xl font-bold mb-6"><Skeleton className="h-8 w-64" /></h1>
        <Skeleton className="h-10 w-full mb-6" /> {/* Error Alert Skeleton */}
        <form>
          <Card className="p-6 md:p-8 mb-6">
            <Skeleton className="h-6 w-40 mb-6" /> {/* Basic Info Title Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10" /></div>
              <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10" /></div>
              <div className="space-y-2 flex items-center pt-6"><Skeleton className="h-6 w-6 rounded-sm" /><Skeleton className="h-4 w-28 ml-2" /></div>
              <div className="space-y-2 md:col-span-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-20" /></div>
            </div>
          </Card>
          <Card className="p-6 md:p-8 mb-6">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <Skeleton className="h-6 w-32" /> <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-24 w-full" /> {/* Slot Skeleton */}
          </Card>
          <div className="flex justify-end"> <Skeleton className="h-12 w-32" /> </div>
        </form>
      </main>
    </div>
  );

  const renderSlotCard = (slot: Slot, index: number, providedDrag: any) => (
    <div
      ref={providedDrag.innerRef}
      {...providedDrag.draggableProps}
      className="border border-gray-200 rounded-lg bg-gray-50 relative group"
    >
      <div
        {...providedDrag.dragHandleProps}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 cursor-grab text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="拖拽排序"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="p-4 pl-10">
        <div className="flex justify-between items-center mb-3">
          <p className="font-medium text-gray-800">题目 #{slot.slot_order}</p>
          <Button type="button" variant="ghost" size="icon" onClick={() => removeSlot(index)} className="text-red-500 hover:bg-red-100 h-7 w-7" title="删除此槽位">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor={`slot-type-${index}`} className="text-xs font-medium">题目类型 <span className="text-red-500">*</span></Label>
            <Select
              value={slot.required_question_type}
              onValueChange={(value) => updateSlotField(index, 'required_question_type', value as any)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择题目类型" />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {slot.required_question_type === 'communication' && (
            <div className="space-y-1">
              <Label htmlFor={`slot-method-${index}`} className="text-xs font-medium">通信方式 <span className="text-red-500">*</span></Label>
              <Select
                value={slot.required_communication_method || ''}
                onValueChange={(value) => updateSlotField(index, 'required_communication_method', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择通信方式" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_METHOD_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {slot.required_question_type === 'communication' &&
            (slot.required_communication_method === 'sign_language' || slot.required_communication_method === 'semaphore') && (
              <div className="space-y-1">
                <Label htmlFor={`slot-subtype-${index}`} className="text-xs font-medium">通信子类型</Label>
                <Select
                  value={slot.required_communication_subtype || ANY_SUBTYPE_VALUE}
                  onValueChange={(value) => updateSlotField(
                    index,
                    'required_communication_subtype',
                    value === ANY_SUBTYPE_VALUE ? null : value
                  )}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择子类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 从utils导入的子类型列表中获取当前通信方式对应的子类型 */}
                    {slot.required_communication_method &&
                      COMMUNICATION_SUBTYPE_OPTIONS[slot.required_communication_method]?.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    {/* 添加"任意"选项，使用特殊值而非空字符串 */}
                    <SelectItem value={ANY_SUBTYPE_VALUE}>任意子类型</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
        </div>
      </div>
    </div>
  );

  if (isLoading || isAuthLoading) {
    return renderSkeleton();
  }

  if (error && !isSubmitting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto py-8 px-4">
          <Button variant="outline" className="mb-6" onClick={() => router.push('/admin/templates')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回模板列表
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>加载错误</AlertTitle>
            <AlertDescription>
              {error}
              <Button variant="link" className="ml-2" onClick={fetchTemplate}>重试</Button>
            </AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }


  return (
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen bg-gray-50">
        <Navbar />

        <main className="container mx-auto py-8 px-4">
          <Button
            variant="outline"
            className="mb-6"
            onClick={() => router.push('/admin/templates')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回模板列表
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold mb-6 text-gray-800">编辑试卷模板 #{templateId}</h1>

          {error && isSubmitting && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>保存失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Card className="p-6 md:p-8 mb-6 shadow-md bg-white">
              <h2 className="text-xl font-semibold mb-6 border-b pb-3 text-gray-700">基本信息</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-medium">模板名称 <span className="text-red-500">*</span></Label>
                  <Input id="name" name="name" value={formData.name} onChange={handleFormChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base_type" className="font-medium">基础类型 <span className="text-red-500">*</span></Label>
                  <Select name="base_type" value={formData.base_type} onValueChange={handleBaseTypeChange} required>
                    <SelectTrigger id="base_type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BASE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time_limit_seconds" className="font-medium">时间限制 (秒) <span className="text-red-500">*</span></Label>
                  <Input id="time_limit_seconds" name="time_limit_seconds" type="number" value={formData.time_limit_seconds} onChange={handleFormChange} required min="1" />
                </div>
                <div className="space-y-2 flex items-center pt-6">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={handleSwitchChange} />
                  <Label htmlFor="is_active" className="ml-2 font-medium cursor-pointer">激活模板 (用户可见)</Label>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description" className="font-medium">描述 (可选)</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleFormChange} placeholder="简单描述模板用途..." />
                </div>
              </div>
            </Card>

            <Card className="p-6 md:p-8 mb-6 shadow-md bg-white">
              <div className="flex justify-between items-center mb-6 border-b pb-3">
                <h2 className="text-xl font-semibold text-gray-700">题目槽位定义</h2>
                <Button type="button" onClick={addSlot} variant="outline" size="sm">
                  <Plus className="mr-1 h-4 w-4" /> 添加槽位
                </Button>
              </div>
              {slots.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无题目槽位，请点击“添加槽位”。</p>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="slotsDroppable">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                        {slots.map((slot, index) => (
                          <Draggable key={`slot-${slot.slot_id || index}`} draggableId={`slot-${slot.slot_id || index}`} index={index}>
                            {(providedDrag) => renderSlotCard(slot, index, providedDrag)}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Card>

            <CardFooter className="flex justify-end p-0 pt-6">
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="min-w-[120px]"
              >
                {isSubmitting ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Save className="mr-2 h-4 w-4" />)}
                {isSubmitting ? '正在保存...' : '保存更改'}
              </Button>
            </CardFooter>
          </form>
        </main>
      </div>
    </ProtectedRoute>
  );
}