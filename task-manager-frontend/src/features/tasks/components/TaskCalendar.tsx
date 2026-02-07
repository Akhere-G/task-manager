import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid' 
import { useState } from 'react'
import type { Task } from '../types';
import {  Popup } from '../../../components/ui';
import { formatDate } from '../utils';
import TaskCard from './TaskCard';

interface CalendarProps {
  tasks: Task[]
  handleConfirmDelete: (id: number) => void;
  handleConfirmEdit: (id: number) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>,
}

export default function TaskCalendar({ 
  handleConfirmDelete, 
  handleConfirmEdit,
  setIsCompleted,
  tasks
}: CalendarProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  function selectTask(id: string){
    if (!tasks) return
    
    const selectedTask = tasks.find(task => task.id === Number(id))
    if (selectedTask)
      setSelectedTaskId(selectedTask.id)
  }

  const events = tasks.map(task => ({ title: task.title, date: formatDate(task.dueDate), id: String(task.id) }))

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

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
          close={() => setSelectedTaskId(null)}
          showCloseButton={false}
          sleek
        >
          <TaskCard 
            {...selectedTask} 
            onDelete={id => {
              handleConfirmDelete(id)
              setSelectedTaskId(null)
            }} 
            onEdit={handleConfirmEdit}
            setIsCompleted={(id, isCompleted) => {
              setIsCompleted(id, isCompleted);
            }}
          />
        </Popup>
      )}
    </div>
  )
}