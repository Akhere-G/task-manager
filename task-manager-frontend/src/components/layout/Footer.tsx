import { Link } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";

const Footer = () => {
  const { isAuthenticated } = useAuthContext();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface border-t border-slate-200 dark:border-slate-800 mt-auto pt-12 pb-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <h2 className="text-2xl font-black text-brand tracking-tight">
              Task<span className="text-text-main">Flow</span>
            </h2>
            <p className="text-text-sub text-sm leading-relaxed">
              Master your time with AI-powered task decomposition and insightful
              productivity analytics.
            </p>
          </div>

          <div className="pt-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent mb-4">
              Plan
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  to="/"
                  className="text-text-sub hover:text-brand transition-colors"
                >
                  Dashboard
                </Link>
              </li>
              {isAuthenticated && (
                <>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/calendar"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Calendar View
                    </Link>
                  </li>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/stats"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Performance Stats
                    </Link>
                  </li>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/addtask"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Quick Add
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="pt-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent mb-4">
              Account
            </h3>
            <ul className="space-y-2 text-sm">
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/settings"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      User Settings
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/login"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Sign In
                    </Link>
                  </li>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/register"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Create Account
                    </Link>
                  </li>
                  <li>
                    <Link
                      onClick={() =>
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }
                      to="/login/request-password-reset"
                      className="text-text-sub hover:text-brand transition-colors"
                    >
                      Reset Password
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div className="pt-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent mb-4">
              Connect
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  to="/about"
                  className="text-text-sub hover:text-brand transition-colors"
                >
                  About Project
                </Link>
              </li>
              <li>
                <Link
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  to="/contact"
                  className="text-text-sub hover:text-brand transition-colors"
                >
                  Get in Touch
                </Link>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-text-sub border border-slate-200 dark:border-slate-700">
                  v2.0.26
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-text-sub">
            &copy; {year} Task Manager. Built for focused minds.
          </p>
          <div className="flex gap-6 text-xs text-text-sub">
            <Link
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              to="/about"
              className="hover:text-brand underline decoration-brand/30"
            >
              Privacy
            </Link>
            <Link
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              to="/about"
              className="hover:text-brand underline decoration-brand/30"
            >
              Terms
            </Link>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hover:text-brand font-bold transition-colors"
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
