import { useState, useMemo, useEffect } from "react";
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
import EventCard from "./EventCard";
import CustomToolbar from "./CustomToolbar";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { useNavigate, useSearchParams } from "react-router-dom";
import useUpdateTask from "../hooks/useUpdateTask";

import {
  getCalendarTaskId,
  getDayClassName,
  getEventClassName,
  mapTasksToCalendarEvents,
} from "../utils";
import MobileTaskSection from "./MobileTaskSelection";

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
  const [allTasks, setAllTasks] = useState(tasks);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { openPopup } = useTaskContext();

  const [searchParams, setSearchParams] = useSearchParams();
  const [draggedEvent, setDraggedEvent] = useState<Task | null>(null);

  const navigate = useNavigate();
  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);

  const view = (searchParams.get("view") as View) || Views.MONTH;
  const setView = (view: View) => {
    searchParams.set("view", view);
    setSearchParams(searchParams);
  };

  useEffect(() => {
    setAllTasks(tasks);
  }, [tasks]);

  const events = useMemo(
    () => mapTasksToCalendarEvents(allTasks, isMobile, view),
    [allTasks, isMobile, view],
  );

  const tasksForSelectedDay = allTasks.filter((t) =>
    isSameDay(new Date(t.startAt), currentDate),
  );

  const handleTaskDateChange = async (task: Task, start: Date, end: Date) => {
    if (task.isGhost) return;
    const prev = allTasks;
    const startAt = format(start, "yyyy-MM-dd HH:mm:ss");
    const endAt = format(end, "yyyy-MM-dd HH:mm:ss");

    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, startAt, endAt } : t)),
    );
    try {
      await updateTask({
        id: getCalendarTaskId(task),
        newTaskData: {
          startAt,
          endAt,
        },
      });
    } catch (err) {
      setAllTasks(prev);
      console.error("Failed to update task date", err);
      throw err;
    }
  };

  const onEventDrop = async ({
    event,
    start,
    end,
  }: EventInteractionArgs<Event>) => {
    const newStart = new Date(start as Date);
    const newEnd = new Date(end as Date);
    const task = event.resource as Task;

    handleTaskDateChange(task, newStart, newEnd);
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

    try {
      handleTaskDateChange(draggedEvent, newStartAt, newEndAt);
    } catch (err) {
      console.error(err);
    } finally {
      setDraggedEvent(null);
    }
  }

  function onEventResize(e: EventInteractionArgs<Event>) {
    const { start, end, event } = e;
    const task: Task = event.resource;

    handleTaskDateChange(task, new Date(start), new Date(end));
  }

  return (
    <div className="space-y-6">
      <div className="card px-0 md:px-2 h-112.5 md:h-225">
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={currentDate}
          onDrillDown={(date) => {
            setCurrentDate(date);
            if (!isMobile) setView(Views.DAY);
          }}
          onNavigate={(date) => setCurrentDate(date)}
          onSelectSlot={({ start, end, action }) => {
            switch (action) {
              case "click":
                setCurrentDate(start as Date);
                break;
              case "select":
                navigate("/addtask", {
                  state: { startAt: start, endAt: end },
                });
            }
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handleDragStart={(event: any) => {
            setDraggedEvent(event.resource);
          }}
          formats={{
            dayFormat: (date: Date) =>
              isMobile ? format(date, "dd") : format(date, "EEE dd/MM"),
            timeGutterFormat: (date) =>
              isMobile ? format(date, "HH") : format(date, "p"),

            eventTimeRangeFormat: ({ start, end }) =>
              isMobile
                ? `${format(start, "H")} - ${format(end, "H")}`
                : `${format(start, "p")} - ${format(end, "p")}`,
          }}
          selectable
          popup={!isMobile}
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
            return {
              className: getDayClassName(date, currentDate),
            };
          }}
          components={{
            toolbar: () => (
              <CustomToolbar
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                view={view}
                setView={setView}
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
            className: getEventClassName(event, isMobile, view),
          })}
        />
      </div>

      <MobileTaskSection
        currentDate={currentDate}
        tasks={tasksForSelectedDay}
        onSelectTask={(task) => openPopup(task, PopupModes.View)}
        setDraggedEvent={setDraggedEvent}
      />
    </div>
  );
}
