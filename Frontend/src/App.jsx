import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
// import FloatingContact from "./components/FloatingContact";

import Home from "./pages/Home";
import About from "./pages/About";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import AdminLogin from "./pages/AdminLogin";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminProtectedRoute from "./routes/AdminProtectedRoute";
import AdminDashboard from "./pages/AdminDashboard";
import AddEvent from "./pages/AddEvent";
import EditEvent from "./pages/EditEvent";
import AdminHomeContent from "./pages/AdminHomeContent";
// import ViewBookings from "./pages/ViewBookings";
import Details from "./pages/Details";
import ScrollToTop from "./components/ScrollToTop";
import PaymentSuccess from "./components/PaymentSuccess";
function App() {
  return (

    <BrowserRouter>
      <ScrollToTop />
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Navbar */}
      <Navbar />

      {/* Routes */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/events" element={<Services />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/services/:id" element={<Details />} />
        <Route path="/events/:id" element={<Details />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/add-event"
          element={
            <AdminProtectedRoute>
              <AddEvent />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/edit/:id"
          element={
            <AdminProtectedRoute>
              <EditEvent />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/home-content"
          element={
            <AdminProtectedRoute>
              <AdminHomeContent />
            </AdminProtectedRoute>
          }
        />
        {/* <Route
          path="/admin/bookings"
          element={
            <AdminProtectedRoute>
              <ViewBookings />
            </AdminProtectedRoute>
          }
        /> */}

      </Routes>

      {/* Footer */}
      <Footer />

      {/* Floating Contact Icons */}
      {/* <FloatingContact /> */}
    </BrowserRouter>
  );
}

export default App;
