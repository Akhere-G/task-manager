export interface Task {
  id: number;
  title: string;
  description: string;
  category: string;
  isCompleted: boolean;     
  dueDate: string;         
  estimatedTime: number;   
  createdAt: string;       
}

export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'isCompleted'>;