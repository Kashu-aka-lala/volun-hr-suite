import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "@/pages/auth/Auth";
import Pending from "@/pages/auth/Pending";
import Dashboard from "@/pages/Dashboard";
import Attendance from "@/pages/employee/Attendance";
import Leaves from "@/pages/employee/Leaves";
import MyTasks from "@/pages/employee/Tasks";
import MyPayroll from "@/pages/employee/Payroll";
import Counseling from "@/pages/employee/Counseling";
import Approvals from "@/pages/admin/Approvals";
import AdminEmployees from "@/pages/admin/Employees";
import Departments from "@/pages/admin/Departments";
import AdminAttendance from "@/pages/admin/AdminAttendance";
import AdminLeaves from "@/pages/admin/AdminLeaves";
import AdminPayroll from "@/pages/admin/AdminPayroll";
import AdminTasks from "@/pages/admin/AdminTasks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/pending" element={<Pending />} />
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/leaves" element={<Leaves />} />
                <Route path="/tasks" element={<MyTasks />} />
                <Route path="/payroll" element={<MyPayroll />} />
                <Route path="/counseling" element={<Counseling />} />
              </Route>
              <Route element={<ProtectedRoute requireAdmin><AppLayout /></ProtectedRoute>}>
                <Route path="/admin/approvals" element={<Approvals />} />
                <Route path="/admin/employees" element={<AdminEmployees />} />
                <Route path="/admin/departments" element={<Departments />} />
                <Route path="/admin/attendance" element={<AdminAttendance />} />
                <Route path="/admin/leaves" element={<AdminLeaves />} />
                <Route path="/admin/payroll" element={<AdminPayroll />} />
                <Route path="/admin/tasks" element={<AdminTasks />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
