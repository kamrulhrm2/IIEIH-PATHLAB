import { useState, type FormEvent } from 'react';
import { Info, KeyRound, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
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
import { RoleBadge } from '@/components/shared/RoleBadge';
import { SearchableSelect } from '@/components/shared/SearchableSelect';
import { useAuth } from '@/context/AuthContext';
import { useEmployees } from '@/hooks/useEmployees';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '@/hooks/useUsers';
import type { AppUser, UserRole } from '@/types';

const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Full access to all data and queues' },
  { value: 'hr', label: 'HR', hint: 'HR queue, employees, reports' },
  { value: 'doctor', label: 'Doctor', hint: 'Doctor queue, own requests' },
  { value: 'pathologist', label: 'Pathologist', hint: 'Pathology queue, test library, slips' },
  { value: 'user', label: 'Employee', hint: 'Submit and track own requests' },
];

export default function UsersPage() {
  const { user: me } = useAuth();
  const { data: users = [], isLoading } = useUsers();
  const { data: employees = [] } = useEmployees();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [empCode, setEmpCode] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [deactivating, setDeactivating] = useState<AppUser | null>(null);

  const selectedEmployee = employees.find((e) => e.emp_code === empCode) ?? null;

  const openCreate = () => {
    setEditing(null);
    setEmpCode(null);
    setRole('user');
    setEmail('');
    setFormError('');
    setDialogOpen(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setEmpCode(u.emp_code);
    setRole(u.role);
    setEmail(u.email ?? '');
    setFormError('');
    setDialogOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateUser.mutate(
        { id: editing.id, role, email: email.trim() || null },
        {
          onSuccess: () => {
            toast.success('User updated successfully');
            setDialogOpen(false);
          },
        }
      );
      return;
    }
    if (!selectedEmployee) {
      setFormError('Select an employee first.');
      return;
    }
    if (users.some((u) => u.username === selectedEmployee.emp_code)) {
      setFormError(`A user account for ${selectedEmployee.emp_code} already exists.`);
      return;
    }
    createUser.mutate(
      {
        username: selectedEmployee.emp_code,
        name: selectedEmployee.name,
        role,
        email: email.trim() || null,
        emp_code: selectedEmployee.emp_code,
      },
      {
        onSuccess: () => {
          toast.success(`User ${selectedEmployee.emp_code} created successfully`);
          setDialogOpen(false);
        },
      }
    );
  };

  const toggleActive = (u: AppUser, active: boolean) => {
    if (u.id === me!.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }
    updateUser.mutate(
      { id: u.id, is_active: active },
      { onSuccess: () => toast.success(`${u.username} ${active ? 'activated' : 'deactivated'}`) }
    );
  };

  const resetPassword = () => {
    if (!editing || !editing.emp_code) return;
    updateUser.mutate(
      { id: editing.id, resetPasswordTo: editing.emp_code },
      { onSuccess: () => toast.success(`Password reset to default (${editing.emp_code})`) }
    );
  };

  return (
    <div>
      <PageHeader
        title="System Users"
        subtitle="Manage login accounts and role assignments"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">Access Control Policy</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>Username = Employee ID (e.g. E001)</li>
            <li>Default password = Employee ID — employee changes after first login</li>
            <li>Role determines which pages and actions are accessible</li>
            <li>Employees see only their own requests; Admin sees all data</li>
          </ul>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Employee Link</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && users.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7}>
                  <EmptyState icon={Lock} title="No user accounts" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-sm font-bold">{u.username}</TableCell>
                  <TableCell className="text-sm font-medium">{u.name}</TableCell>
                  <TableCell>
                    <RoleBadge role={u.role} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-slate-500 md:table-cell">
                    {u.email ?? '—'}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-slate-500 md:table-cell">
                    {u.emp_code ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.is_active}
                      onCheckedChange={(v) => toggleActive(u, v)}
                      aria-label={`Toggle active for ${u.username}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(u)}
                      aria-label={`Edit ${u.username}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (u.id === me!.id) {
                          toast.error('You cannot delete your own account');
                          return;
                        }
                        setDeactivating(u);
                      }}
                      aria-label={`Deactivate ${u.username}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User Account' : 'Create User Account'}</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <ul className="list-inside list-disc space-y-0.5">
              <li>Select an employee → username auto-sets to their Employee ID</li>
              <li>Default password = Employee ID (employee changes after first login)</li>
              <li>Role controls all data access and permitted workflow actions</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Select Employee *</Label>
                <SearchableSelect
                  options={employees.map((e) => ({
                    value: e.emp_code,
                    label: `${e.emp_code} — ${e.name}`,
                    sub: [e.department, e.designation].filter(Boolean).join(' · '),
                  }))}
                  value={empCode}
                  onChange={setEmpCode}
                  placeholder="Search employee..."
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  readOnly
                  value={editing ? editing.username : (empCode ?? '')}
                  className="bg-slate-50 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{editing ? 'Password' : 'Default Password'}</Label>
                {editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={resetPassword}
                    disabled={updateUser.isPending || !editing.emp_code}
                  >
                    <KeyRound className="h-4 w-4" /> Reset to default
                  </Button>
                ) : (
                  <Input readOnly value={empCode ?? ''} className="bg-slate-50 font-mono" />
                )}
              </div>
            </div>

            {!editing && selectedEmployee && (
              <Card className="bg-slate-50">
                <CardContent className="p-3 text-sm">
                  <span className="font-semibold">{selectedEmployee.name}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {[selectedEmployee.department, selectedEmployee.designation]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    · {selectedEmployee.status}
                  </span>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1.5">
              <Label>System Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {ROLES.find((r) => r.value === role)?.hint}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-email">Email (optional)</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="work@iiei.com"
              />
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
              <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
                {editing ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={`Deactivate ${deactivating?.name ?? ''}?`}
        description="They will no longer be able to log in. The account is kept for audit history."
        confirmLabel="Deactivate"
        loading={updateUser.isPending}
        onConfirm={() =>
          deactivating &&
          updateUser.mutate(
            { id: deactivating.id, is_active: false },
            {
              onSuccess: () => {
                toast.success('User deactivated');
                setDeactivating(null);
              },
            }
          )
        }
      />
    </div>
  );
}
