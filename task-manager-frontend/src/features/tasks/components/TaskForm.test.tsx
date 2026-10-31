import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTask, renderWithProviders } from "../../../test/render";
import TaskForm from "./TaskForm";

const submit = vi.fn();

beforeEach(() => {
  submit.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function badRequest(status: number, data: unknown) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

async function fillValidTask() {
  await userEvent.type(screen.getByLabelText("Title"), "Write report");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "work");
  fireEvent.change(screen.getByLabelText("Start At"), { target: { value: "2026-03-02T09:00" } });
  fireEvent.change(screen.getByLabelText("End At"), { target: { value: "2026-03-02T10:00" } });
}

const addButton = () => screen.getByRole("button", { name: "Add Task" });

describe("TaskForm", () => {
  it("submits what the user entered", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await fillValidTask();
    await userEvent.type(screen.getByLabelText("Description"), "Quarterly numbers");
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({
      title: "Write report",
      category: "work",
      description: "Quarterly numbers",
      startAt: "2026-03-02T09:00",
      endAt: "2026-03-02T10:00",
      isRepeating: false,
      repeatUntil: null,
    });
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
    fireEvent.change(screen.getByLabelText("End At"), { target: { value: "2026-03-02T08:00" } });

    await userEvent.click(addButton());

    expect(await screen.findByText("End At must be after start at.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("moves the end time along with the start time, keeping the duration", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    fireEvent.change(screen.getByLabelText("Start At"), { target: { value: "2026-03-05T14:00" } });

    expect(screen.getByLabelText("End At")).toHaveValue("2026-03-05T15:00");
  });

  it("offers repeat options only for repeating tasks and sends them", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();
    expect(screen.queryByLabelText("Repeat By")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.selectOptions(screen.getByLabelText("Repeat By"), "weekly");
    fireEvent.change(screen.getByLabelText("Repeat Until"), { target: { value: "2026-06-01" } });
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
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.selectOptions(screen.getByLabelText("Repeat By"), "daily");

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(addButton());

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ isRepeating: false, repeatBy: null });
  });

  it("shows the field errors the server reports", async () => {
    submit.mockRejectedValue(badRequest(400, { errors: { title: "Title is mandatory." } }));
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.click(addButton());

    expect(await screen.findByText("Title is mandatory.")).toBeInTheDocument();
  });

  it("shows a general message for any other failure and lets the user retry", async () => {
    submit.mockRejectedValueOnce(badRequest(500, {})).mockResolvedValueOnce(undefined);
    renderWithProviders(<TaskForm submitAction={submit} />);
    await fillValidTask();

    await userEvent.click(addButton());
    expect(await screen.findByText("Could not send data")).toBeInTheDocument();

    await userEvent.click(addButton());
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  });

  it("pre-fills an existing task for editing", () => {
    const task = makeTask({ title: "Existing", description: "Notes", category: "home" });
    renderWithProviders(
      <TaskForm submitAction={submit} initialData={task} confirmButtonText="Save" />,
    );

    expect(screen.getByLabelText("Title")).toHaveValue("Existing");
    expect(screen.getByLabelText("Category")).toHaveValue("home");
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

  // Known gap: errors are only computed on change, so an untouched form is not checked.
  it.fails("refuses to submit a completely empty form", async () => {
    renderWithProviders(<TaskForm submitAction={submit} />);

    await userEvent.click(addButton());

    expect(submit).not.toHaveBeenCalled();
  });
});
