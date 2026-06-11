import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useEmployeeUsage } from '@/hooks/useRequests';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

export function EmployeeInfoCard({ employee }: { employee: Employee }) {
  const { data: used = 0 } = useEmployeeUsage(employee.id);

  const usagePill =
    used >= 5
      ? 'bg-red-100 text-red-800 border-red-200'
      : used === 4
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold text-slate-900">
              {employee.name}{' '}
              <span className="font-mono text-sm font-medium text-slate-500">
                {employee.emp_code}
              </span>
            </p>
            <p className="text-sm text-slate-500">
              {[employee.department, employee.designation].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                employee.status === 'confirmed'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              )}
            >
              {employee.status === 'confirmed' ? 'Confirmed' : 'Non-Confirmed'}
            </Badge>
            <Badge variant="outline" className={usagePill}>
              Used: {used}/5 this year
            </Badge>
          </div>
        </CardContent>
      </Card>

      {used >= 5 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Annual limit reached — this request will be escalated to Admin for override approval.
          </span>
        </div>
      )}
    </div>
  );
}
