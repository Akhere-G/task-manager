import { Route, Routes, useLocation } from "react-router-dom";
import { About, AddTask, Contact, Home, Stats, TaskDetails, CalendarView, Register, Login } from "./pages";
import { Footer, Header } from "./components/layout";

function App() {
  const navLinks = [
    { title: "Tasks", path: "/" },
    { title: "Add Task", path: "/addtasks" },
    { title: "Calendar", path: "/calendar" },
    { title: "Stats", path: "/stats" },
    { title: "About", path: "/about" },
    { title: "Contact", path: "/contact" },
    { title: "Register", path: "/register" },
    { title: "Login", path: "/login" },
  ];

  const location = useLocation();

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header links={navLinks} currentPath={location.pathname}/>
      <main className="grow max-w-7xl mx-auto w-full px-6 py-8">
        <Routes>    
          <Route path="/" element={<Home />} />
          <Route path="/addtasks" element={<AddTask />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/task/:id" element={<TaskDetails />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="*" element={<div className="text-center py-20">Page Not Found</div>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;