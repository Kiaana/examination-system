import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 添加以下函数

// 题目主类型中文映射
export const getQuestionTypeName = (type: string | undefined | null): string => {
  if (!type) return '未知类型';
  
  switch(type) {
    case 'coordinate': return '坐标读取';
    case 'elevation': return '高程读取';
    case 'communication': return '通信题';
    default: return type;
  }
};

// 通信方法中文映射
export const getCommunicationMethodName = (method: string | undefined | null): string => {
  if (!method) return '';
  
  switch(method) {
    case 'sign_language': return '手语';
    case 'semaphore': return '旗语';
    case 'sound': return '音响';
    case 'light': return '光亮';
    default: return method;
  }
};

// 通信子类型中文映射 (基于父类型)
export const getCommunicationSubtypeName = (
  method: string | undefined | null, 
  subtype: string | undefined | null
): string => {
  if (!method || !subtype) return '';
  
  // 手语子类型
  if (method === 'sign_language') {
    switch(subtype) {
      case 'number': return '数字';
      case 'formation': return '队形';
      case 'command': return '命令';
      case 'inform': return '告知';
      case 'specific_designation': return '专指';
      case 'direction': return '方位';
      case 'sentence': return '句子 (组合)';
      default: return subtype;
    }
  }
  
  // 旗语子类型
  if (method === 'semaphore') {
    switch(subtype) {
      case 'command': return '指挥';
      case 'number': return '数字';
      case 'service': return '勤务';
      default: return subtype;
    }
  }
  
  return subtype; // 对于其他方法返回原始值
};

// 获取通信题完整类型显示
export const getCommunicationTypeDisplay = (
  method: string | undefined | null,
  subtype: string | undefined | null,
  isLongSentence?: boolean
): string => {
  const methodName = getCommunicationMethodName(method);
  const subtypeName = getCommunicationSubtypeName(method, subtype);
  
  let result = methodName;
  if (subtypeName) {
    result += ` - ${subtypeName}`;
  }
  
  return result;
};

// 题目类型选项列表
export const QUESTION_TYPE_OPTIONS = [
  { value: 'coordinate', label: getQuestionTypeName('coordinate') },
  { value: 'elevation', label: getQuestionTypeName('elevation') },
  { value: 'communication', label: getQuestionTypeName('communication') },
];

// 通信方式选项列表
export const COMMUNICATION_METHOD_OPTIONS = [
  { value: 'sign_language', label: getCommunicationMethodName('sign_language') },
  { value: 'semaphore', label: getCommunicationMethodName('semaphore') },
  { value: 'sound', label: getCommunicationMethodName('sound') },
  { value: 'light', label: getCommunicationMethodName('light') },
];

// 通信子类型选项，按方法分组
export const COMMUNICATION_SUBTYPE_OPTIONS = {
  sign_language: [
    { value: 'number', label: getCommunicationSubtypeName('sign_language', 'number') },
    { value: 'formation', label: getCommunicationSubtypeName('sign_language', 'formation') },
    { value: 'command', label: getCommunicationSubtypeName('sign_language', 'command') },
    { value: 'inform', label: getCommunicationSubtypeName('sign_language', 'inform') },
    { value: 'specific_designation', label: getCommunicationSubtypeName('sign_language', 'specific_designation') },
    { value: 'sentence', label: getCommunicationSubtypeName('sign_language', 'sentence') },
  ],
  semaphore: [
    { value: 'command', label: getCommunicationSubtypeName('semaphore', 'command') },
    { value: 'number', label: getCommunicationSubtypeName('semaphore', 'number') },
    { value: 'service', label: getCommunicationSubtypeName('semaphore', 'service') },
  ],
  sound: [],
  light: [],
};

// 添加基本类型选项
export const BASE_TYPE_OPTIONS = [
  { value: 'intelligence', label: '情报收集' },
  { value: 'communication', label: '简易通信' },
];

/**
 * 将假定为 UTC 的日期字符串格式化为用户的本地时区。
 * 如果输入字符串缺少时区指示符（如 'Z' 或偏移量），则假定其为 UTC 并添加 'Z' 进行解析。
 * 使用 'zh-CN' 区域设置进行格式化偏好（YYYY-MM-DD HH:MM:SS）。
 * @param utcDateString 来自后端的日期字符串（假定为 UTC 时间，即使缺少 'Z'）。
 * @param placeholder 如果日期无效或为 null/undefined 时返回的字符串。默认为 '-'。
 * @returns 格式化后的本地日期/时间字符串或占位符。
 */
export const formatUtcToLocal = (
  utcDateString: string | null | undefined,
  placeholder: string = '-'
): string => {
  if (!utcDateString) {
    return placeholder;
  }

  try {
    let processedString = utcDateString;

    // 检查字符串是否看起来像 ISO 格式但缺少时区信息
    // (简单检查：包含 'T'，不包含 'Z'，不包含 '+' 或 '-' 后面跟数字)
    const lacksTimezone = utcDateString.includes('T') &&
                          !utcDateString.endsWith('Z') &&
                          !/[+-]\d{2}:?\d{2}$/.test(utcDateString);

    if (lacksTimezone) {
      // 明确指定为 UTC
      processedString = utcDateString + 'Z';
      // console.log(`Appended 'Z' to date string: ${processedString}`); // 用于调试
    }

    // 使用处理后的字符串创建 Date 对象
    const date = new Date(processedString);

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn(`接收到无效或无法解析的日期字符串: ${utcDateString} (处理后: ${processedString})`);
      return placeholder;
    }

    // 使用 Intl.DateTimeFormat 或 toLocaleString 格式化日期
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      // timeZone: 'Asia/Shanghai', // 如果需要强制特定时区而非用户本地时区
    };

    // 根据之前的上下文使用 'zh-CN' 区域设置
    return date.toLocaleString('zh-CN', options);

  } catch (error) {
    console.error(`格式化日期字符串 "${utcDateString}" 时出错:`, error);
    return placeholder;
  }
};