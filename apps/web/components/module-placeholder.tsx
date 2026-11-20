import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ModulePlaceholderProps {
  moduleName: string;
  phase: string;
  description: string;
  icon: LucideIcon;
}

export function ModulePlaceholder({
  moduleName,
  phase,
  description,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center text-[#EA580C]">
          <Icon className="w-7 h-7" />
        </div>
        <CardHeader className="space-y-2 p-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-[#EA580C] mx-auto">
            {phase}
          </div>
          <CardTitle className="text-2xl font-bold text-[#0B132B]">
            {moduleName}
          </CardTitle>
          <CardDescription className="text-slate-600 max-w-md mx-auto">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 text-xs text-slate-400">
          Under active development for the Empulz Collaborative CRM suite.
        </CardContent>
      </Card>
    </div>
  );
}
