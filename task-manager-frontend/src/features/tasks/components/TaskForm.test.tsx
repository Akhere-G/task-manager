import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTask, renderWithProviders } from "../../../test/render";
import TaskForm from "./TaskForm";
import { mockApi } from "../../../test/api";

const mock = mockApi();
const projects = [
  { id: 1, name: "Work", colour: "#6366f1", parentId: null, position: 0 },
  { id: 2, name: "Reports", colour: "#0ea5e9", parentId: 1, position: 0 },
  { id: 3, name: "Home", colour: "#8b5cf6", parentId: null, position: 1 },
];

const labels = [
  { id: 1, name: "urgent", colour: "#ef4444" },
  { id: 2, name: "later", colour: "#22c55e" },
];

const submit = vi.fn();

beforeEach(() => {
  mock.onGet("/projects").reply(200, { projects });
  mock.onGet("/labels").reply(200, { labels });
  submit.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function badRequest(status: number, data: unknown) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

const projectBox = () => screen.findByRole("combobox", { name: /Project/ });

async function pickProject(name: string) {
  await userEvent.click(await projectBox());
  await userEvent.click(await screen.findByRole("option", { name }));
}

async function fillValidTask() {
  await userEvent.type(screen.getByLabelText("Title"), "Write report");
  await pickProject("Work");
  fireEvent.change(screen.getByLabelText("Start At"), {
    target: { value: "2026-03-02T09:00" },
  });
  fireEvent.change(screen.getByLabelText("End At"), {
    target: { value: "2026-03-02T10:00" },
  });
}

const addButton = () => screen.getByRole("button", { name: "Add Task" });

describe("TaskForm", () => {
  it("sends no dates when the task has none", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await userEvent.type(screen.getByLabelText("Title"), "Call the dentist");
    await userEvent.click(screen.getByRole("switch", { name: "Add dates" }));
    expect(screen.queryByLabelText("Start At")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Repeat task" }),
    ).not.toBeInTheDocument();
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      title: "Call the dentist",
      startAt: null,
      endAt: null,
      isRepeating: false,
    });
  });

  it("opens an undated task without date fields", async () => {
    renderWithProviders(
      <TaskForm
        submitAction={submit}
        confirmButtonText="Save"
        initialData={makeTask({ startAt: null, endAt: null })}
      />,
    );

    expect(
      await screen.findByRole("switch", { name: "Add dates" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByLabelText("Start At")).not.toBeInTheDocument();
  });

  it("submits the chosen labels", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await fillValidTask();
    await userEvent.click(await screen.findByRole("button", { name: "later" }));
    await userEvent.click(screen.getByRole("button", { name: "urgent" }));
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].labelIds).toEqual([2, 1]);
  });

  it("submits the 30 minute reminder by default and any added ones", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await fillValidTask();
    await userEvent.click(
      await screen.findByRole("button", { name: "1 hour before" }),
    );
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(
      submit.mock.calls[0][0].reminders.map(
        (r: { minutesBefore: number }) => r.minutesBefore,
      ),
    ).toEqual([30, 60]);
  });

  it("starts with the labels of the task being edited", async () => {
    renderWithProviders(
      <TaskForm
        submitAction={submit}
        confirmButtonText="Save"
        initialData={makeTask({ labelIds: [2] })}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "later" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("submits what the user entered", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await fillValidTask();
    await userEvent.type(
      screen.getByLabelText("Description"),
      "Quarterly numbers",
    );
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      title: "Write report",
      projectId: 1,
      description: "Quarterly numbers",
      startAt: "2026-03-02T09:00",
      endAt: "2026-03-02T10:00",
      isRepeating: false,
      repeatUntil: null,
    });
  });

  it("submits P4 unless a priority is chosen, and the chosen one as a number", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    await userEvent.click(addButton());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].priority).toBe(4);

    await userEvent.click(
      screen.getByRole("button", { name: "Priority P1, Urgent" }),
    );
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    expect(submit.mock.calls[1][0].priority).toBe(1);
  });

  it("starts from the task's own priority when editing", () => {
    renderWithProviders(
      <TaskForm
        submitAction={submit}
        initialData={makeTask({ priority: 2 })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Priority P2, High" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("explains a missing title once the field has been left", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await userEvent.type(screen.getByLabelText("Title"), "x");
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.tab();

    expect(await screen.findByText("Title is mandatory.")).toBeInTheDocument();
  });

  it("does not submit while a field is invalid", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    fireEvent.change(screen.getByLabelText("End At"), {
      target: { value: "2026-03-02T08:00" },
    });

    await userEvent.click(addButton());

    expect(
      await screen.findByText("End At must be after start at."),
    ).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("moves the end time along with the start time, keeping the duration", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    fireEvent.change(screen.getByLabelText("Start At"), {
      target: { value: "2026-03-05T14:00" },
    });

    expect(screen.getByLabelText("End At")).toHaveValue("2026-03-05T15:00");
  });

  it("offers repeat options only for repeating tasks and sends them", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    expect(screen.queryByLabelText("Frequency")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Repeat task" }));
    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "weekly");
    fireEvent.change(screen.getByLabelText("Repeat Until"), {
      target: { value: "2026-06-01" },
    });
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({
      isRepeating: true,
      repeatBy: "weekly",
      repeatDays: [0],
      repeatUntil: "2026-06-01",
    });
  });

  it("drops the repeat settings again when repeating is switched off", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    await userEvent.click(screen.getByRole("switch", { name: "Repeat task" }));
    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "daily");

    await userEvent.click(screen.getByRole("switch", { name: "Repeat task" }));
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({
      isRepeating: false,
      repeatBy: null,
    });
  });

  it("shows the field errors the server reports", async () => {
    submit.mockRejectedValue(
      badRequest(400, { errors: { title: "Title is mandatory." } }),
    );
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.click(addButton());

    expect(await screen.findByText("Title is mandatory.")).toBeInTheDocument();
  });

  it("shows a general message for any other failure and lets the user retry", async () => {
    submit
      .mockRejectedValueOnce(badRequest(500, {}))
      .mockResolvedValueOnce(undefined);
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.click(addButton());
    expect(await screen.findByText("Could not send data")).toBeInTheDocument();

    await userEvent.click(addButton());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  });

  it("drops the server's earlier field errors when the next attempt fails differently", async () => {
    submit
      .mockRejectedValueOnce(
        badRequest(400, { errors: { title: "Title is mandatory." } }),
      )
      .mockRejectedValueOnce(badRequest(500, {}));
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.click(addButton());
    expect(await screen.findByText("Title is mandatory.")).toBeInTheDocument();
    await userEvent.click(addButton());

    expect(await screen.findByText("Could not send data")).toBeInTheDocument();
    expect(screen.queryByText("Title is mandatory.")).not.toBeInTheDocument();
  });

  it("pre-fills an existing task for editing", async () => {
    const task = makeTask({
      title: "Existing",
      description: "Notes",
      projectId: 3,
    });
    renderWithProviders(
      <TaskForm
        submitAction={submit}
        initialData={task}
        confirmButtonText="Save"
      />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    await waitFor(async () => expect(await projectBox()).toHaveValue("Home"));
    expect(screen.getByLabelText("Description")).toHaveValue("Notes");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("hides the dates when editing a ghost so the series keeps its own", async () => {
    const ghost = makeTask({ isGhost: true, seriesId: 1, title: "Standup" });
    renderWithProviders(<TaskForm submitAction={submit} initialData={ghost} />);

    expect(screen.queryByLabelText("Start At")).not.toBeInTheDocument();
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ startAt: "", endAt: "" });
  });

  it("refuses to submit a completely empty form", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await userEvent.click(addButton());

    expect(await screen.findByText("Title is mandatory.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("lists sub-projects by their path and sends no project for the Inbox", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await userEvent.click(await projectBox());
    const names = (await screen.findAllByRole("option")).map(
      (option) => option.textContent,
    );
    expect(names).toEqual(["Work", "Work / Reports", "Home"]);

    await fillValidTask();
    await userEvent.clear(await projectBox());
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].projectId).toBeNull();
    expect(submit.mock.calls[0][0].projectName).toBeFalsy();
  });

  it("sends a typed project that doesn't exist as a name to create", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.clear(await projectBox());
    await userEvent.type(await projectBox(), "Garden / Beds");
    expect(
      await screen.findByRole("option", { name: "Create “Garden / Beds”" }),
    ).toBeInTheDocument();
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      projectId: null,
      projectName: "Garden / Beds",
    });
  });

  it("treats a typed name that matches a project as that project", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.clear(await projectBox());
    await userEvent.type(await projectBox(), "work / reports");
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].projectId).toBe(2);
    expect(submit.mock.calls[0][0].projectName).toBeFalsy();
  });

  it("sends typed labels to create and selects typed names that already exist", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    await screen.findByRole("button", { name: "urgent" });

    const input = screen.getByLabelText("New label");
    await userEvent.type(input, "errand{Enter}");
    await userEvent.type(input, "LATER{Enter}");
    await userEvent.type(input, "Errand{Enter}");

    expect(
      screen.getByRole("button", { name: "Remove new label: errand" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "later" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      labelIds: [2],
      labelNames: ["errand"],
    });
  });

  it("lets a new label be removed again before saving", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.type(screen.getByLabelText("New label"), "errand{Enter}");
    await userEvent.click(
      screen.getByRole("button", { name: "Remove new label: errand" }),
    );
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0].labelNames).toEqual([]);
  });
});
