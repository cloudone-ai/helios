"use client";

import { SectionHeader } from "@/components/home/section-header";
import React, { useEffect, useState } from "react";
import { useTranslation } from '@/i18n/useTranslation';
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

interface UseCase {
  id: string;
  title: string;
  description: string;
  category: string;
  featured: boolean;
  icon: React.ReactNode;
  image: string;
  url: string;
}

export function UseCasesSection() {
  const { t } = useTranslation();
  const [featuredUseCases, setFeaturedUseCases] = useState<UseCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPublicProjects() {
      try {
        setLoading(true);
        const response = await fetch('/api/public-projects');
        
        if (!response.ok) {
          throw new Error(`Error fetching public projects: ${response.statusText}`);
        }
        
        const data = await response.json();
        setFeaturedUseCases(data);
      } catch (err) {
        console.error('Failed to fetch public projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProjects();
  }, []);

  return (
    <section
      id="use-cases"
      className="flex flex-col items-center justify-center gap-10 pb-10 w-full relative"
    >
      <SectionHeader>
        <h2 className="text-3xl md:text-4xl font-medium tracking-tighter text-center text-balance">{t('useCases.title')}
          
        </h2>
        <p className="text-muted-foreground text-center text-balance font-medium">{t('useCases.desc')}
          
        </p>
      </SectionHeader>

      <div className="relative w-full h-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">Loading use cases...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">Error: {error}</p>
          </div>
        ) : (
          <div className="grid min-[650px]:grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4 gap-4 w-full max-w-6xl mx-auto px-6">
            {featuredUseCases.map((useCase: UseCase) => (
            <div
              key={useCase.id}
              className="rounded-xl overflow-hidden relative h-fit min-[650px]:h-full flex flex-col md:shadow-[0px_61px_24px_-10px_rgba(0,0,0,0.01),0px_34px_20px_-8px_rgba(0,0,0,0.05),0px_15px_15px_-6px_rgba(0,0,0,0.09),0px_4px_8px_-2px_rgba(0,0,0,0.10),0px_0px_0px_1px_rgba(0,0,0,0.08)] bg-accent"
            >
              <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-secondary/10 p-2">
                    {useCase.icon && typeof useCase.icon === 'string' ? (
                      <div className="text-secondary w-4 h-4" dangerouslySetInnerHTML={{ __html: useCase.icon }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-secondary">
                        <path d="M7.75 19.25H16.25C17.3546 19.25 18.25 18.3546 18.25 17.25V8.75L13.75 4.25H7.75C6.64543 4.25 5.75 5.14543 5.75 6.25V17.25C5.75 18.3546 6.64543 19.25 7.75 19.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M18 9L14 9C13.4477 9 13 8.55228 13 8L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.5 14.5L11 13L12.5 14.5L14.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-lg font-medium line-clamp-1">{useCase.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {useCase.description}
                </p>
              </div>
              
              <div className="mt-auto">
                <hr className="border-border dark:border-white/20 m-0" />
                
                <div className="w-full h-[160px] bg-accent/10">
                  <div className="relative w-full h-full overflow-hidden">
                    <img 
                      src={useCase.image || `https://placehold.co/800x400/f5f5f5/666666?text=Suna+${useCase.title.split(' ').join('+')}`}
                      alt={`Helios ${useCase.title}`}
                      className="w-full h-full object-cover"
                    />
                    <a
                      href={useCase.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-start p-4 group"
                    >
                      <span className="flex items-center gap-2 text-sm text-white font-medium">
                        Watch replay 
                        <ArrowRight className="size-4 transform group-hover:translate-x-1 transition-transform" />
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
        
        {!loading && !error && featuredUseCases.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No use cases available yet.</p>
          </div>
        )}
      </div>
    </section>
  );
} 