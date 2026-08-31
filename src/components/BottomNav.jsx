import { NavLink } from "react-router-dom";
import { LayoutGrid, MessageCircle, Activity, User } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/account", label: "Tool", icon: User },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-item ${isActive ? "active" : ""}`}
        >
          <Icon size={18} strokeWidth={3} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
