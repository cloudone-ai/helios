import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "../ui/submit-button";
import { manageSubscription } from "@/lib/actions/billing";
import { PlanComparison, SUBSCRIPTION_PLANS } from "../billing/plan-comparison";
import { isLocalMode } from "@/lib/config";

type Props = {
    accountId: string;
    returnUrl: string;
}

export default async function AccountBillingStatus({ accountId, returnUrl }: Props) {
    // In local development mode, show a simplified component
    if (isLocalMode()) {
        return (
            <div className="rounded-xl border shadow-sm bg-card p-6">
                <h2 className="text-xl font-semibold mb-4">Billing Status</h2>
                <div className="p-4 mb-4 bg-muted/30 border border-border rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                        Running in local development mode - billing features are disabled
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Agent usage limits are not enforced in this environment
                    </p>
                </div>
            </div>
        );
    }

    const supabaseClient = await createClient();
    
    // Get account subscription and usage data
    const { data: subscriptionData } = await supabaseClient
        .schema('basejump')
        .from('billing_subscriptions')
        .select('*')
        .eq('account_id', accountId)
        .eq('status', 'active')
        .limit(1)
        .order('created_at', { ascending: false })
        .single();
    
    // Get agent runs for this account
    // Get the account's threads
    const { data: threads } = await supabaseClient
        .from('threads')
        .select('thread_id')
        .eq('account_id', accountId);
    
    const threadIds = threads?.map(t => t.thread_id) || [];
    
    // Get current month usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const isoStartOfMonth = startOfMonth.toISOString();
    
    let totalAgentTime = 0;
    let usageDisplay = "No usage this month";
    
    if (threadIds.length > 0) {
        const { data: agentRuns } = await supabaseClient
            .from('agent_runs')
            .select('started_at, completed_at')
            .in('thread_id', threadIds)
            .gte('started_at', isoStartOfMonth);
        
        if (agentRuns && agentRuns.length > 0) {
            const nowTimestamp = now.getTime();
            
            totalAgentTime = agentRuns.reduce((total, run) => {
                const startTime = new Date(run.started_at).getTime();
                const endTime = run.completed_at 
                    ? new Date(run.completed_at).getTime()
                    : nowTimestamp;
                
                return total + (endTime - startTime) / 1000; // In seconds
            }, 0);
            
            // Convert to minutes
            const totalMinutes = Math.round(totalAgentTime / 60);
            usageDisplay = `${totalMinutes} minutes`;
        }
    }
    
    const isPlan = (planId?: string) => {
        return subscriptionData?.price_id === planId;
    };
    
    const planName = isPlan(SUBSCRIPTION_PLANS.FREE) 
        ? "Free" 
        : isPlan(SUBSCRIPTION_PLANS.PRO)
            ? "Pro"
            : isPlan(SUBSCRIPTION_PLANS.ENTERPRISE)
                ? "Enterprise"
                : "Unknown";

    return (
        <div className="rounded-xl border shadow-sm bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Billing Status</h2>
            
            {subscriptionData ? (
                <>
                    <div className="mb-6">
                        <div className="rounded-lg border bg-background p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-foreground/90">Current Plan</span>
                                    <span className="text-sm font-medium text-card-title">{planName}</span>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">Agent Usage This Month</span>
                                <span className="text-sm font-medium text-card-title">{usageDisplay}</span>
                            </div>
                        </div>
                    </div>

                    {/* Plans Comparison */}
                    <PlanComparison
                        accountId={accountId}
                        returnUrl={returnUrl}
                        className="mb-6"
                    />

                    {/* Manage Subscription Button */}
                    <form>
                        <input type="hidden" name="accountId" value={accountId} />
                        <input type="hidden" name="returnUrl" value={returnUrl} />
                        <SubmitButton
                            pendingText="Loading..."
                            formAction={manageSubscription}
                            className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        >
                            Manage Subscription
                        </SubmitButton>
                    </form>
                </>
            ) : (
                <>
                    <div className="mb-6">
                        <div className="rounded-lg border bg-background p-4 gap-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">Current Plan</span>
                                <span className="text-sm font-medium text-card-title">Free</span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-foreground/90">Agent Usage This Month</span>
                                <span className="text-sm font-medium text-card-title">{usageDisplay}</span>
                            </div>
                        </div>
                    </div>

                    {/* Plans Comparison */}
                    <PlanComparison
                        accountId={accountId}
                        returnUrl={returnUrl}
                        className="mb-6"
                    />

                    {/* Manage Subscription Button */}
                    <form>
                        <input type="hidden" name="accountId" value={accountId} />
                        <input type="hidden" name="returnUrl" value={returnUrl} />
                        <SubmitButton
                            pendingText="Loading..."
                            formAction={manageSubscription}
                            className="w-full bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        >
                            Manage Subscription
                        </SubmitButton>
                    </form>
                </>
            )}
        </div>
    )
}
