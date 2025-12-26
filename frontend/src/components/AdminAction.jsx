// src/components/AdminAction.jsx
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function AdminAction({ onExecute, children }) {
  const { user } = useAuth?.() || { user: null }; // safe fallback

  const handleClick = (e) => {
    // prevent child's default if child is a button
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (user?.role && user.role !== "admin") {
      toast.error("Access Denied — Admin only. Rejected by Lanz Firewall.");
      return;
    }

    if (!user && typeof onExecute !== "function") {
      // if no auth system, allow (dev mode)
      if (onExecute) onExecute();
      return;
    }

    if (onExecute) onExecute();
  };

  // We wrap children and intercept clicks
  return (
    <span onClick={handleClick} className="inline-block">
      {children}
    </span>
  );
}