import React from "react";
import {
  AlarmClock,
  BarChart3,
  Bell,
  CalendarDays,
  Columns3,
  Cpu,
  Download,
  Folder,
  Sparkles,
  RefreshCw,
  Split,
  Timer,
  Upload,
  Zap,
} from "lucide-react";

const SCREENSHOTS = [
  {
    src: "/screenshots/taskflow-list.png",
    alt: "The task list grouped into overdue, today and upcoming, with a project sidebar.",
    caption: "List view: overdue, today and upcoming, grouped by project.",
  },
  {
    src: "/screenshots/taskflow-board.png",
    alt: "A kanban board with To Do, In Progress and Done columns, each card tagged with its project.",
    caption: "Board view: each project gets its own columns.",
  },
  {
    src: "/screenshots/taskflow-matrix.png",
    alt: "Tasks sorted into the four Eisenhower matrix quadrants.",
    caption: "Eisenhower matrix: drag a task between quadrants to change its priority.",
  },
  {
    src: "/screenshots/taskflow-week.png",
    alt: "A week calendar with tasks coloured by project across seven days.",
    caption: "Week view on a busy week, coloured by project.",
  },
  {
    src: "/screenshots/taskflow-day.png",
    alt: "A day calendar with six tasks of different project colours.",
    caption: "Day view on a busy day.",
  },
  {
    src: "/screenshots/taskflow-brief.png",
    alt: "A daily brief summarising today's priorities and overdue work.",
    caption: "The AI daily brief, written from your own tasks.",
  },
  {
    src: "/screenshots/taskflow-add-task.png",
    alt: "The add task form with title, project, priority, schedule, reminders and repeat settings.",
    caption: "Adding a task, with schedule, reminders and repeats.",
  },
  {
    src: "/screenshots/taskflow-stats-1.png",
    alt: "A statistics dashboard with completion rate, streak, an activity heatmap and deadline charts.",
    caption: "Statistics: completion rate, streak, a year of activity and upcoming deadlines.",
  },
  {
    src: "/screenshots/taskflow-stats-2.png",
    alt: "Statistics charts for project breakdown, weekly flow, turnaround time and estimation accuracy.",
    caption: "Statistics: where time goes and how accurate estimates are.",
  },
];

export default function AboutPage() {
  const FEATURES = [
    {
      icon: <CalendarDays className="text-brand" size={28} />,
      title: "Calendar View",
      description:
        "See your week at a glance and drag tasks onto new days in seconds, so your schedule always matches your plans.",
    },
    {
      icon: <Columns3 className="text-brand" size={28} />,
      title: "Kanban Board",
      description:
        "Move work from idea to done on a visual board. Drag each task across columns and watch your projects move forward.",
    },
    {
      icon: <Sparkles className="text-brand" size={28} />,
      title: "Smart Prioritise",
      description:
        "Stop guessing what matters. Sort tasks into four priority quadrants with the Eisenhower Matrix, then let AI suggest changes with a clear reason for each.",
    },
    {
      icon: <RefreshCw className="text-brand" size={28} />,
      title: "Seamless Habits",
      description:
        "Never lose track of recurring commitments. Set tasks to repeat and see what is coming up on your calendar, ready to plan around.",
    },
    {
      icon: <Bell className="text-brand" size={28} />,
      title: "Reminders",
      description:
        "Never miss a deadline. Get timely push notifications, from half an hour ahead or at a time you choose.",
    },
    {
      icon: <Folder className="text-brand" size={28} />,
      title: "Projects and Labels",
      description:
        "Keep work, home and everything in between in order. Group tasks into projects, tag them with labels and see only what you need.",
    },
    {
      icon: <AlarmClock className="text-brand" size={28} />,
      title: "Snooze",
      description:
        "Life gets busy. Push a task to tomorrow, the weekend or a date you choose, and keep its time of day.",
    },
    {
      icon: (
        <span className="flex gap-1">
          <Upload className="text-brand" size={22} />
          <Download className="text-brand" size={22} />
        </span>
      ),
      title: "Import and Export",
      description:
        "Bring in tasks from a spreadsheet in one go, or export everything to CSV whenever you need a copy.",
    },
    {
      icon: <Split className="text-brand" size={28} />,
      title: "Break It Down",
      description:
        "Big goals feel easier in small steps. Split a large task into a checklist by hand or with AI, then tick off progress as you go.",
    },
    {
      icon: <Zap className="text-brand" size={28} />,
      title: "Quick Add",
      description:
        "Capture an idea in seconds. Type it the way you think and the AI fills in the details, so nothing slips away.",
    },
    {
      icon: <Timer className="text-brand" size={28} />,
      title: "Pomodoro Timer",
      description:
        "Get more done in less time. Work in focused sprints and mark a task complete the moment a session ends.",
    },
    {
      icon: <BarChart3 className="text-brand" size={28} />,
      title: "Stats and Planning",
      description:
        "The Stats page shows your progress over time, from your yearly activity to your backlog health and where your time goes. Use it to plan ahead with confidence.",
    },
  ];

  return (
    <div>
      <section className="text-center mb-20 px-2 md:px-0">
        <h1 className="text-5xl font-extrabold text-text-main mb-6 tracking-tight">
          Visualise Your <span className="text-brand">Workflow.</span>
        </h1>
        <p className="text-xl text-text-sub max-w-2xl mx-auto leading-relaxed">
          Turn a busy to-do list into a clear plan. Know what matters most, see
          what is coming, and get more done.
        </p>
      </section>

      <h2 className="text-3xl font-bold text-text-main mb-10 text-left border-b border-border-light pb-4 px-2 md:px-0">
        Everything You Need
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

      <h2 className="text-3xl font-bold text-text-main mb-10 text-left border-b border-border-light pb-4 px-2 md:px-0">
        See It In Action
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
        {SCREENSHOTS.map((shot) => (
          <figure key={shot.src} className="m-0">
            <img
              src={shot.src}
              alt={shot.alt}
              loading="lazy"
              width={1440}
              height={900}
              className="w-full h-auto rounded-xl border border-border-light shadow-sm"
            />
            <figcaption className="mt-2 text-sm text-text-sub">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <section className="card p-8 bg-bg-secondary rounded-2xl shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="text-brand" size={24} />
              <h2 className="text-2xl font-bold text-text-main">
                How It&apos;s Built
              </h2>
            </div>
            <p className="text-text-sub leading-relaxed text-lg">
              TaskFlow is a React and TypeScript app on a Python and Flask API
              with a PostgreSQL database. Repeating tasks are calculated when
              you need them rather than stored many times over, AI suggestions
              wait for you to accept them, and AI assistants such as Claude can
              manage your tasks through a secure connection you can revoke at
              any time.{" "}
              <a
                href="https://github.com/Akhere-G/task-manager"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline"
              >
                See the code on GitHub
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-start lg:justify-end max-w-xs">
            {[
              "Python",
              "Flask",
              "PostgreSQL",
              "React",
              "TypeScript",
              "TanStack Query",
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
    <div className="p-8 bg-surface rounded-2xl shadow-sm">
      <div className="mb-5 p-3 bg-brand/5 rounded-xl w-fit">{icon}</div>
      <h3 className="text-xl font-bold text-text-main mb-3">{title}</h3>
      <p className="text-text-sub leading-relaxed">{description}</p>
    </div>
  );
}
