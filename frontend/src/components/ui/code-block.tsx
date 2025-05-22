"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { useTheme } from "next-themes";

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({
  code,
  language = "tsx",
  theme: propTheme,
  className,
  ...props
}: CodeBlockCodeProps) {
  const { resolvedTheme } = useTheme();
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  
  // Use github-dark when in dark mode, github-light when in light mode
  const theme = propTheme || (resolvedTheme === 'dark' ? 'github-dark' : 'github-light');
  
  // 实现一个简单的方法，确保使用安全的语言
  // Shiki 支持的常见语言列表
  const supportedLanguages = [
    'javascript', 'typescript', 'jsx', 'tsx', 'html', 'css', 'json', 'python', 'bash', 'txt',
    'markdown', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
    'scala', 'sql', 'yaml', 'xml', 'shell', 'powershell'
  ];
  
  // 语言映射表
  const languageMap: Record<string, string> = {
    'plaintext': 'txt',
    'text': 'txt',
    'plain': 'txt',
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'md': 'markdown',
    'sh': 'shell',
    'yml': 'yaml'
  };
  
  // 获取安全的语言标识符
  let safeLanguage = 'txt'; // 默认使用 txt
  
  // 如果在映射表中，使用映射的值
  if (language && languageMap[language.toLowerCase()]) {
    safeLanguage = languageMap[language.toLowerCase()];
  } 
  // 如果语言在支持列表中，直接使用
  else if (language && supportedLanguages.includes(language.toLowerCase())) {
    safeLanguage = language.toLowerCase();
  }

  useEffect(() => {
    async function highlight() {
      try {
        // 使用安全的语言参数
        const html = await codeToHtml(code, { 
          lang: safeLanguage, 
          theme
        });
        
        setHighlightedHtml(html);
      } catch (error) {
        console.error("代码高亮错误:", error);
        // 如果高亮失败，回退到安全的纯文本显示
        const escapedCode = code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        setHighlightedHtml(`<pre style="background-color: #f5f5f5; padding: 1em; border-radius: 0.3em; overflow: auto;"><code>${escapedCode}</code></pre>`);
      }
    }
    highlight();
  }, [code, safeLanguage, theme]);

  const classNames = cn(
    "",
    className
  );

  // SSR fallback: render plain code if not hydrated yet
  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock };
