import { useAdminAuth } from "../context/authContext";
import { Navigate } from "react-router-dom";

function AdminProtectedRoute({ children }) {

  const { admin, loading } = useAdminAuth();

  // wait until the backend confirms the session
  if (loading) return <h2>Checking authentication...</h2>;

  // if not logged in → go to login
  if (!admin) return <Navigate to="/admin" />;

  // if logged in → show page
  return children;
}

export default AdminProtectedRoute;
