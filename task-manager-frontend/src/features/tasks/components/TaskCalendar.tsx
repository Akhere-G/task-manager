import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type Event,
  type View,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  isSameDay,
  addMilliseconds,
  endOfWeek,
  isSameMonth,
  isSameYear,
} from "date-fns";
import { enGB } from "date-fns/locale/en-GB";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import TaskCard from "./TaskCard";
import { FormInput, Popup } from "../../../components/ui";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Plus,
} from "lucide-react";
import { useTaskContext } from "../../../context/TaskContext";
import type { Task } from "../types";
import { useNavigate } from "react-router-dom";

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
  const [view, setView] = useState<View>(Views.MONTH);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>(tasks);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();

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
        const startDate = new Date(task.startAt);
        const endDate = new Date(task.endAt);

        return {
          id: task.id,
          title: task.title || "(No Title)",
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
      const date = format(new Date(task.startAt), "yyyy-MM-dd");
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
    isSameDay(new Date(t.startAt), currentDate),
  );

  const onEventDrop = async ({ event, start }: EventInteractionArgs<Event>) => {
    const newStart = new Date(start as Date);
    const task = event.resource as Task;
    const originalStart = new Date(task.startAt);
    const originalEnd = new Date(task.endAt);

    const newEnd = addMilliseconds(
      newStart,
      originalEnd.getTime() - originalStart.getTime(),
    );

    const formattedStart = format(newStart, "yyyy-MM-dd HH:mm:ss");
    const formattedEnd = format(newEnd, "yyyy-MM-dd HH:mm:ss");
    const taskId = task.id;
    const previousTasks = [...allTasks];

    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, startAt: formattedStart, endAt: formattedEnd }
          : t,
      ),
    );

    try {
      await updateTask(taskId, {
        startAt: formattedStart,
        endAt: formattedEnd,
      });
    } catch (err) {
      console.error("Failed to update task date", err);
      setAllTasks(previousTasks);
    }
  };

  function onEventResize(e: EventInteractionArgs<object>) {
    const { start, end, event: task } = e as EventInteractionArgs<Task>;

    const startAt = format(start, "yyyy-MM-dd HH:mm");
    const endAt = format(end, "yyyy-MM-dd HH:mm");

    const prev = allTasks;

    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, startAt, endAt } : t)),
    );

    try {
      updateTask(task.id, {
        startAt: format(start, "yyyy-MM-dd HH:mm"),
        endAt: format(end, "yyyy-MM-dd HH:mm"),
      });
    } catch (err) {
      console.error(err);
      setAllTasks(prev);
    }
  }

  const CustomToolbar = () => {
    const goToBack = () => {
      const m = new Date(currentDate);
      if (view === Views.MONTH) {
        m.setMonth(m.getMonth() - 1);
      } else if (view === Views.WEEK) {
        m.setDate(m.getDate() - 7);
      } else {
        m.setDate(m.getDate() - 1);
      }
      setCurrentDate(m);
    };
    const goToNext = () => {
      const m = new Date(currentDate);
      if (view === Views.MONTH) {
        m.setMonth(m.getMonth() + 1);
      } else if (view === Views.WEEK) {
        m.setDate(m.getDate() + 7);
      } else {
        m.setDate(m.getDate() + 1);
      }
      setCurrentDate(m);
    };
    let dateStr = format(currentDate, "MMMM yyyy");

    if (view === Views.WEEK) {
      const startWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
      const endWeek = endOfWeek(currentDate, { weekStartsOn: 1 });
      const sameMonth = isSameMonth(endWeek, startWeek);
      const sameYear = isSameYear(endWeek, startWeek);
      let formatStr = "do";
      if (!sameMonth) formatStr += " MMM";
      if (!sameYear) formatStr += " yyyy";
      dateStr = `${format(startWeek, formatStr)} - ${format(endWeek, "do MMM yyyy")}`;
    }
    if (view === Views.DAY) {
      dateStr = format(currentDate, "do MMM yyyy");
    }

    return (
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="text-brand" size={20} />
          <h2 className="text-lg md:text-2xl font-bold text-text-main">
            {dateStr}
          </h2>
        </div>

        <div className="flex gap-4 items ">
          <FormInput
            value={view}
            handleChange={(e) => setView(e.target.value as View)}
            name="view"
            options={[
              { value: Views.MONTH, name: "Month" },
              { value: Views.WEEK, name: "Week" },
              { value: Views.DAY, name: "Day" },
            ]}
          />

          <div className="flex h-11.5  bg-brand px-1 rounded-lg border border-border-light shadow-sm text-text-inverse">
            <button onClick={goToBack} className="btn-primary">
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-primary rounded-none  border-x"
            >
              Today
            </button>
            <button onClick={goToNext} className="btn-primary">
              <ChevronRight size={18} />
            </button>
          </div>
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
          view={view}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onSelectEvent={(event: Event) =>
            !isMobile && setSelectedTask(event.resource as Task)
          }
          dayPropGetter={(date) => {
            const isSelected = isSameDay(date, currentDate);
            const isToday = isSameDay(date, new Date());
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();

            const classes = [
              "transition-all",
              "duration-200",
              "cursor-pointer",
              "relative",
            ];

            if (!isCurrentMonth) {
              classes.push("bg-slate-50/40", "opacity-40", "grayscale-[0.5]");
            } else {
              classes.push("bg-surface");
            }

            if (isSelected) {
              classes.push("!bg-brand/20");
            } else {
              classes.push("hover:bg-brand/20");
            }

            if (isToday) {
              classes.push("!font-bold");
            }

            return {
              className: classes.join(" "),
            };
          }}
          components={{
            toolbar: CustomToolbar,
            event: ({ title = "", event }) => {
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
            {format(currentDate, "E do MMMM")}
          </p>
          <span className="text-xs font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">
            {tasksForSelectedDay.length} Tasks
          </span>
        </div>

        <div className="grid gap-2">
          {tasksForSelectedDay.length > 0 ? (
            tasksForSelectedDay.map((task) => {
              const isOverdue =
                !task.isCompleted && new Date(task.endAt) < new Date();

              return (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 gap-2 bg-surface border border-border-light rounded-2xl shadow-sm active:bg-surface-muted transition-colors"
                  onClick={() => setSelectedTask(task)}
                >
                  <button
                    onClick={(e) => {
                      setIsCompleted(task.id, !task.isCompleted);
                      e.stopPropagation();
                    }}
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 size={24} className="text-brand" />
                    ) : (
                      <Circle size={24} className="text-slate-300" />
                    )}
                  </button>
                  <p className="flex justify-between flex-1 ">
                    <span
                      className={`font-semibold truncate text-sm text-wrap ${task.isCompleted ? "text-text-sub line-through opacity-60" : "text-text-main"}`}
                    >
                      {task.title}
                    </span>
                    <span
                      className={`text-sm text-nowrap ${isOverdue ? "text-failure" : "text-text-sub"}`}
                    >
                      {format(new Date(task.startAt), "p")}
                    </span>
                  </p>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-surface">
              <p className="text-text-sub text-sm italic">
                No tasks on {format(currentDate, "PPPP")}.
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        className="z-1 fixed bottom-5 right-5 btn-primary rounded-full w-10 h-10 flex items-center justify-center shadow-xl"
        onClick={() => navigate("/addtask", { state: { currentDate } })}
      >
        <Plus />
      </button>

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
