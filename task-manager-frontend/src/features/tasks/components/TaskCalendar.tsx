import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useEffect, useState } from 'react'
import { taskService } from '../../../services/api';
import type { Task } from '../types';
import { EmptyState, ErrorState, LoadingState, Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';

interface CalendarProps {
  tasks: Task[]
  handleConfirmDelete: (id: number) => void;
  handleConfirmEdit: (id: number) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>,
}

export default function Calendar({ 
  handleConfirmDelete, 
  handleConfirmEdit,
  setIsCompleted,
  tasks
}: CalendarProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  function selectTask(id: string){
    if (!tasks) return
    
    const selectedTask = tasks.find(task => task.id === Number(id))
    if (selectedTask)
      setSelectedTask(selectedTask)
  }

  const events = tasks.map(task => ({ title: task.title, date: formatDate(task.dueDate), id: String(task.id) }))

  console.log(events)
  return (
    <div className='card'>
    <FullCalendar
      plugins={[ dayGridPlugin ]}
      initialView="dayGridMonth"
      events={events}
      
      eventContent={({ event }) => {
        return (
          <div 
          className='bg-brand truncate' 
          onClick={() => selectTask(event.id)}
          >
            <b className='truncate'>{event.title}</b>
            <i>{event.start && ""}</i>
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
            onDelete={handleConfirmDelete} 
            onEdit={handleConfirmEdit}
            setIsCompleted={setIsCompleted}
          />
        </Popup>
      )}
    </div>
  )
}

function CalendarTask(){

}