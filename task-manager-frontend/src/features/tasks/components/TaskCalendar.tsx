import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type Event,
  type View,
} from "react-big-calendar";
import withDragAndDrop, {
  type DragFromOutsideItemArgs,
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  isSameDay,
  addMilliseconds,
} from "date-fns";
import { enGB } from "date-fns/locale/en-GB";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import type { Task } from "../types";
import CalendarTaskList from "./TaskCalendarList";
import EventCard from "./EventCard";
import CustomToolbar from "./CustomToolbar";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

const locales = { "en-GB": enGB };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

interface TaskCalendarProps {
  tasks: Task[];
  currentDate: Date;
  setCurrentDate: (newDate: Date) => void;
}
export default function TaskCalendar({
  tasks,
  currentDate,
  setCurrentDate,
}: TaskCalendarProps) {
  const { openPopup, updateTask, setIsCompleted } = useTaskContext();

  const [view, setView] = useState<View>(Views.MONTH);

  const [allTasks, setAllTasks] = useState<Task[]>(tasks);
  const [draggedEvent, setDraggedEvent] = useState<Task | null>(null);

  const breakpoint = useBreakpoint();

  const isMobile = ["xs", "sm"].includes(breakpoint);
  useEffect(() => {
    setAllTasks(tasks);
  }, [tasks]);

  const events = useMemo(() => {
    if (!isMobile || view !== Views.MONTH) {
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
      title: "",
      start: new Date(dayStr),
      end: new Date(dayStr),
      allDay: true,
      resource: count,
    }));
  }, [allTasks, isMobile, view]);

  const tasksForSelectedDay = allTasks.filter((t) =>
    isSameDay(new Date(t.startAt), currentDate),
  );

  const onEventDrop = async ({
    event,
    start,
    end,
  }: EventInteractionArgs<Event>) => {
    const newStart = new Date(start as Date);
    const newEnd = new Date(end as Date);
    const task = event.resource as Task;

    const formattedStart = format(newStart, "yyyy-MM-dd HH:mm:ss");
    const formattedEnd = format(newEnd, "yyyy-MM-dd HH:mm:ss");
    const taskId = task.isGhost ? task.seriesId : task.id;

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

  function onDropFromOutside(day: DragFromOutsideItemArgs) {
    if (!draggedEvent) return;
    const startAt = new Date(draggedEvent.startAt);
    const endAt = new Date(draggedEvent.endAt);

    const newStartAt = new Date(day.start);
    newStartAt.setHours(startAt.getHours());
    newStartAt.setMinutes(startAt.getMinutes());

    const newEndAt = addMilliseconds(
      newStartAt,
      endAt.getTime() - startAt.getTime(),
    );

    const prev = allTasks;
    try {
      const startAt = format(newStartAt, "yyyy-MM-dd HH:mm");
      const endAt = format(newEndAt, "yyyy-MM-dd HH:mm");

      const taskId = draggedEvent.isGhost
        ? draggedEvent.seriesId
        : draggedEvent.id;

      setAllTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, startAt, endAt } : t)),
      );

      updateTask(taskId, {
        startAt,
        endAt,
      });
    } catch (err) {
      console.error(err);
      setAllTasks(prev);
    } finally {
      setDraggedEvent(null);
    }
  }

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

  return (
    <div className="space-y-6">
      <div className="card h-112.5 md:h-200">
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onDrillDown={(date) => {
            setCurrentDate(date);
            if (!isMobile) setView(Views.DAY);
          }}
          onNavigate={(date) => setCurrentDate(date)}
          onSelectSlot={({ start }) => setCurrentDate(start as Date)}
          selectable
          messages={{ showMore: () => isMobile }}
          view={view}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          onEventDrop={onEventDrop}
          onDropFromOutside={onDropFromOutside}
          onEventResize={onEventResize}
          onSelectEvent={(event: Event) => {
            if (!isMobile || view !== Views.MONTH)
              openPopup(event.resource as Task, PopupModes.View);
          }}
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
              classes.push("bg-surface-muted!");
            } else {
              classes.push("bg-surface");
            }

            if (isSelected) {
              classes.push("bg-brand/20! dark:!bg-brand/50 ");
            } else {
              classes.push("hover:bg-brand/20 ");
            }

            if (isToday) {
              classes.push("!font-bold", "bg-blue-200! dark:bg-blue-600/50!");
            }

            return {
              className: classes.join(" "),
            };
          }}
          components={{
            toolbar: () => (
              <CustomToolbar
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                view={view}
                setView={setView}
                isMobile={isMobile}
              />
            ),
            event: ({ title, event }) => (
              <EventCard
                title={title}
                event={event}
                isMobile={isMobile}
                view={view}
              />
            ),
          }}
          eventPropGetter={(event: Event) => ({
            className:
              isMobile && view === Views.MONTH
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
          <CalendarTaskList
            tasks={tasksForSelectedDay}
            currentDate={currentDate}
            setSelectedTask={(task: Task) => openPopup(task, PopupModes.View)}
            setIsCompleted={setIsCompleted}
            setDraggedEvent={setDraggedEvent}
          />
        </div>
      </div>
    </div>
  );
}
