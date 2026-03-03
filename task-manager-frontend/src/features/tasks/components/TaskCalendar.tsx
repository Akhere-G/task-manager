import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type Event,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay, isSameDay } from "date-fns";
import { enGB } from "date-fns/locale/en-GB";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import TaskCard from "./TaskCard";
import { Popup } from "../../../components/ui";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useTaskContext } from "../../../context/TaskContext";
import type { Task } from "../types";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

export default function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const { updateTask, handleConfirmDelete, handleConfirmEdit, setIsCompleted } =
    useTaskContext();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>(tasks);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setAllTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const events = useMemo(() => {
    if (!isMobile) {
      return allTasks.map((task) => {
        const endDate = new Date(task.dueDate);
        const startDate = new Date(
          endDate.getTime() - task.estimatedTime * 60000,
        );

        return {
          id: task.id,
          title: task.title,
          start: startDate,
          end: endDate,
          allDay: false,
          resource: task,
        };
      });
    }

    // On Mobile: Group tasks by date so we only have one "Event Row" per day
    const uniqueDayLookup: Record<string, number> = {};
    allTasks.forEach((task) => {
      const date = format(new Date(task.dueDate), "yyyy-MM-dd");
      if (uniqueDayLookup[date]) {
        uniqueDayLookup[date] += 1;
      } else {
        uniqueDayLookup[date] = 1;
      }
    });

    return Object.entries(uniqueDayLookup).map(([dayStr, count]) => ({
      id: dayStr,
      title: "", // Title not needed for dots
      start: new Date(dayStr),
      end: new Date(dayStr),
      allDay: true,
      resource: count,
    }));
  }, [allTasks, isMobile]);

  const tasksForSelectedDay = allTasks.filter((t) =>
    isSameDay(new Date(t.dueDate), currentDate),
  );

  const onEventDrop = async ({ event, start }: EventInteractionArgs<Event>) => {
    const newDate = new Date(start as Date);
    const task = event.resource as Task;
    const originalDate = new Date(task.dueDate);

    newDate.setHours(originalDate.getHours());
    newDate.setMinutes(originalDate.getMinutes());
    newDate.setSeconds(originalDate.getSeconds());

    const formattedDate = format(newDate, "yyyy-MM-dd HH:mm:ss");
    const taskId = task.id;
    const previousTasks = [...allTasks];

    setAllTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, dueDate: formattedDate } : t)),
    );

    try {
      await updateTask(taskId, { dueDate: formattedDate });
    } catch (err) {
      console.error("Failed to update task date", err);
      setAllTasks(previousTasks);
    }
  };

  const CustomToolbar = () => {
    const goToBack = () => {
      const m = new Date(currentDate);
      m.setMonth(m.getMonth() - 1);
      setCurrentDate(m);
    };
    const goToNext = () => {
      const m = new Date(currentDate);
      m.setMonth(m.getMonth() + 1);
      setCurrentDate(m);
    };
    return (
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-brand" size={20} />
          <h2 className="text-lg md:text-2xl font-bold text-text-main">
            {format(currentDate, "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex items-center bg-surface-muted p-1 rounded-lg border border-border-light shadow-sm">
          <button
            onClick={goToBack}
            className="p-1.5 hover:bg-surface rounded-md transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs font-semibold border-x border-border-light"
          >
            Today
          </button>
          <button
            onClick={goToNext}
            className="p-1.5 hover:bg-surface rounded-md transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="card p-2 md:p-6 bg-surface shadow-xl border-border-light h-112.5 md:h-200">
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onNavigate={(date) => setCurrentDate(date as Date)}
          onDrillDown={(date) => setCurrentDate(date)}
          onSelectSlot={({ start }) => setCurrentDate(start as Date)}
          selectable
          messages={{ showMore: () => isMobile }}
          view={Views.MONTH}
          views={[Views.MONTH]}
          onEventDrop={onEventDrop}
          // Disabled on mobile so dots aren't clickable
          onSelectEvent={(event: Event) =>
            !isMobile && setSelectedTask(event.resource as Task)
          }
          dayPropGetter={(date) => ({
            className: isSameDay(date, currentDate)
              ? "!bg-brand/5 !border-brand/30 border-2 rounded-lg"
              : "",
          })}
          components={{
            toolbar: CustomToolbar,
            event: ({ title, event }) => {
              if (isMobile) {
                const count = Math.min(9, (event as Event).resource);
                return (
                  <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                    {new Array(count).fill(1).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full bg-brand`}
                      />
                    ))}
                  </div>
                );
              }
              return <span className="text-xs truncate">{title}</span>;
            },
          }}
          eventPropGetter={(event: Event) => ({
            className: isMobile
              ? "!bg-transparent !border-none !shadow-none !pointer-events-none"
              : `!border-none !shadow-sm !rounded-md !px-2 !py-1 !text-xs !font-medium transition-all ${
                  (event.resource as Task).isCompleted
                    ? "!bg-slate-200 !text-slate-500 !line-through"
                    : "!bg-brand !text-white"
                }`,
          })}
        />
      </div>

      <div className="md:hidden space-y-4">
        <div className="flex items-center justify-between border-b border-border-light pb-2 px-1">
          <p className="text-sm font-bold text-text-sub uppercase tracking-widest">
            {format(currentDate, "do MMMM")}
          </p>
          <span className="text-xs font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">
            {tasksForSelectedDay.length} Tasks
          </span>
        </div>

        <div className="grid gap-2">
          {tasksForSelectedDay.length > 0 ? (
            tasksForSelectedDay.map((task) => {
              const isOverdue = new Date(task.dueDate) < new Date();

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 gap-2 bg-surface border border-border-light rounded-2xl shadow-sm active:bg-surface-muted transition-colors"
                  onClick={() => setSelectedTask(task)}
                >
                  <button
                    onClick={() => {
                      setIsCompleted(task.id, !task.isCompleted);
                    }}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 size={24} className="text-brand" />
                    ) : (
                      <Circle size={24} className="text-slate-300" />
                    )}
                  </button>
                  <p className="flex justify-between w-full flex-1">
                    <span
                      className={`text-base font-semibold truncate ${task.isCompleted ? "text-text-sub line-through opacity-60" : "text-text-main"}`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={isOverdue ? "text-failure" : "text-text-sub"}
                    >
                      {format(new Date(task.dueDate), "p")}
                    </span>
                  </p>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-surface">
              <p className="text-text-sub text-sm italic">No tasks today.</p>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <Popup
          title=""
          close={() => setSelectedTask(null)}
          showCloseButton={false}
          sleek
        >
          <TaskCard
            {...selectedTask}
            onDelete={(task) => {
              handleConfirmDelete(task);
              setSelectedTask(null);
            }}
            onEdit={(task) => {
              handleConfirmEdit(task);
              setSelectedTask(null);
            }}
            setIsCompleted={(id, completed) => {
              setIsCompleted(id, completed);
              setSelectedTask(null);
            }}
          />
        </Popup>
      )}
    </div>
  );
}
