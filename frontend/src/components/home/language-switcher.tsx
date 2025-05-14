"use client";

import { usePathname, useRouter } from 'next/navigation';  
import { useCallback, useEffect, useState } from 'react';  
import { Button } from '@/components/ui/button';  
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';  
import { Globe } from 'lucide-react';  
import { setCookie } from 'cookies-next';
  
const languages = [  
  { code: 'en', name: 'English' },  
  { code: 'zh', name: '中文' },  
  { code: 'ja', name: '日本語' },  
  { code: 'ko', name: '한국어' },  
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },  
  { code: 'ru', name: 'Русский' }  
];  
  
export function LanguageSwitcher() {  
  const router = useRouter();
  const pathname = usePathname();
  const [currentLocale, setCurrentLocale] = useState<string>('en');
  
  // 检测当前语言
  useEffect(() => {
    // 首先尝试从路径中获取当前语言
    const pathLocale = pathname.split('/')[1];
    
    if (languages.some(lang => lang.code === pathLocale)) {
      setCurrentLocale(pathLocale);
      return;
    }
    
    // 如果路径中没有有效的语言代码，尝试从 localStorage 获取
    if (typeof window !== 'undefined') {
      const storedLocale = localStorage.getItem('NEXT_LOCALE');
      if (storedLocale && languages.some(lang => lang.code === storedLocale)) {
        setCurrentLocale(storedLocale);
        return;
      }
    }
    
    // 如果还没有找到，尝试从 cookie 获取
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('NEXT_LOCALE='));
    
    if (cookieLocale) {
      const locale = cookieLocale.split('=')[1];
      if (languages.some(lang => lang.code === locale)) {
        setCurrentLocale(locale);
        return;
      }
    }
    
    // 如果都没有找到，默认使用 'en'
    setCurrentLocale('en');
  }, [pathname]);
    
  const changeLanguage = useCallback((locale: string) => {
    // 1. 同时在 cookie 和 localStorage 中保存用户语言偏好
    setCookie('NEXT_LOCALE', locale, { maxAge: 60 * 60 * 24 * 365 });
    
    // 同时在 localStorage 中保存，以防 cookie 被禁用
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('NEXT_LOCALE', locale);
      } catch (e) {
        console.warn('Failed to save locale to localStorage:', e);
      }
    }
    
    // 2. 判断是否在首页
    const isHomePage = pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname);
    
    if (isHomePage) {
      // 3. 如果在首页，直接刷新页面，不改变 URL
      window.location.reload();
    } else {
      // 4. 如果不在首页，保持当前路径，但更新语言设置
      // 移除路径中可能存在的语言代码前缀
      let pathParts = pathname.split('/').filter(Boolean);
      if (languages.some(lang => lang.code === pathParts[0])) {
        pathParts.shift(); // 移除语言代码
      }
      
      // 重新加载当前页面，但不添加语言代码到 URL
      window.location.href = '/' + pathParts.join('/');
    }
  }, [pathname, router]);
  
  return (  
    <DropdownMenu>  
      <DropdownMenuTrigger asChild>  
        <Button variant="ghost" size="icon" className="h-8 w-8">  
          <Globe className="h-4 w-4" />  
        </Button>  
      </DropdownMenuTrigger>  
      <DropdownMenuContent align="end">  
        {languages.map((lang) => (  
          <DropdownMenuItem   
            key={lang.code}  
            onClick={() => changeLanguage(lang.code)}  
            className={currentLocale === lang.code ? "bg-accent" : ""}  
          >  
            {lang.name} {currentLocale === lang.code && <span className="ml-2">✓</span>}
          </DropdownMenuItem>  
        ))}  
      </DropdownMenuContent>  
    </DropdownMenu>  
  );  
}
