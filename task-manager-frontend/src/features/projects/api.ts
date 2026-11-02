import apiClient from "../../services/api";
import type { Project, ProjectInput } from "./types";

export const projectService = {
  getAll: async (): Promise<Project[]> => {
    const response = await apiClient.get<{ projects: Project[] }>("/projects");
    return response.data.projects;
  },
  create: async (input: ProjectInput): Promise<Project> => {
    const response = await apiClient.post<Project>("/projects", input);
    return response.data;
  },
  update: async (
    id: number,
    input: Partial<ProjectInput>,
  ): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/projects/${id}`, input);
    return response.data;
  },
  delete: async (id: number) => {
    await apiClient.delete(`/projects/${id}`);
  },
};
