import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Calendar, Briefcase, DollarSign,
  CheckSquare, MessageCircle, ShieldCheck, Building2, LogOut, Moon, Sun, Building,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

const employeeItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Attendance", url: "/attendance", icon: Calendar },
  { title: "Leaves", url: "/leaves", icon: Briefcase },
  { title: "My Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Payroll", url: "/payroll", icon: DollarSign },
  { title: "Counseling", url: "/counseling", icon: MessageCircle },
];

const adminItems = [
  { title: "Approvals", url: "/admin/approvals", icon: ShieldCheck },
  { title: "Employees", url: "/admin/employees", icon: Users },
  { title: "Departments", url: "/admin/departments", icon: Building },
  { title: "Attendance", url: "/admin/attendance", icon: Calendar },
  { title: "Leaves", url: "/admin/leaves", icon: Briefcase },
  { title: "Payroll", url: "/admin/payroll", icon: DollarSign },
  { title: "Tasks", url: "/admin/tasks", icon: CheckSquare },
  { title: "Hiring", url: "/admin/hiring", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const isActive = (p: string) => pathname === p;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            <img src="/favicon.ico" alt="DeVerse Logo" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm">DeVerse</span>
              <span className="text-[10px] text-muted-foreground">IT Solutions</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          {!collapsed && (
            <div className="text-xs truncate">
              <p className="font-medium truncate">{user?.email}</p>
              <p className="text-muted-foreground capitalize">{role}</p>
            </div>
          )}
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
