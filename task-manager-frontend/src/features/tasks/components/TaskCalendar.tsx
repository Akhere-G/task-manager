import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useEffect, useState } from 'react'
import type {  Task } from '../types';
import {  Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';
import interactionPlugin from '@fullcalendar/interaction';
import { useTaskContext } from '../../../context/TaskContext';

interface CalendarProps {
  tasks: Task[]
  handleConfirmDelete: (task: Task) => void;
  handleConfirmEdit: (task: Task) => void
  updateTask: (id: number, task: Partial<Task>) => Promise<void>;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>,
}
interface Info {
    event: { id: string; startStr: string };
    revert: () => void;
}

function TaskCalendar({ 
  tasks,
  handleConfirmDelete,
  handleConfirmEdit, 
  updateTask,
  setIsCompleted
}: CalendarProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [allTasks, setAllTasks] = useState(tasks)

  useEffect(() => {
    setAllTasks(tasks)
  }, [tasks])
  
  const events = allTasks.map(task => ({ title: task.title, date: formatDate(task.dueDate), id: String(task.id), extendedProps: task }))

  async function handleEventDrop(info: Info) {
    const { event } = info;

    const dueDate = event.startStr; 
    const taskId = Number(event.id);

    try {
      setAllTasks(prev => prev.map(t => t.id === taskId ? ({...t, dueDate }) : t))
      await updateTask(taskId, { dueDate })
    } catch (err) {
      console.log(err)
      info.revert(); 
      alert("Failed to move the task. Please try again.");
    }
}

  return (
    <div className='card'>
    <FullCalendar
      plugins={[ dayGridPlugin, interactionPlugin ]}
      initialView="dayGridMonth"
      events={events}
      editable
      eventDrop={handleEventDrop}
      eventClick={({ event }) => setSelectedTask(event.extendedProps as Task) }
      eventContent={({ event }) => {
        return (
          <div 
            draggable
            className={
              `px-2 py-0.5 rounded text-xs transition-all shadow-sm cursor-pointer active:cursor-grabbing 
              truncate hover:brightness-95
              ${
              event.extendedProps.isCompleted 
                ? 'bg-surface-muted text-text-sub border-l-4 border-surface-muted/90 hover:brightness-125' 
                : 'bg-brand text-text-inverse border-l-4 border-brand/5 hover:brightness-125'
            }`}
          >
          <span className="font-semibold">{event.title}</span>
        </div>
        )
      }}
      />
      {selectedTask && (
        <Popup 
          title="" 
          close={() => setSelectedTask(null)}
          showCloseButton={false}
          sleek
        >
          <TaskCard 
            {...selectedTask} 
            onDelete={task => {
              handleConfirmDelete(task)
              setSelectedTask(null)
            }}
            onEdit={task => {
              handleConfirmEdit(task)
              setSelectedTask(null)
            }} 
            setIsCompleted={id => {
              setIsCompleted(id, !selectedTask.id)
              setSelectedTask(null)
            }}  
          />
        </Popup>
      )}
    </div>
  )
}

export default function TaskCalendarConnected({ tasks } : { tasks: Task[] }){
  const {
    handleConfirmDelete,
    handleConfirmEdit,
    setIsCompleted,
    updateTask
  } = useTaskContext()

  return (
    <TaskCalendar
      tasks={tasks}
      handleConfirmDelete={handleConfirmDelete}
      handleConfirmEdit={handleConfirmEdit}
      setIsCompleted={setIsCompleted}
      updateTask={updateTask} 
    />
  )
}