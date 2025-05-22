// 使用js-cookie替代next/headers
import Cookies from 'js-cookie';
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

export function getTranslations() {
  // 尝试从 cookie 获取语言设置
  // 使用js-cookie获取cookie值
  let cookieLocale;
  
  // 在服务器端和客户端都能正常工作
  if (typeof window !== 'undefined') {
    // 客户端环境
    cookieLocale = Cookies.get('NEXT_LOCALE');
  } else {
    // 服务器端环境，使用默认语言
    cookieLocale = defaultLocale;
  }
  
  // 确定使用的语言
  const locale = cookieLocale && resources[cookieLocale] ? cookieLocale : defaultLocale;
  
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