import { useState } from 'react';
import { 
  Paper, Text, Title, Table, Badge, Button, Group, Stack, 
  TextInput, Select, Checkbox, SimpleGrid
} from '@mantine/core';
import { 
  IconCash, IconAlertTriangle, IconKey, IconCalendar, 
  IconClipboardCheck, IconClock, IconPlus, IconCheck
} from '@tabler/icons-react';

// ==========================================
// 1. SALARY MANAGEMENT
// ==========================================
export const SalaryManagement = () => {
  const [salaries] = useState([
    { id: '1', employee: 'Muhammad Abdullah', role: 'Manager', salary: 85000, status: 'Paid', date: '2026-05-10' },
    { id: '2', employee: 'Ayesha Khan', role: 'Cashier', salary: 35000, status: 'Paid', date: '2026-05-10' },
    { id: '3', employee: 'Zainab Bibi', role: 'Sales Assitant', salary: 30000, status: 'Pending', date: '2026-05-10' },
    { id: '4', employee: 'Ali Raza', role: 'Store Keeper', salary: 40000, status: 'Paid', date: '2026-05-10' },
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Salary Management</Title>
          <Text size="sm" c="dimmed">Manage employee payrolls, base salaries, and payout logs.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} color="blue">Generate Payroll</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Total Payroll Paid</Text>
            <IconCash size={20} style={{ color: 'var(--mantine-color-green-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">Rs. 160,000</Text>
          <Text size="xs" c="green" mt="xs" fw={500}>For May 2026</Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Pending Payouts</Text>
            <IconCash size={20} style={{ color: 'var(--mantine-color-orange-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">Rs. 30,000</Text>
          <Text size="xs" c="orange" mt="xs" fw={500}>1 Employee Remaining</Text>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Active Employees</Text>
            <IconClock size={20} style={{ color: 'var(--mantine-color-blue-filled)' }} />
          </Group>
          <Text size="xl" fw={700} mt="xs">4 Employees</Text>
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
                  <Button size="xs" variant="light" color={row.status === 'Paid' ? 'gray' : 'green'}>
                    {row.status === 'Paid' ? 'Receipt' : 'Pay Now'}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
};

// ==========================================
// 2. DAMAGES
// ==========================================
export const Damages = () => {
  const [damages] = useState([
    { id: '1', employee: 'Ali Raza', item: 'Barcode Scanner (Wireless)', value: 4500, deduction: 1500, status: 'Deducted', date: '2026-05-12' },
    { id: '2', employee: 'Ayesha Khan', item: 'Thermal Printer Cable', value: 800, deduction: 800, status: 'Resolved', date: '2026-05-15' },
    { id: '3', employee: 'Zainab Bibi', item: 'Display Rack Corner Glass', value: 8000, deduction: 2000, status: 'Pending Approval', date: '2026-05-18' },
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Employee Damages Tracker</Title>
          <Text size="sm" c="dimmed">Track company assets damaged by staff and manage recovery/deductions.</Text>
        </div>
        <Button leftSection={<IconAlertTriangle size={16} />} color="red">Report Damage</Button>
      </Group>

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
    </Stack>
  );
};

// ==========================================
// 3. CHANGE PASSWORD
// ==========================================
export const ChangePassword = () => {
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

          <Select 
            label="Select Employee" 
            placeholder="Choose employee..."
            data={['Muhammad Abdullah', 'Ayesha Khan', 'Zainab Bibi', 'Ali Raza']}
            required
          />
          <TextInput label="Current Password" type="password" placeholder="••••••••" disabled />
          <TextInput label="New Password" type="password" placeholder="Enter new strong password" required />
          <TextInput label="Confirm New Password" type="password" placeholder="Confirm new password" required />

          <Button fullWidth mt="md" color="blue">Update Password</Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

// ==========================================
// 4. EMPLOYEE ACCESS
// ==========================================
export const EmployeeAccess = () => {
  const [employees, setEmployees] = useState([
    { name: 'Muhammad Abdullah', role: 'Manager', dashboard: true, pos: true, expenses: true, analytics: true, settings: true },
    { name: 'Ayesha Khan', role: 'Cashier', dashboard: true, pos: true, expenses: false, analytics: false, settings: false },
    { name: 'Zainab Bibi', role: 'Sales Assistant', dashboard: true, pos: false, expenses: false, analytics: false, settings: false },
    { name: 'Ali Raza', role: 'Store Keeper', dashboard: true, pos: false, expenses: true, analytics: false, settings: false },
  ]);

  const toggleAccess = (index: number, module: string) => {
    const updated = [...employees];
    (updated[index] as any)[module] = !(updated[index] as any)[module];
    setEmployees(updated);
  };

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Employee System Access</Title>
        <Text size="sm" c="dimmed">Fine-tune feature permissions for each employee role.</Text>
      </div>

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
          <Button color="blue" leftSection={<IconCheck size={16} />}>Save Changes</Button>
        </Group>
      </Paper>
    </Stack>
  );
};

// ==========================================
// 5. DUTY ROASTER
// ==========================================
export const DutyRoaster = () => {
  const [shifts] = useState([
    { day: 'Monday', morning: 'Ayesha Khan', evening: 'Muhammad Abdullah', night: 'Ali Raza' },
    { day: 'Tuesday', morning: 'Ayesha Khan', evening: 'Muhammad Abdullah', night: 'Zainab Bibi' },
    { day: 'Wednesday', morning: 'Zainab Bibi', evening: 'Muhammad Abdullah', night: 'Ali Raza' },
    { day: 'Thursday', morning: 'Ayesha Khan', evening: 'Zainab Bibi', night: 'Ali Raza' },
    { day: 'Friday', morning: 'Ayesha Khan', evening: 'Muhammad Abdullah', night: 'Ali Raza' },
    { day: 'Saturday', morning: 'Zainab Bibi', evening: 'Muhammad Abdullah', night: 'Ayesha Khan' },
    { day: 'Sunday', morning: 'Ali Raza', evening: 'Zainab Bibi', night: 'Muhammad Abdullah' },
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Duty Roaster</Title>
          <Text size="sm" c="dimmed">Manage weekly staff shift assignments and working schedules.</Text>
        </div>
        <Button leftSection={<IconCalendar size={16} />}>Assign Shift Override</Button>
      </Group>

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
    </Stack>
  );
};

// ==========================================
// 6. ATTENDANCE REPORT
// ==========================================
export const AttendanceReport = () => {
  const [records] = useState([
    { id: '1', date: '2026-05-20', name: 'Muhammad Abdullah', checkIn: '08:52 AM', checkOut: '05:05 PM', late: 'No', status: 'Present' },
    { id: '2', date: '2026-05-20', name: 'Ayesha Khan', checkIn: '09:18 AM', checkOut: '05:00 PM', late: 'Yes (18m)', status: 'Present' },
    { id: '3', date: '2026-05-20', name: 'Ali Raza', checkIn: '08:58 AM', checkOut: '--', late: 'No', status: 'Active' },
    { id: '4', date: '2026-05-20', name: 'Zainab Bibi', checkIn: '--', checkOut: '--', late: 'No', status: 'On Leave' },
  ]);

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
          <Button leftSection={<IconClipboardCheck size={16} />} color="teal">Export Report</Button>
        </Group>
      </Group>

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
    </Stack>
  );
};

// ==========================================
// 7. OVERTIME DETAILS
// ==========================================
export const OverTimeDetails = () => {
  const [overtime] = useState([
    { id: '1', name: 'Ali Raza', date: '2026-05-18', hours: 3.5, rate: 300, total: 1050, status: 'Approved' },
    { id: '2', name: 'Ayesha Khan', date: '2026-05-19', hours: 2.0, rate: 300, total: 600, status: 'Pending' },
    { id: '3', name: 'Muhammad Abdullah', date: '2026-05-19', hours: 4.0, rate: 500, total: 2000, status: 'Approved' },
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Overtime Details</Title>
          <Text size="sm" c="dimmed">Monitor extra hours worked by employees and manage hourly overtime multipliers.</Text>
        </div>
        <Button leftSection={<IconClock size={16} />} color="teal">Log Overtime</Button>
      </Group>

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
    </Stack>
  );
};
