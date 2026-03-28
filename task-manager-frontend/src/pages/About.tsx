import React from "react";
import {
  BarChart3,
  Timer,
  Cpu,
  Zap,
  Split,
  BrainCircuit,
  LayoutList,
  RefreshCw,
  Activity,
  Clock,
} from "lucide-react";

export default function AboutPage() {
  const FEATURES = [
    {
      icon: <LayoutList className="text-brand" size={28} />,
      title: "Flexible Views",
      description:
        "Switch between a clean list and a full calendar. Use smart filters and sorting to see exactly what needs your attention right now.",
    },
    {
      icon: <RefreshCw className="text-brand" size={28} />, // You'll need to import RefreshCw from lucide-react
      title: "Seamless Habits",
      description:
        "Set tasks to repeat daily, weekly, or monthly. Our system projects 'ghost tasks' into your future calendar so you can plan for upcoming commitments.",
    },
    {
      icon: <BrainCircuit className="text-brand" size={28} />,
      title: "Your Daily Brief",
      description:
        "Start your day with an AI coach. It looks at your pending and overdue tasks to suggest the best plan of action for a productive morning.",
    },
    {
      icon: <Split className="text-brand" size={28} />,
      title: "Break It Down",
      description:
        "Don't let big projects overwhelm you. Our AI can take a single large task and split it into a clear, manageable checklist of smaller steps.",
    },
    {
      icon: <Zap className="text-brand" size={28} />,
      title: "Quick-Add Tools",
      description:
        "Add tasks instantly by typing naturally with our AI assistant, or upload a CSV file to move an entire project's worth of tasks in one go.",
    },

    {
      icon: <Timer className="text-brand" size={28} />,
      title: "Pomodoro Timer",
      description:
        "Boost your focus using timed work intervals. Every session you complete is automatically logged against your tasks for accurate time-tracking.",
    },
    {
      icon: <Activity className="text-brand" size={28} />,
      title: "Performance Summary",
      description:
        "See your progress with a year-long activity map. Monitor your 'Backlog Health' and daily productivity to stay on top of your work.",
    },
    {
      icon: <Clock className="text-brand" size={28} />,
      title: "Planning & Deadlines",
      description:
        "Look at the week ahead to see upcoming deadlines. Our charts show you exactly how close your due dates are and which tasks are overdue.",
    },
    {
      icon: <BarChart3 className="text-brand" size={28} />,
      title: "Workload Insights",
      description:
        "Understand where your time goes. See a breakdown of time spent on different categories, like work, health, or hobbies, over the last seven days.",
    },
  ];

  return (
    <div>
      <section className="text-center mb-20 px-2 md:px-0">
        <h1 className="text-5xl font-extrabold text-text-main mb-6 tracking-tight">
          Visualise Your <span className="text-brand">Workflow.</span>
        </h1>
        <p className="text-xl text-text-sub max-w-2xl mx-auto leading-relaxed">
          A high-performance task engine designed to turn raw productivity data
          into actionable insights. Track your progress, manage your energy, and
          master your time.
        </p>
      </section>

      <h2 className="text-3xl font-bold text-text-main mb-10 text-left border-b border-border-light pb-4 px-2 md:px-0">
        Core Methodology
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.title}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>

      <section className="card p-8 bg-bg-secondary rounded-2xl border border-border-light shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="text-brand" size={24} />
              <h2 className="text-2xl font-bold text-text-main">
                The Architecture
              </h2>
            </div>
            <p className="text-text-sub leading-relaxed text-lg">
              Our platform is built on a modern full-stack architecture designed
              for high performance. We utilise a{" "}
              <strong>Python and Flask</strong> backend to handle the heavy
              lifting, from <strong>database management</strong> to{" "}
              <strong>AI-driven logic</strong>. On the frontend,{" "}
              <strong>Axios</strong> manages efficient API communication, while{" "}
              <strong>TanStack Query</strong> provides{" "}
              <strong>seamless state management</strong> and{" "}
              <strong>asynchronous data caching</strong>. Built with{" "}
              <strong>TypeScript, React and Tailwind CSS</strong>, this setup
              ensures a snappy, type-safe interface.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-start lg:justify-end max-w-xs">
            {[
              "Python",
              "Flask",
              "React",
              "TypeScript",
              "Recharts",
              "Tailwind CSS",
            ].map((tech) => (
              <span
                key={tech}
                className="px-4 py-1.5 bg-brand/10 text-brand text-sm font-semibold rounded-full border border-brand/20"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-8 bg-surface rounded-2xl border border-border-light shadow-sm hover:border-brand/40 hover:shadow-md transition-all duration-150">
      <div className="mb-5 p-3 bg-brand/5 rounded-xl w-fit group-hover:bg-brand/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-text-main mb-3">{title}</h3>
      <p className="text-text-sub leading-relaxed">{description}</p>
    </div>
  );
}
