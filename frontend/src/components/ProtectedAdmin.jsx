import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedAdmin({ children }) {
  const { user } = useAuth();

  // Kalau belum login
  if (!user) return <Navigate to="/login" replace />;

  // Kalau rolenya bukan admin
  if (user.role !== "admin") return <Navigate to="/unauthorized" replace />;

  // Kalau admin -> boleh akses
  return children;
}
