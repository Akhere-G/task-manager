import apiClient from "../../services/api";
import type { Task } from "../tasks/types";
import type { BoardMoveInput, ColumnInput, ProjectColumn } from "./types";

export type BoardMoveResult = Task | { id: number; deleted: true };

export const columnService = {
  getAll: async (projectId: number): Promise<ProjectColumn[]> => {
    const response = await apiClient.get<{ columns: ProjectColumn[] }>(
      `/projects/${projectId}/columns`,
    );
    return response.data.columns;
  },
  create: async (
    projectId: number,
    input: ColumnInput,
  ): Promise<ProjectColumn> => {
    const response = await apiClient.post<ProjectColumn>(
      `/projects/${projectId}/columns`,
      input,
    );
    return response.data;
  },
  update: async (
    id: number,
    input: Partial<ColumnInput>,
  ): Promise<ProjectColumn> => {
    const response = await apiClient.patch<ProjectColumn>(
      `/columns/${id}`,
      input,
    );
    return response.data;
  },
  reorder: async (
    projectId: number,
    columnIds: number[],
  ): Promise<ProjectColumn[]> => {
    const response = await apiClient.put<{ columns: ProjectColumn[] }>(
      `/projects/${projectId}/columns/order`,
      { columnIds },
    );
    return response.data.columns;
  },
  delete: async (id: number, moveToId: number | null) => {
    await apiClient.delete(`/columns/${id}`, { data: { moveToId } });
  },
  moveTask: async (
    taskId: number,
    input: BoardMoveInput,
  ): Promise<BoardMoveResult> => {
    const response = await apiClient.post<BoardMoveResult>(
      `/tasks/${taskId}/board-move`,
      input,
    );
    return response.data;
  },
};
