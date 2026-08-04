import { useState } from "react";
import { useAdminAuth } from "../context/authContext";
import { toast } from "react-toastify";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email, password });

      // Only staff accounts belong in the admin area.
      if (!["admin", "staff"].includes(user?.role)) {
        toast.error("This account does not have admin access");
        return;
      }

      toast.success("Admin login successful");

      // redirect after login
      navigate("/admin/dashboard");

    } catch (error) {
      toast.error(error?.message || "Invalid admin credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm bg-white shadow-md rounded-lg p-6 flex flex-col gap-4"
      >
        <h2 className="text-2xl font-bold text-center text-[#330962]">
          Admin Login
        </h2>

        <input
          type="email"
          placeholder="Admin Email"
          className="border p-3 rounded-md"
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="border p-3 rounded-md w-full"
            onChange={(e) => setPassword(e.target.value)}
          />

          <span
            className="absolute right-3 top-3 cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="bg-[#330962] border text-white hover:bg-white hover:text-[#330962] hover:border-[#330962] disabled:opacity-60 py-3 rounded-md"
        >
          {submitting ? "Signing in…" : "Login"}
        </button>
      </form>

    </div>
  );
}

export default AdminLogin;
