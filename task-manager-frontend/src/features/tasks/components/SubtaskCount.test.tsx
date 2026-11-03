import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubtaskCount from "./SubtaskCount";

describe("SubtaskCount", () => {
  it("shows done out of total", () => {
    render(<SubtaskCount done={2} total={5} />);

    expect(screen.getByText("2/5")).toBeInTheDocument();
  });

  it("shows nothing for a task without subtasks", () => {
    const { container } = render(<SubtaskCount done={0} total={0} />);

    expect(container).toBeEmptyDOMElement();
  });
});
