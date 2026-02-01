import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Activity, MessageSquare, BarChart3, Home } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Dashboard" },
  { path: "/coach", icon: MessageSquare, label: "Coach" },
  { path: "/progress", icon: BarChart3, label: "Progress" },
];

export const Layout = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-background p-6">
        <div className="mb-10">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <span className="font-heading text-xl uppercase tracking-tight font-bold">
              CardioCoach
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm font-mono uppercase tracking-wider transition-colors ${
                  isActive
                    ? "text-primary border-l-2 border-primary bg-muted/50"
                    : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="pt-6 border-t border-border mt-auto">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Elite Endurance Analysis
          </p>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <span className="font-heading text-lg uppercase tracking-tight font-bold">
            CardioCoach
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around p-2 border-t border-border bg-background/95 backdrop-blur-sm">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              className={`flex flex-col items-center gap-1 p-2 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-mono text-[9px] uppercase tracking-wider">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
