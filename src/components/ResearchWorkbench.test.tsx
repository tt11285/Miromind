import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchWorkbench } from "./ResearchWorkbench";

describe("ResearchWorkbench", () => {
  it("renders the golden path memo and trace controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in this component test");
      })
    );

    render(<ResearchWorkbench />);

    expect(await screen.findByText("ValuationLens")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA")).toBeInTheDocument();
    expect(screen.getByText("Partially Supported")).toBeInTheDocument();
    expect(screen.getByText("Hypothesis Tree")).toBeInTheDocument();
    expect(screen.getByText("Evidence Cards")).toBeInTheDocument();
  });
});
