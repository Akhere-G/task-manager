import { useMutation, useQueryClient } from "@tanstack/react-query";
import { columnService } from "../api";
import type { ColumnInput, ProjectColumn } from "../types";
import { columnsKey } from "./useColumns";

export function useCreateColumn(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ColumnInput) => columnService.create(projectId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: columnsKey(projectId) }),
  });
}

export function useUpdateColumn(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ColumnInput> }) =>
      columnService.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: columnsKey(projectId) }),
  });
}

export function useDeleteColumn(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, moveToId }: { id: number; moveToId: number | null }) =>
      columnService.delete(id, moveToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: columnsKey(projectId) });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useReorderColumns(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnIds: number[]) =>
      columnService.reorder(projectId, columnIds),
    onMutate: (columnIds) => {
      const key = columnsKey(projectId);
      const before = queryClient.getQueryData<ProjectColumn[]>(key);
      queryClient.setQueryData<ProjectColumn[]>(
        key,
        (columns) =>
          columns &&
          columnIds.flatMap((id) =>
            columns.filter((column) => column.id === id),
          ),
      );
      return { before };
    },
    onError: (_error, _ids, context) =>
      queryClient.setQueryData(columnsKey(projectId), context?.before),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: columnsKey(projectId) }),
  });
}
