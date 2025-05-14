import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCookie, setCookie } from 'cookies-next';
import { defaultLocale } from './config';
import en from '../locales/en.json';
import zh from '../locales/zh.json';
import ja from '../locales/ja.json';
import ko from '../locales/ko.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import ru from '../locales/ru.json';

const resources: Record<string, any> = {
  en,
  zh,
  ja,
  ko,
  fr,
  de,
  es,
  ru,
};

function getLocaleFromPath(pathname: string): string {
  // 假设路径如 /en/xxx 或 /zh/xxx
  const match = pathname.match(/^\/(\w{2})(\/|$)/);
  if (match && resources[match[1]]) {
    return match[1];
  }
  return 'en';
}

export function useTranslation() {
  // 使用 useState 确保客户端渲染时能正确更新
  const [clientLocale, setClientLocale] = useState<string | null>(null);
  
  // 服务器端和客户端通用的路径获取
  const pathname = usePathname();
  const pathLocale = getLocaleFromPath(pathname);
  
  // 在客户端运行时获取语言设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 1. 先尝试从 cookie 读取
      const cookieLocale = getCookie('NEXT_LOCALE') as string;
      
      // 2. 如果 cookie 不可用，尝试从 localStorage 读取
      let localeToUse = cookieLocale;
      if (!localeToUse) {
        try {
          localeToUse = localStorage.getItem('NEXT_LOCALE');
        } catch (e) {
          console.warn('Failed to read locale from localStorage:', e);
        }
      }
      
      // 3. 如果还是没有语言设置，尝试使用浏览器默认语言
      if (!localeToUse && navigator.language) {
        // 获取浏览器语言设置（只取前两位，如 'ja-JP' 变为 'ja'）
        const browserLang = navigator.language.split('-')[0];
        
        // 检查浏览器语言是否在支持的语言列表中
        if (browserLang && resources[browserLang]) {
          localeToUse = browserLang;
          
          // 将浏览器语言保存到 cookie 和 localStorage
          setCookie('NEXT_LOCALE', browserLang, { maxAge: 60 * 60 * 24 * 365 });
          try {
            localStorage.setItem('NEXT_LOCALE', browserLang);
          } catch (e) {
            console.warn('Failed to save browser locale to localStorage:', e);
          }
        }
      }
      
      // 4. 如果找到有效的语言设置，则使用它
      if (localeToUse && resources[localeToUse]) {
        setClientLocale(localeToUse);
      }
    }
  }, []);
  
  // 确定最终使用的语言
  // 在服务器端使用路径或默认语言，在客户端使用 cookie 或路径
  const locale = typeof window !== 'undefined' && clientLocale ? clientLocale : pathLocale;
  
  // 获取对应语言的翻译资源
  const dict = resources[locale] || resources[defaultLocale];

  function t(key: string, vars?: Record<string, string | number>) {
    const keys = key.split('.');
    let value: any = dict;
    for (const k of keys) {
      value = value?.[k];
      if (value == null) return key;
    }
    if (typeof value === 'string' && vars) {
      // 简单变量替换 {var}
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(new RegExp(`{${k}}`, 'g'), String(v));
      });
    }
    return value;
  }

  return { t, locale };
}
