import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentInputPanel } from "./AgentInputPanel";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentInputPanel", () => {
  it("requires listed security selection and question before run", async () => {
    const onRun = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          results: [
            {
              name: "NVIDIA Corporation",
              ticker: "NVDA",
              exchange: "NASDAQ",
              country: "US",
              assetType: "Equity"
            }
          ]
        })
      )
    );

    render(<AgentInputPanel isRunning={false} modeLabel="Live Agent" onRun={onRun} />);

    const questionBox = screen.getByLabelText("Research question");
    expect(questionBox).toHaveValue("");
    expect(questionBox).toHaveAttribute(
      "placeholder",
      "Example: Is NVIDIA's current valuation justified by AI growth fundamentals?"
    );
    expect(
      screen.getByText("Select a listed company and enter a research question to run.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Deep Research" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Company or ticker"), {
      target: { value: "nvda" }
    });
    await waitFor(() => expect(screen.getByText("NVIDIA Corporation")).toBeInTheDocument());
    fireEvent.click(screen.getByText("NVIDIA Corporation"));
    expect(screen.getByText("Enter a research question to run.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Deep Research" })).toBeDisabled();

    fireEvent.change(questionBox, {
      target: {
        value: "Is NVIDIA's current valuation justified by AI growth fundamentals?"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Run Deep Research" }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({
        security: expect.objectContaining({ ticker: "NVDA" }),
        researchDepth: "deep"
      })
    );
  });

  it("offers the approved demo security quick chips without Apple", () => {
    render(<AgentInputPanel isRunning={false} modeLabel="Demo Fallback" onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "NVIDIA / NVDA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Microsoft / MSFT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Micron / MU" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tesla / TSLA" })).toBeInTheDocument();
    expect(screen.queryByText(/Apple/i)).not.toBeInTheDocument();
  });
});
