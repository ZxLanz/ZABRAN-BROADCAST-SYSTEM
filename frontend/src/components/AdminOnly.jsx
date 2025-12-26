import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminOnly({ children }) {
  const { user } = useAuth();

  // Jika belum login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Jika bukan admin → tolak
  if (user.role !== "admin") {
    return <Navigate to="/unauthorized" replace />;
  }

  // Jika admin → izinkan
  return children;
}
