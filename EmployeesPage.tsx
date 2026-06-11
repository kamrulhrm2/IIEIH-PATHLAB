import { useMemo, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDeleteEmployee, useEmployees, useSaveEmployee } from '@/hooks/useEmployees';
import { downloadCsv } from '@/lib/csv';
import { cn, formatDate } from '@/lib/utils';
import type { EmpStatus, Employee } from '@/types';

const PAGE_SIZE = 15;

interface FormState {
  id?: string;
  emp_code: string;
  name: string;
  designation: string;
  department: string;
  status: EmpStatus;
  join_date: string;
  contact: string;
}

const EMPTY_FORM: FormState = {
  emp_code: '',
  name: '',
  designation: '',
  department: '',
  status: 'non-confirmed',
  join_date: '',
  contact: '',
};

export default function EmployeesPage() {
  const { data: employees = [], isLoading } = useEmployees();
  const save = useSaveEmployee();
  const remove = useDeleteEmployee();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const confirmed = employees.filter((e) => e.status === 'confirmed').length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return employees.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.emp_code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.department ?? '').toLowerCase().includes(q)
      );
    });
  }, [employees, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (e: Employee) => {
    setForm({
      id: e.id,
      emp_code: e.emp_code,
      name: e.name,
      designation: e.designation ?? '',
      department: e.department ?? '',
      status: e.status,
      join_date: e.join_date ?? '',
      contact: e.contact ?? '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const code = form.emp_code.trim().toUpperCase();
    if (!code || !/^[A-Za-z0-9]{1,20}$/.test(code)) {
      setFormError('Employee code is required (alphanumeric, max 20 chars).');
      return;
    }
    if (form.name.trim().length < 2) {
      setFormError('Name is required (min 2 characters).');
      return;
    }
    const duplicate = employees.find((x) => x.emp_code === code && x.id !== form.id);
    if (duplicate) {
      setFormError(`Employee code ${code} already exists.`);
      return;
    }
    save.mutate(
      {
        id: form.id,
        emp_code: code,
        name: form.name.trim(),
        designation: form.designation.trim() || null,
        department: form.department.trim() || null,
        status: form.status,
        join_date: form.join_date || null,
        contact: form.contact.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Employee saved successfully');
          setDialogOpen(false);
        },
      }
    );
  };

  const toggleStatus = (emp: Employee) => {
    save.mutate(
      {
        id: emp.id,
        status: emp.status === 'confirmed' ? 'non-confirmed' : 'confirmed',
      },
      { onSuccess: () => toast.success(`${emp.name} status updated`) }
    );
  };

  const exportCsv = () => {
    downloadCsv(
      `employees-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Employee Code', 'Name', 'Designation', 'Department', 'Status', 'Join Date', 'Contact'],
      filtered.map((e) => [
        e.emp_code,
        e.name,
        e.designation,
        e.department,
        e.status,
        e.join_date ? formatDate(e.join_date) : '',
        e.contact,
      ])
    );
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total · ${confirmed} confirmed`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search code, name, department..."
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="non-confirmed">Non-Confirmed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Designation</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Join Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && pageRows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  <EmptyState icon={UserCheck} title="No employees found" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              pageRows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm font-bold">{e.emp_code}</TableCell>
                  <TableCell className="text-sm font-medium">{e.name}</TableCell>
                  <TableCell className="hidden text-sm text-slate-500 md:table-cell">
                    {e.designation ?? '—'}
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-500 md:table-cell">
                    {e.department ?? '—'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleStatus(e)}
                      title="Click to toggle status"
                      aria-label={`Toggle status for ${e.name}`}
                    >
                      <Badge
                        variant="outline"
                        className={cn(
                          'cursor-pointer',
                          e.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        )}
                      >
                        {e.status === 'confirmed' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {e.status === 'confirmed' ? 'Confirmed' : 'Non-Confirmed'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-500 lg:table-cell">
                    {e.join_date ? formatDate(e.join_date) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(e)}
                      aria-label={`Edit ${e.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleting(e)}
                      aria-label={`Delete ${e.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {!isLoading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-sm text-slate-500">
              Page {currentPage} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="emp_code">Employee Code *</Label>
                <Input
                  id="emp_code"
                  value={form.emp_code}
                  onChange={(e) => setForm((f) => ({ ...f, emp_code: e.target.value }))}
                  placeholder="E007"
                  className="font-mono"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as EmpStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="non-confirmed">Non-Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="join_date">Join Date</Label>
                <Input
                  id="join_date"
                  type="date"
                  value={form.join_date}
                  onChange={(e) => setForm((f) => ({ ...f, join_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="contact">Contact</Label>
                <Input
                  id="contact"
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="017XXXXXXXX"
                />
              </div>
            </div>
            {formError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ''}?`}
        description="This will also remove their login account and dependents."
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Employee deleted');
              setDeleting(null);
            },
          })
        }
      />
    </div>
  );
}
