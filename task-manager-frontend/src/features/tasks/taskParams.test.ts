import { describe, expect, it } from "vitest";

import {
  CATEGORY_PAGE_SIZE,
  buildCategoryFilter,
  buildCategoryParams,
  type CategoryQuery,
  type TaskFilters,
} from "./taskParams";

const filters: TaskFilters = {
  search: "",
  project: "3",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "false",
  sortBy: "start_at",
  order: "asc",
  currentDate: "2026-03-11T00:00:00Z",
};

const overdueGroup: CategoryQuery = {
  filters,
  search: "report",
  view: "all",
  overrides: { isCompleted: "" },
  params: { group: "overdue" },
};

describe("buildCategoryParams", () => {
  it("pages the category ten at a time with the category's own params", () => {
    const params = buildCategoryParams(overdueGroup, 2);

    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe(String(CATEGORY_PAGE_SIZE));
    expect(params.get("group")).toBe("overdue");
    expect(params.get("project")).toBe("3");
    expect(params.get("q")).toBe("report");
    expect(params.get("zone")).toBeTruthy();
  });

  it("lets an override remove a page-level filter", () => {
    expect(buildCategoryParams(overdueGroup, 1).has("is_completed")).toBe(
      false,
    );
  });
});

describe("buildCategoryFilter", () => {
  it("keeps what defines the category and drops paging and sorting", () => {
    const filter = buildCategoryFilter(overdueGroup);

    expect(filter).toMatchObject({
      group: "overdue",
      project: "3",
      q: "report",
    });
    for (const name of [
      "page",
      "limit",
      "sort_by",
      "order",
      "project_repeating",
    ]) {
      expect(filter).not.toHaveProperty(name);
    }
  });
});
