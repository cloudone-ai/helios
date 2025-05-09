"use client"

import { X, Zap, Github, Check } from "lucide-react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Portal } from "@/components/ui/portal"
import { cn } from "@/lib/utils"
import { setupNewSubscription } from "@/lib/actions/billing"
import { SubmitButton } from "@/components/ui/submit-button"
import { siteConfig } from "@/lib/home"
import { isLocalMode } from "@/lib/config"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { SUBSCRIPTION_PLANS } from "./plan-comparison"

interface PricingAlertProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeable?: boolean
  accountId?: string | null | undefined
}

export function PricingAlert({ open, onOpenChange, closeable = true, accountId }: PricingAlertProps) {
  const returnUrl = typeof window !== 'undefined' ? window.location.href : '';
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has an active subscription
  useEffect(() => {
    async function checkSubscription() {
      if (!accountId) {
        setHasActiveSubscription(false);
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase
          .schema('basejump')
          .from('billing_subscriptions')
          .select('price_id')
          .eq('account_id', accountId)
          .eq('status', 'active')
          .single();
        
        // Check if the user has a paid subscription (not free tier)
        const isPaidSubscription = data?.price_id && 
          data.price_id !== SUBSCRIPTION_PLANS.FREE;
        
        setHasActiveSubscription(isPaidSubscription);
      } catch (error) {
        console.error("Error checking subscription:", error);
        setHasActiveSubscription(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkSubscription();
  }, [accountId]);

  // Skip rendering in local development mode or if user has an active subscription
  if (isLocalMode() || !open || hasActiveSubscription || isLoading) return null;

  // Filter plans to show only Pro and Enterprise
  const premiumPlans = siteConfig.cloudPricingItems.filter(plan => 
    plan.name === 'Pro' || plan.name === 'Enterprise'
  );

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto py-8 px-4"
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={closeable ? () => onOpenChange(false) : undefined}
                aria-hidden="true"
              />
              
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className={cn(
                  "relative bg-background rounded-xl shadow-2xl w-full max-w-3xl mx-3 border border-border"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pricing-modal-title"
              >
                <div className="p-6">
                  {/* Close button */}
                  {closeable && (
                    <button
                      onClick={() => onOpenChange(false)}
                      className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Close dialog"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}

                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-2 bg-primary/10 rounded-full mb-3">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <h2 id="pricing-modal-title" className="text-2xl font-medium tracking-tight mb-2">
                      Choose Your Helios Experience
                    </h2>
                    <p className="text-muted-foreground max-w-lg mx-auto">
                      Due to overwhelming demand and AI costs, we're currently focusing on delivering 
                      our best experience to dedicated users. Select your preferred option below.
                    </p>
                  </div>

                  {/* Plan comparison - 3 column layout */}
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {/* Self-Host Option */}
                    <div className="rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border hover:border-muted-foreground/30 transition-all duration-300">
                      <div className="flex flex-col gap-4 p-4">
                        <p className="text-sm flex items-center">Open Source</p>
                        <div className="flex items-baseline mt-2">
                          <span className="text-2xl font-semibold">Self-host</span>
                        </div>
                        <p className="text-sm mt-2">Full control with your own infrastructure</p>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 border-primary/20 text-primary w-fit">
                          ∞ hours / month
                        </div>
                      </div>

                      <div className="px-4 pb-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">No usage limitations</span>
                        </div>
                        <Link 
                          href="https://github.com/cloudone-ai/helios" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="h-10 w-full flex items-center justify-center gap-2 text-sm font-normal tracking-wide rounded-full px-4 cursor-pointer transition-all ease-out active:scale-95 bg-secondary/10 text-secondary shadow-[0px_1px_2px_0px_rgba(255,255,255,0.16)_inset,0px_3px_3px_-1.5px_rgba(16,24,40,0.24),0px_1px_1px_-0.5px_rgba(16,24,40,0.20)]"
                        >
                          <Github className="h-4 w-4" />
                          <span>View on GitHub</span>
                        </Link>
                      </div>
                    </div>
                    
                    {/* Pro Plan */}
                    <div className="rounded-xl md:shadow-[0px_61px_24px_-10px_rgba(0,0,0,0.01),0px_34px_20px_-8px_rgba(0,0,0,0.05),0px_15px_15px_-6px_rgba(0,0,0,0.09),0px_4px_8px_-2px_rgba(0,0,0,0.10),0px_0px_0px_1px_rgba(0,0,0,0.08)] bg-accent relative transform hover:scale-105 transition-all duration-300">
                      <div className="absolute -top-3 -right-3">
                        <span className="bg-gradient-to-b from-secondary/50 from-[1.92%] to-secondary to-[100%] text-white h-6 inline-flex w-fit items-center justify-center px-3 rounded-full text-xs font-medium shadow-[0px_6px_6px_-3px_rgba(0,0,0,0.08),0px_3px_3px_-1.5px_rgba(0,0,0,0.08),0px_1px_1px_-0.5px_rgba(0,0,0,0.08),0px_0px_0px_1px_rgba(255,255,255,0.12)_inset,0px_1px_0px_0px_rgba(255,255,255,0.12)_inset]">
                          Most Popular
                        </span>
                      </div>
                      <div className="flex flex-col gap-4 p-4">
                        <p className="text-sm flex items-center font-medium">Pro</p>
                        <div className="flex items-baseline mt-2">
                          <span className="text-2xl font-semibold">{premiumPlans[0]?.price || "$19"}</span>
                          <span className="ml-2">/month</span>
                        </div>
                        <p className="text-sm mt-2">Supercharge your productivity with {premiumPlans[0]?.hours || "500 hours"} of Helios</p>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 border-primary/20 text-primary w-fit">
                          {premiumPlans[0]?.hours || "500 hours"}/month
                        </div>
                      </div>
                      
                      <div className="px-4 pb-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">Perfect for individuals and small teams</span>
                        </div>
                        <form>
                          <input type="hidden" name="accountId" value={accountId || ''} />
                          <input type="hidden" name="returnUrl" value={returnUrl} />
                          <input type="hidden" name="planId" value={
                            premiumPlans[0]?.stripePriceId || ''
                          } />
                          <SubmitButton
                            pendingText="..."
                            formAction={setupNewSubscription}
                            className="h-10 w-full flex items-center justify-center text-sm font-medium tracking-wide rounded-full px-4 cursor-pointer transition-all ease-out active:scale-95 bg-primary text-primary-foreground shadow-[inset_0_1px_2px_rgba(255,255,255,0.25),0_3px_3px_-1.5px_rgba(16,24,40,0.06),0_1px_1px_rgba(16,24,40,0.08)]"
                          >
                            Get Started Now
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                    
                    {/* Enterprise Plan */}
                    <div className="rounded-xl bg-[#F3F4F6] dark:bg-[#F9FAFB]/[0.02] border border-border hover:border-muted-foreground/30 transition-all duration-300">
                      <div className="flex flex-col gap-4 p-4">
                        <p className="text-sm flex items-center font-medium">Enterprise</p>
                        <div className="flex items-baseline mt-2">
                          <span className="text-2xl font-semibold">{premiumPlans[1]?.price || "$99"}</span>
                          <span className="ml-2">/month</span>
                        </div>
                        <p className="text-sm mt-2">Unlock boundless potential with {premiumPlans[1]?.hours || "2000 hours"} of Helios</p>
                        <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-primary/10 border-primary/20 text-primary w-fit">
                          {premiumPlans[1]?.hours || "2000 hours"}/month
                        </div>
                      </div>
                      
                      <div className="px-4 pb-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground">Ideal for larger organizations and power users</span>
                        </div>
                        <form>
                          <input type="hidden" name="accountId" value={accountId || ''} />
                          <input type="hidden" name="returnUrl" value={returnUrl} />
                          <input type="hidden" name="planId" value={
                            premiumPlans[1]?.stripePriceId || ''
                          } />
                          <SubmitButton
                            pendingText="..."
                            formAction={setupNewSubscription}
                            className="h-10 w-full flex items-center justify-center text-sm font-normal tracking-wide rounded-full px-4 cursor-pointer transition-all ease-out active:scale-95 bg-gradient-to-b from-secondary/50 from-[1.92%] to-secondary to-[100%] text-white shadow-[0px_1px_2px_0px_rgba(255,255,255,0.16)_inset,0px_3px_3px_-1.5px_rgba(16,24,40,0.24),0px_1px_1px_-0.5px_rgba(16,24,40,0.20)]"
                          >
                            Upgrade to Enterprise
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  )
} 