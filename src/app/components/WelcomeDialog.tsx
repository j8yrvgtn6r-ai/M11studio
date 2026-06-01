import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sparkles, FileText, CheckCircle2, Database, Users } from 'lucide-react';

interface WelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeDialog({ open, onOpenChange }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl shadow-2xl ring-2 ring-primary/20 dark:ring-primary/30 border-2 border-primary/30 dark:border-primary/40 bg-gradient-to-br from-card via-card to-card/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-6 w-6 text-primary" />
            Welcome to M11 Studio
          </DialogTitle>
          <DialogDescription>
            An enterprise IDE for authoring ICH M11 / CeSHarP-compliant clinical trial protocols
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h3 className="font-semibold mb-3">Key Features</h3>
            <div className="grid grid-cols-2 gap-3">
              <FeatureCard
                icon={FileText}
                title="Protocol Explorer"
                description="Navigate your protocol hierarchy with real-time status indicators"
              />
              <FeatureCard
                icon={CheckCircle2}
                title="M11 Compliance"
                description="Built-in validation rules and controlled terminology support"
              />
              <FeatureCard
                icon={Sparkles}
                title="AI Copilot"
                description="Intelligent assistant for drafting and compliance checking"
              />
              <FeatureCard
                icon={Database}
                title="Downstream Mappings"
                description="Automatic CDASH, SDTM, and FHIR mapping suggestions"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-3">Status Color System</h3>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-500/30">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                Complete
              </Badge>
              <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-500/30">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                In Progress
              </Badge>
              <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-500/30">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-1.5" />
                Required Missing
              </Badge>
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30">
                <div className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
                Conditional Missing
              </Badge>
              <Badge variant="outline" className="text-violet-600 dark:text-violet-400 border-violet-500/30">
                <div className="w-2 h-2 rounded-full bg-violet-500 mr-1.5" />
                AI Suggestion
              </Badge>
              <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-500/30">
                <div className="w-2 h-2 rounded-full bg-purple-500 mr-1.5" />
                Reused/Linked
              </Badge>
              <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-500/30">
                <div className="w-2 h-2 rounded-full bg-orange-500 mr-1.5" />
                Amended
              </Badge>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-2">Quick Start</h3>
            <ol className="text-sm space-y-1.5 list-decimal list-inside text-muted-foreground">
              <li>Select a section from the Protocol Explorer on the left</li>
              <li>Edit fields in the Document Viewport using structured forms</li>
              <li>View validation issues and metadata in the Detail Inspector</li>
              <li>Use the AI Copilot to draft content and check M11 compliance</li>
              <li>Press ⌘K to open the command palette for quick actions</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card/50">
      <div className="shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium mb-0.5">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
