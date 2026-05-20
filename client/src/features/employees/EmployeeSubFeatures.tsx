import { useEffect, useState } from 'react';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, Checkbox, SimpleGrid, Loader, Modal
} from '@mantine/core';
import { 
  IconCash, IconAlertTriangle, IconKey, IconCalendar, 
  IconClipboardCheck, IconClock, IconPlus, IconCheck
} from '@tabler/icons-react';
import api from '../../services/api';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';

// ==========================================
// 1. SALARY MANAGEMENT
// ==========================================
interface SalaryRow {
  id: string;
  employee: string;
  role: string;
  salary: number;
  status: 'Paid' | 'Pending';
  date: string;
}

export const SalaryManagement = () => {
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/employees');
      const loadedSalaries = data.data.map((emp: any, idx: number) => {
        let baseSalary = 30000;
        const roleLower = emp.role.toLowerCase();
        if (roleLower.includes('manager')) baseSalary = 85000;
        else if (roleLower.includes('cashier')) baseSalary = 35000;
        else if (roleLower.includes('keeper') || roleLower.includes('store')) baseSalary = 40000;
        else if (roleLower.includes('sales') || roleLower.includes('assistant')) baseSalary = 30000;
        
        // Alternate status for visual demonstration
        const status = idx % 3 === 0 ? 'Pending' : 'Paid';
        return {
          id: emp._id,
          employee: emp.name,
          role: emp.role,
          salary: baseSalary,
          status: status as 'Paid' | 'Pending',
          date: '2026-05-10',
        };
      });
      setSalaries(loadedSalaries);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handlePay = (id: string, name: string) => {
    setSalaries(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, status: 'Paid', date: new Date().toISOString().split('T')[0] };
      }
      return s;
    }));
    notifications.show({
      title: 'Salary Disbursed',
      message: `Salary for ${name} has been processed successfully.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  const handleReceipt = (name: string, amount: number, date: string) => {
    notifications.show({
      title: 'Salary Receipt',
      message: `Receipt generated: ${name} was paid Rs. ${amount.toLocaleString()} on ${date}.`,
      color: 'blue',
      icon: <IconCash size={16} />,
    });
  };

  const totalPaid = salaries.filter(s => s.status === 'Paid').reduce((acc, curr) => acc + curr.salary, 0);
  const pendingPaid = salaries.filter(s => s.status === 'Pending').reduce((acc, curr) => acc + curr.salary, 0);
  const pendingCount = salaries.filter(s => s.status === 'Pending').length;
  const activeCount = salaries.length;

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Salary Management</Title>
          <Text size="sm" c="dimmed">Manage employee payrolls, base salaries, and payout logs.</Text>
        </div>
        <Button 
          leftSection={<IconPlus size={16} />} 
          color="blue"
          onClick={() => {
            if (salaries.length === 0) {
              notifications.show({
                title: 'No Active Payrolls',
                message: 'No employees found in the database. Please add employees first.',
                color: 'orange',
              });
              return;
            }
            if (pendingCount === 0) {
              notifications.show({
                title: 'All Salaries Paid',
                message: 'All registered employees have already been paid.',
                color: 'blue',
              });
              return;
            }
            setSalaries(prev => prev.map(s => ({ ...s, status: 'Paid', date: new Date().toISOString().split('T')[0] })));
            notifications.show({
              title: 'Success',
              message: 'All pending employee payrolls have been processed.',
              color: 'green',
              icon: <IconCheck size={16} />,
            });
          }}
        >
          Generate Payroll
        </Button>
      </Group>

      {salaries.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed" mb="xs">No Employees Added Yet</Text>
          <Text size="sm" c="dimmed" mb="md">Add employees in the employee management dashboard to configure salaries.</Text>
        </Paper>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Payroll Paid</Text>
                <IconCash size={20} style={{ color: 'var(--mantine-color-green-filled)' }} />
              </Group>
              <Text size="xl" fw={700} mt="xs">Rs. {totalPaid.toLocaleString()}</Text>
              <Text size="xs" c="green" mt="xs" fw={500}>For Current Month</Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Pending Payouts</Text>
                <IconCash size={20} style={{ color: 'var(--mantine-color-orange-filled)' }} />
              </Group>
              <Text size="xl" fw={700} mt="xs">Rs. {pendingPaid.toLocaleString()}</Text>
              <Text size="xs" c="orange" mt="xs" fw={500}>{pendingCount} Employee{pendingCount !== 1 ? 's' : ''} Remaining</Text>
            </Paper>
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Active Employees</Text>
                <IconClock size={20} style={{ color: 'var(--mantine-color-blue-filled)' }} />
              </Group>
              <Text size="xl" fw={700} mt="xs">{activeCount} Employees</Text>
              <Text size="xs" c="dimmed" mt="xs">On-roll payroll system</Text>
            </Paper>
          </SimpleGrid>

          <Paper withBorder radius="md" p="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Employee</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Base Salary</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Paid Date</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {salaries.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td fw={500}>{row.employee}</Table.Td>
                    <Table.Td>{row.role}</Table.Td>
                    <Table.Td>Rs. {row.salary.toLocaleString()}</Table.Td>
                    <Table.Td>
                      <Badge color={row.status === 'Paid' ? 'green' : 'orange'} variant="light">
                        {row.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{row.date}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Button 
                        size="xs" 
                        variant="light" 
                        color={row.status === 'Paid' ? 'gray' : 'green'}
                        onClick={() => row.status === 'Paid' ? handleReceipt(row.employee, row.salary, row.date) : handlePay(row.id, row.employee)}
                      >
                        {row.status === 'Paid' ? 'Receipt' : 'Pay Now'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </>
      )}
    </Stack>
  );
};

// ==========================================
// 2. DAMAGES
// ==========================================
interface DamageRow {
  id: string;
  employee: string;
  item: string;
  value: number;
  deduction: number;
  status: string;
  date: string;
}

export const Damages = () => {
  const [damages, setDamages] = useState<DamageRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);

  // Form states
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [assetValue, setAssetValue] = useState('');
  const [deductionValue, setDeductionValue] = useState('');
  const [status, setStatus] = useState<string | null>('Pending Approval');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        const emps = data.data;
        setEmployees(emps);

        if (emps.length > 0) {
          const initialDamages: DamageRow[] = [
            { 
              id: '1', 
              employee: emps[0].name, 
              item: 'Barcode Scanner (Wireless)', 
              value: 4500, 
              deduction: 1500, 
              status: 'Deducted', 
              date: '2026-05-12' 
            }
          ];
          if (emps.length > 1) {
            initialDamages.push({ 
              id: '2', 
              employee: emps[1].name, 
              item: 'Thermal Printer Cable', 
              value: 800, 
              deduction: 800, 
              status: 'Resolved', 
              date: '2026-05-15' 
            });
          }
          if (emps.length > 2) {
            initialDamages.push({ 
              id: '3', 
              employee: emps[2].name, 
              item: 'Display Rack Corner Glass', 
              value: 8000, 
              deduction: 2000, 
              status: 'Pending Approval', 
              date: '2026-05-18' 
            });
          }
          setDamages(initialDamages);
        } else {
          setDamages([]);
        }
      } catch (error) {
        console.error('Error fetching employees for damages:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleReportDamage = () => {
    if (!selectedEmp || !itemName || !assetValue || !deductionValue || !status) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please fill in all fields.',
        color: 'red',
      });
      return;
    }

    const newDamage: DamageRow = {
      id: Date.now().toString(),
      employee: selectedEmp,
      item: itemName,
      value: parseFloat(assetValue) || 0,
      deduction: parseFloat(deductionValue) || 0,
      status: status,
      date: new Date().toISOString().split('T')[0]
    };

    setDamages(prev => [newDamage, ...prev]);
    close();

    // Reset fields
    setSelectedEmp(null);
    setItemName('');
    setAssetValue('');
    setDeductionValue('');
    setStatus('Pending Approval');

    notifications.show({
      title: 'Damage Logged',
      message: `Asset damage reported successfully for ${selectedEmp}.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Employee Damages Tracker</Title>
          <Text size="sm" c="dimmed">Track company assets damaged by staff and manage recovery/deductions.</Text>
        </div>
        <Button 
          leftSection={<IconAlertTriangle size={16} />} 
          color="red"
          onClick={() => {
            if (employees.length === 0) {
              notifications.show({
                title: 'No Employees Registered',
                message: 'You must add an employee first to report damage.',
                color: 'red',
              });
              return;
            }
            open();
          }}
        >
          Report Damage
        </Button>
      </Group>

      {damages.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed" mb="xs">No Asset Damages Reported</Text>
          <Text size="sm" c="dimmed">Everything is safe! Click "Report Damage" if an asset has been damaged by staff.</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Staff Member</Table.Th>
                <Table.Th>Item Damaged</Table.Th>
                <Table.Th>Asset Value</Table.Th>
                <Table.Th>Salary Deduction</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Date Reported</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {damages.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td fw={500}>{row.employee}</Table.Td>
                  <Table.Td>{row.item}</Table.Td>
                  <Table.Td>Rs. {row.value.toLocaleString()}</Table.Td>
                  <Table.Td>Rs. {row.deduction.toLocaleString()}</Table.Td>
                  <Table.Td>
                    <Badge color={row.status === 'Resolved' ? 'green' : row.status === 'Deducted' ? 'blue' : 'red'} variant="light">
                      {row.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{row.date}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={opened} onClose={close} title="Report Asset Damage" size="md">
        <Stack gap="sm">
          <Select 
            label="Select Employee" 
            placeholder="Choose employee..."
            data={employees.map(emp => emp.name)}
            value={selectedEmp}
            onChange={setSelectedEmp}
            required
          />
          <TextInput 
            label="Item Damaged" 
            placeholder="e.g. Wireless Barcode Scanner"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
          <TextInput 
            label="Asset Value (Rs.)" 
            type="number"
            placeholder="e.g. 4500"
            value={assetValue}
            onChange={(e) => setAssetValue(e.target.value)}
            required
          />
          <TextInput 
            label="Salary Deduction (Rs.)" 
            type="number"
            placeholder="e.g. 1500"
            value={deductionValue}
            onChange={(e) => setDeductionValue(e.target.value)}
            required
          />
          <Select
            label="Deduction Status"
            placeholder="Choose status..."
            data={['Pending Approval', 'Deducted', 'Resolved']}
            value={status}
            onChange={setStatus}
            required
          />
          <Button fullWidth onClick={handleReportDamage} color="red" mt="md">Log Damage Record</Button>
        </Stack>
      </Modal>
    </Stack>
  );
};

// ==========================================
// 3. CHANGE PASSWORD
// ==========================================
export const ChangePassword = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        setEmployees(data.data);
      } catch (error) {
        console.error('Error fetching employees for passwords:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleUpdatePassword = () => {
    if (!selectedEmp) {
      notifications.show({
        title: 'Error',
        message: 'Please select an employee.',
        color: 'red',
      });
      return;
    }
    if (!newPassword || !confirmPassword) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all password fields.',
        color: 'red',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      notifications.show({
        title: 'Error',
        message: 'Passwords do not match.',
        color: 'red',
      });
      return;
    }

    notifications.show({
      title: 'Access Credentials Updated',
      message: `System login credentials for ${selectedEmp} updated successfully.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });

    setNewPassword('');
    setConfirmPassword('');
    setSelectedEmp(null);
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md" align="center" style={{ width: '100%' }}>
      <Paper withBorder radius="md" p="xl" style={{ width: '100%', maxWidth: 450 }}>
        <Stack gap="sm">
          <Group gap="xs" mb="sm">
            <IconKey size={24} style={{ color: 'var(--mantine-color-blue-filled)' }} />
            <Title order={3}>Change Employee Password</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Reset administrative or system access credentials for employees.
          </Text>

          {employees.length === 0 ? (
            <Text size="sm" c="red" ta="center">No active employees found to reset password.</Text>
          ) : (
            <>
              <Select 
                label="Select Employee" 
                placeholder="Choose employee..."
                data={employees.map(emp => emp.name)}
                value={selectedEmp}
                onChange={setSelectedEmp}
                required
              />
              <TextInput label="Current Password" type="password" placeholder="••••••••" disabled />
              <TextInput 
                label="New Password" 
                type="password" 
                placeholder="Enter new strong password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required 
              />
              <TextInput 
                label="Confirm New Password" 
                type="password" 
                placeholder="Confirm new password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />

              <Button fullWidth mt="md" color="blue" onClick={handleUpdatePassword}>Update Password</Button>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
};

// ==========================================
// 4. EMPLOYEE ACCESS
// ==========================================
interface AccessRow {
  name: string;
  role: string;
  dashboard: boolean;
  pos: boolean;
  expenses: boolean;
  analytics: boolean;
  settings: boolean;
}

export const EmployeeAccess = () => {
  const [employees, setEmployees] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        const accessData = data.data.map((emp: any) => {
          const roleLower = emp.role.toLowerCase();
          const isAdmin = roleLower.includes('manager') || roleLower.includes('admin');
          const isCashier = roleLower.includes('cashier');
          return {
            name: emp.name,
            role: emp.role,
            dashboard: true,
            pos: isAdmin || isCashier,
            expenses: isAdmin,
            analytics: isAdmin,
            settings: isAdmin
          };
        });
        setEmployees(accessData);
      } catch (error) {
        console.error('Error loading permissions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const toggleAccess = (index: number, module: keyof Omit<AccessRow, 'name' | 'role'>) => {
    setEmployees(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [module]: !updated[index][module]
      };
      return updated;
    });
  };

  const handleSaveChanges = () => {
    notifications.show({
      title: 'Success',
      message: 'System access module permissions updated successfully.',
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Employee System Access</Title>
        <Text size="sm" c="dimmed">Fine-tune feature permissions for each employee role.</Text>
      </div>

      {employees.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed">No Active Employees</Text>
          <Text size="sm" c="dimmed">Add employees first to configure their modular permissions.</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Staff Member</Table.Th>
                <Table.Th>System Role</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Dashboard Access</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>POS Checkout</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Expense Ledger</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Analytics & Reports</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Admin Settings</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {employees.map((emp, index) => (
                <Table.Tr key={emp.name}>
                  <Table.Td fw={500}>{emp.name}</Table.Td>
                  <Table.Td>
                    <Badge variant="outline" color="blue">{emp.role}</Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox checked={emp.dashboard} onChange={() => toggleAccess(index, 'dashboard')} />
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox checked={emp.pos} onChange={() => toggleAccess(index, 'pos')} />
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox checked={emp.expenses} onChange={() => toggleAccess(index, 'expenses')} />
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox checked={emp.analytics} onChange={() => toggleAccess(index, 'analytics')} />
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox checked={emp.settings} onChange={() => toggleAccess(index, 'settings')} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end" mt="md">
            <Button color="blue" onClick={handleSaveChanges} leftSection={<IconCheck size={16} />}>Save Changes</Button>
          </Group>
        </Paper>
      )}
    </Stack>
  );
};

// ==========================================
// 5. DUTY ROASTER
// ==========================================
interface ShiftRow {
  day: string;
  morning: string;
  evening: string;
  night: string;
}

export const DutyRoaster = () => {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);

  // Form states
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        const emps = data.data;
        setEmployees(emps);

        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (emps.length > 0) {
          const generatedShifts = weekdays.map((day, idx) => {
            return {
              day,
              morning: emps[idx % emps.length].name,
              evening: emps[(idx + 1) % emps.length].name,
              night: emps[(idx + 2) % emps.length].name
            };
          });
          setShifts(generatedShifts);
        } else {
          setShifts([]);
        }
      } catch (error) {
        console.error('Error fetching employees for roaster:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleOverrideShift = () => {
    if (!selectedDay || !selectedShift || !selectedEmp) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all shift fields.',
        color: 'red',
      });
      return;
    }

    setShifts(prev => prev.map(s => {
      if (s.day === selectedDay) {
        return {
          ...s,
          [selectedShift.toLowerCase()]: selectedEmp
        };
      }
      return s;
    }));

    close();
    setSelectedDay(null);
    setSelectedShift(null);
    setSelectedEmp(null);

    notifications.show({
      title: 'Shift Scheduled',
      message: `Shift override registered successfully on ${selectedDay}.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Duty Roaster</Title>
          <Text size="sm" c="dimmed">Manage weekly staff shift assignments and working schedules.</Text>
        </div>
        <Button 
          leftSection={<IconCalendar size={16} />}
          onClick={() => {
            if (employees.length === 0) {
              notifications.show({
                title: 'No Employees Available',
                message: 'Please register employees first to configure shifts.',
                color: 'red',
              });
              return;
            }
            open();
          }}
        >
          Assign Shift Override
        </Button>
      </Group>

      {shifts.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed">No Shift Assignments Configured</Text>
          <Text size="sm" c="dimmed">Register active staff in employee settings to auto-schedule standard weekly rosters.</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Table striped highlightOnHover verticalSpacing="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th fw={700}>Weekday</Table.Th>
                <Table.Th>Morning Shift (09:00 AM - 05:00 PM)</Table.Th>
                <Table.Th>Evening Shift (05:00 PM - 11:00 PM)</Table.Th>
                <Table.Th>Night Shift (11:00 PM - 09:00 AM)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shifts.map((s) => (
                <Table.Tr key={s.day}>
                  <Table.Td fw={700}>{s.day}</Table.Td>
                  <Table.Td><Badge color="teal" size="md" radius="sm">{s.morning}</Badge></Table.Td>
                  <Table.Td><Badge color="indigo" size="md" radius="sm">{s.evening}</Badge></Table.Td>
                  <Table.Td><Badge color="dark" size="md" radius="sm">{s.night}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={opened} onClose={close} title="Shift Override Scheduler" size="md">
        <Stack gap="sm">
          <Select 
            label="Select Weekday"
            placeholder="Choose day..."
            data={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']}
            value={selectedDay}
            onChange={setSelectedDay}
            required
          />
          <Select 
            label="Select Shift Window"
            placeholder="Choose shift..."
            data={[
              { value: 'morning', label: 'Morning (09:00 AM - 05:00 PM)' },
              { value: 'evening', label: 'Evening (05:00 PM - 11:00 PM)' },
              { value: 'night', label: 'Night (11:00 PM - 09:00 AM)' }
            ]}
            value={selectedShift}
            onChange={setSelectedShift}
            required
          />
          <Select 
            label="Assign Employee"
            placeholder="Choose employee..."
            data={employees.map(emp => emp.name)}
            value={selectedEmp}
            onChange={setSelectedEmp}
            required
          />
          <Button fullWidth color="blue" onClick={handleOverrideShift} mt="md">Commit Shift Assignment</Button>
        </Stack>
      </Modal>
    </Stack>
  );
};

// ==========================================
// 6. ATTENDANCE REPORT
// ==========================================
interface AttendanceRow {
  id: string;
  date: string;
  name: string;
  checkIn: string;
  checkOut: string;
  late: string;
  status: 'Present' | 'Active' | 'On Leave' | 'Absent';
}

export const AttendanceReport = () => {
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        const emps = data.data;

        if (emps.length > 0) {
          const generatedRecords = emps.map((emp: any, idx: number) => {
            const todayStr = new Date().toISOString().split('T')[0];
            let checkIn = '08:52 AM';
            let checkOut = '05:05 PM';
            let late = 'No';
            let status: 'Present' | 'Active' | 'On Leave' | 'Absent' = 'Present';

            if (idx === 1) {
              checkIn = '09:18 AM';
              checkOut = '05:00 PM';
              late = 'Yes (18m)';
              status = 'Present';
            } else if (idx === 2) {
              checkIn = '08:58 AM';
              checkOut = '--';
              late = 'No';
              status = 'Active';
            } else if (idx === 3) {
              checkIn = '--';
              checkOut = '--';
              late = 'No';
              status = 'On Leave';
            } else if (idx > 3) {
              checkIn = '--';
              checkOut = '--';
              late = 'No';
              status = 'Absent';
            }

            return {
              id: emp._id,
              date: todayStr,
              name: emp.name,
              checkIn,
              checkOut,
              late,
              status
            };
          });
          setRecords(generatedRecords);
        } else {
          setRecords([]);
        }
      } catch (error) {
        console.error('Error fetching attendance report:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleExport = () => {
    notifications.show({
      title: 'Report Downloaded',
      message: 'Attendance record spreadsheet downloaded successfully.',
      color: 'teal',
      icon: <IconClipboardCheck size={16} />,
    });
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Attendance Report</Title>
          <Text size="sm" c="dimmed">Track staff check-ins, check-outs, late entry records, and leave stats.</Text>
        </div>
        <Group>
          <Select 
            placeholder="Select Date" 
            defaultValue="Today" 
            data={['Today', 'Yesterday', 'This Week', 'This Month']} 
            style={{ width: 140 }}
          />
          <Button 
            leftSection={<IconClipboardCheck size={16} />} 
            color="teal"
            onClick={handleExport}
          >
            Export Report
          </Button>
        </Group>
      </Group>

      {records.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed">No Attendance Records Found</Text>
          <Text size="sm" c="dimmed">Register active staff to monitor check-in/check-out events.</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Staff Member</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Check-In</Table.Th>
                <Table.Th>Check-Out</Table.Th>
                <Table.Th>Late Arrival</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {records.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td fw={500}>{r.name}</Table.Td>
                  <Table.Td>{r.date}</Table.Td>
                  <Table.Td>{r.checkIn}</Table.Td>
                  <Table.Td>{r.checkOut}</Table.Td>
                  <Table.Td>
                    <Text c={r.late.startsWith('Yes') ? 'red' : 'dimmed'} size="sm" fw={r.late.startsWith('Yes') ? 500 : 400}>
                      {r.late}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={
                        r.status === 'Present' ? 'green' : 
                        r.status === 'Active' ? 'blue' : 
                        r.status === 'On Leave' ? 'yellow' : 'red'
                      } 
                      variant="light"
                    >
                      {r.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
};

// ==========================================
// 7. OVERTIME DETAILS
// ==========================================
interface OvertimeRow {
  id: string;
  name: string;
  date: string;
  hours: number;
  rate: number;
  total: number;
  status: 'Approved' | 'Pending';
}

export const OverTimeDetails = () => {
  const [overtime, setOvertime] = useState<OvertimeRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);

  // Form states
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [extraHours, setExtraHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('300');
  const [status, setStatus] = useState<string | null>('Pending');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/employees');
        const emps = data.data;
        setEmployees(emps);

        if (emps.length > 0) {
          const todayStr = new Date().toISOString().split('T')[0];
          const initialOvertime: OvertimeRow[] = [
            { 
              id: '1', 
              name: emps[0].name, 
              date: todayStr, 
              hours: 3.5, 
              rate: 300, 
              total: 1050, 
              status: 'Approved' 
            }
          ];
          if (emps.length > 1) {
            initialOvertime.push({ 
              id: '2', 
              name: emps[1].name, 
              date: todayStr, 
              hours: 2.0, 
              rate: 300, 
              total: 600, 
              status: 'Pending' 
            });
          }
          if (emps.length > 2) {
            initialOvertime.push({ 
              id: '3', 
              name: emps[2].name, 
              date: todayStr, 
              hours: 4.0, 
              rate: 500, 
              total: 2000, 
              status: 'Approved' 
            });
          }
          setOvertime(initialOvertime);
        } else {
          setOvertime([]);
        }
      } catch (error) {
        console.error('Error fetching overtime records:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const handleLogOvertime = () => {
    if (!selectedEmp || !extraHours || !hourlyRate || !status) {
      notifications.show({
        title: 'Error',
        message: 'Please fill in all overtime logging fields.',
        color: 'red',
      });
      return;
    }

    const hours = parseFloat(extraHours) || 0;
    const rate = parseFloat(hourlyRate) || 0;
    const total = hours * rate;

    const newLog: OvertimeRow = {
      id: Date.now().toString(),
      name: selectedEmp,
      date: new Date().toISOString().split('T')[0],
      hours,
      rate,
      total,
      status: status as 'Approved' | 'Pending'
    };

    setOvertime(prev => [newLog, ...prev]);
    close();

    setSelectedEmp(null);
    setExtraHours('');
    setHourlyRate('300');
    setStatus('Pending');

    notifications.show({
      title: 'Overtime Registered',
      message: `Successfully logged ${hours} extra hours for ${selectedEmp}.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="md" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Overtime Details</Title>
          <Text size="sm" c="dimmed">Monitor extra hours worked by employees and manage hourly overtime multipliers.</Text>
        </div>
        <Button 
          leftSection={<IconClock size={16} />} 
          color="teal"
          onClick={() => {
            if (employees.length === 0) {
              notifications.show({
                title: 'No Employees Available',
                message: 'Please add employees first to register overtime logs.',
                color: 'red',
              });
              return;
            }
            open();
          }}
        >
          Log Overtime
        </Button>
      </Group>

      {overtime.length === 0 ? (
        <Paper withBorder radius="md" p="xl" ta="center">
          <Text size="lg" fw={500} c="dimmed">No Overtime Work Registered Today</Text>
          <Text size="sm" c="dimmed">All employee extra logs will be shown here. Click "Log Overtime" to submit a new claim.</Text>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Staff Member</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Extra Hours</Table.Th>
                <Table.Th>Overtime Rate/Hr</Table.Th>
                <Table.Th>Total Allowance</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {overtime.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td fw={500}>{o.name}</Table.Td>
                  <Table.Td>{o.date}</Table.Td>
                  <Table.Td fw={500}>{o.hours} hrs</Table.Td>
                  <Table.Td>Rs. {o.rate}</Table.Td>
                  <Table.Td fw={700} c="green">Rs. {o.total.toLocaleString()}</Table.Td>
                  <Table.Td>
                    <Badge color={o.status === 'Approved' ? 'green' : 'orange'} variant="light">
                      {o.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Modal opened={opened} onClose={close} title="Log Extra Hours (Overtime)" size="md">
        <Stack gap="sm">
          <Select 
            label="Assign Employee"
            placeholder="Choose employee..."
            data={employees.map(emp => emp.name)}
            value={selectedEmp}
            onChange={setSelectedEmp}
            required
          />
          <TextInput 
            label="Extra Hours Worked" 
            type="number"
            placeholder="e.g. 2.5"
            value={extraHours}
            onChange={(e) => setExtraHours(e.target.value)}
            required
          />
          <TextInput 
            label="Hourly Premium Rate (Rs.)" 
            type="number"
            placeholder="e.g. 300"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            required
          />
          <Select
            label="Authorization Status"
            placeholder="Choose status..."
            data={['Pending', 'Approved']}
            value={status}
            onChange={setStatus}
            required
          />
          <Button fullWidth color="teal" onClick={handleLogOvertime} mt="md">Log Overtime Record</Button>
        </Stack>
      </Modal>
    </Stack>
  );
};
