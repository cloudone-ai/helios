import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Briefcase, ExternalLink } from "lucide-react"
import { KortixProcessModal } from "@/components/sidebar/kortix-enterprise-modal"
import { useTranslation } from "@/i18n/useTranslation"

export function CTACard() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col space-y-2 py-2 px-1">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{t('sidebar.enterpriseDemo')}</span>
        <span className="text-xs text-muted-foreground mt-0.5">{t('sidebar.aiEmployees')}</span>
      </div>
      <div className="flex flex-col space-y-2">
        <KortixProcessModal />
        {/* <Link href="https://cal.com/marko-kraemer/15min" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            Schedule Demo
            <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </Link> */}
      </div>
      
      <div className="flex items-center mt-1">
        <Link 
          href="mailto:info@cloud1soft.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Briefcase className="mr-1.5 h-3.5 w-3.5" />
          {t('sidebar.joinTeam')}
        </Link>
      </div>
    </div>
  )
}
