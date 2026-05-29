import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("resets selected trace state when API failure falls back to fixtures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in this component test");
      })
    );

    render(<ResearchWorkbench />);

    fireEvent.change(screen.getByLabelText("Research Question"), {
      target: { value: "downside-risk" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));

    expect(
      await screen.findByText("What is the most material downside risk over the next 12 months?")
    ).toBeInTheDocument();

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    await waitFor(() => {
      expect(
        within(evidencePanel).getByRole("heading", { name: "Demand Risk" })
      ).toBeInTheDocument();
    });
    expect(
      within(evidencePanel).queryByRole("heading", { name: "Demand Sustainability" })
    ).not.toBeInTheDocument();
  });

  it("selects linked evidence when a memo trace button is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network disabled in this component test");
      })
    );

    render(<ResearchWorkbench />);

    const evidencePanel = screen.getByRole("region", { name: "Evidence cards" });
    expect(
      within(evidencePanel).getByRole("heading", { name: "Revenue Growth" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Demand Sustainability scores/ }));

    expect(
      within(evidencePanel).getByRole("heading", { name: "Demand Sustainability" })
    ).toBeInTheDocument();
    expect(within(evidencePanel).getAllByRole("article")).toHaveLength(2);
  });
});
