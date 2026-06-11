import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpDown,
  CheckCircle2,
  Download,
  FileText,
  Hourglass,
  Printer,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { useEmployeeQuotas } from '@/hooks/useRequests';
import { downloadCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';
import { cn, formatDate, monthName, titleCase } from '@/lib/utils';
import type { RequestStatus, RequestSummary } from '@/types';

const YEARS = [2024, 2025, 2026];

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING_DOCTOR: '#f59e0b',
  PENDING_HR: '#fbbf24',
  PENDING_HR_PARTIAL: '#fcd34d',
  HR_RESTRICTED: '#f97316',
  PENDING_ADMIN: '#fb923c',
  DOCTOR_REJECTED: '#ef4444',
  ADMIN_REJECTED: '#dc2626',
  PENDING_PATHOLOGY: '#8b5cf6',
  PATH_PARTIAL: '#14b8a6',
  COMPLETED: '#10b981',
};

const TERMINAL_REJECTED = ['DOCTOR_REJECTED', 'ADMIN_REJECTED'];

type DeptSortKey = 'department' | 'total' | 'completed' | 'pending' | 'employees';

export default function ReportsPage() {
  const { user } = useAuth();
  const isAdmin = user!.role === 'admin';
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [dept, setDept] = useState('all');
  const [sortKey, setSortKey] = useState<DeptSortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['report', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_request_summary')
        .select('*')
        .gte('created_at', `${year}-01-01`)
        .lt('created_at', `${year + 1}-01-01`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RequestSummary[];
    },
  });

  const { data: quotas = [] } = useEmployeeQuotas();

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter((d): d is string => !!d))].sort(),
    [rows]
  );

  const filtered = useMemo(
    () => (dept === 'all' ? rows : rows.filter((r) => r.department === dept)),
    [rows, dept]
  );

  const completed = filtered.filter((r) => r.status === 'COMPLETED').length;
  const pending = filtered.filter(
    (r) => r.status !== 'COMPLETED' && !TERMINAL_REJECTED.includes(r.status)
  ).length;
  const uniqueEmployees = new Set(filtered.map((r) => r.employee_id)).size;

  const kpis = [
    { label: 'Total Requests', value: filtered.length, icon: FileText, accent: 'bg-blue-100 text-blue-700' },
    { label: 'Completed', value: completed, icon: CheckCircle2, accent: 'bg-emerald-100 text-emerald-700' },
    { label: 'Pending', value: pending, icon: Hourglass, accent: 'bg-amber-100 text-amber-700' },
    { label: 'Unique Employees', value: uniqueEmployees, icon: Users, accent: 'bg-violet-100 text-violet-700' },
  ];

  const monthlyData = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const inMonth = filtered.filter((r) => new Date(r.created_at).getMonth() + 1 === m);
        return {
          month: monthName(m),
          Requests: inMonth.length,
          Completed: inMonth.filter((r) => r.status === 'COMPLETED').length,
        };
      }),
    [filtered]
  );

  const statusData = useMemo(() => {
    const counts = new Map<RequestStatus, number>();
    for (const r of filtered) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return [...counts.entries()].map(([status, count]) => ({
      name: titleCase(status),
      value: count,
      color: STATUS_COLORS[status],
    }));
  }, [filtered]);

  const deptSummary = useMemo(() => {
    const map = new Map<
      string,
      { department: string; total: number; completed: number; pending: number; employees: Set<string> }
    >();
    for (const r of rows) {
      const key = r.department ?? 'Unassigned';
      const entry =
        map.get(key) ?? { department: key, total: 0, completed: 0, pending: 0, employees: new Set<string>() };
      entry.total += 1;
      if (r.status === 'COMPLETED') entry.completed += 1;
      else if (!TERMINAL_REJECTED.includes(r.status)) entry.pending += 1;
      entry.employees.add(r.employee_id);
      map.set(key, entry);
    }
    const list = [...map.values()].map((e) => ({ ...e, employees: e.employees.size }));
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (key: DeptSortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(key === 'department');
    }
  };

  const exportCsv = async () => {
    const ids = filtered.map((r) => r.id);
    let testNames = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data, error } = await supabase
        .from('request_tests')
        .select('request_id, approval, test:tests(name)')
        .in('request_id', ids)
        .in('approval', ['approved', 'completed']);
      if (error) {
        toast.error(`Export failed — ${error.message}`);
        return;
      }
      for (const rt of data as unknown as { request_id: string; test: { name: string } | null }[]) {
        const list = testNames.get(rt.request_id) ?? [];
        if (rt.test?.name) list.push(rt.test.name);
        testNames.set(rt.request_id, list);
      }
    }
    downloadCsv(
      `IIEIPATH-Report-${year}-${dept === 'all' ? 'AllDepts' : dept}-${Date.now()}.csv`,
      [
        'Req No',
        'Date',
        'Year',
        'Month',
        'Emp Code',
        'Employee Name',
        'Department',
        'Patient',
        'Relation',
        'Approved Tests',
        'Total Tests',
        'Approved Amount (BDT)',
        'Status',
      ],
      filtered.map((r) => {
        const d = new Date(r.created_at);
        return [
          r.req_no,
          formatDate(r.created_at),
          d.getFullYear(),
          d.getMonth() + 1,
          r.employee_code,
          r.employee_name,
          r.department,
          r.ben_name,
          r.ben_relation,
          (testNames.get(r.id) ?? []).join('; '),
          r.total_tests,
          Number(r.approved_amount),
          r.status,
        ];
      })
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Year-to-date insights — ${year}`}
        actions={
          <>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {kpi.label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-12" />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">{kpi.value}</p>
                )}
              </div>
              <div className={cn('rounded-lg p-2.5', kpi.accent)}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Requests — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="Requests" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : statusData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                No data for this selection
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Department Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {(
                  [
                    ['department', 'Department'],
                    ['total', 'Total Requests'],
                    ['completed', 'Completed'],
                    ['pending', 'Pending'],
                    ['employees', 'Unique Employees'],
                  ] as [DeptSortKey, string][]
                ).map(([key, label]) => (
                  <TableHead key={key}>
                    <button
                      className="flex items-center gap-1 hover:text-slate-900"
                      onClick={() => toggleSort(key)}
                    >
                      {label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptSummary.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    No requests for {year}
                  </TableCell>
                </TableRow>
              )}
              {deptSummary.map((d) => (
                <TableRow key={d.department}>
                  <TableCell className="text-sm font-semibold">{d.department}</TableCell>
                  <TableCell className="text-sm">{d.total}</TableCell>
                  <TableCell className="text-sm text-emerald-600">{d.completed}</TableCell>
                  <TableCell className="text-sm text-amber-600">{d.pending}</TableCell>
                  <TableCell className="text-sm">{d.employees}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Employee quota table (admin only, current year) */}
      {isAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Employee Benefit Quota — {currentYear}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Emp Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead className="w-48">Quota</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotas.map((q) => {
                  const barColor = q.exceeded
                    ? 'bg-red-500'
                    : q.remaining <= 2
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-sm font-bold">{q.emp_code}</TableCell>
                      <TableCell className="text-sm font-medium">{q.name}</TableCell>
                      <TableCell className="hidden text-sm text-slate-500 md:table-cell">
                        {q.department ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{q.used}</TableCell>
                      <TableCell className="text-sm">{q.remaining}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(q.used / 5) * 100}
                            className="flex-1"
                            indicatorClassName={barColor}
                          />
                          <span className="text-xs font-semibold text-slate-600">{q.used}/5</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
