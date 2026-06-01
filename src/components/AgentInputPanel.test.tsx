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

  it("shows a plain running button state and a compact research question box", () => {
    render(
      <AgentInputPanel
        isRunning={true}
        modeLabel="Live Agent"
        onRun={vi.fn()}
      />
    );

    const button = screen.getByRole("button", { name: "Running Research" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveClass("launching");
    expect(screen.getByLabelText("Research question")).toHaveClass(
      "research-question-input"
    );
  });

  it("offers the approved demo security quick chips without Apple", () => {
    render(<AgentInputPanel isRunning={false} modeLabel="Demo Fallback" onRun={vi.fn()} />);

    expect(screen.getByRole("button", { name: "NVIDIA / NVDA" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Microsoft / MSFT" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Micron / MU" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tesla / TSLA" })).toBeInTheDocument();
    expect(screen.queryByText(/Apple/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Research depth")).not.toBeInTheDocument();
  });

  it("fills the research question from company-specific suggestions", () => {
    render(<AgentInputPanel isRunning={false} modeLabel="Live Agent" onRun={vi.fn()} />);

    expect(screen.queryByLabelText("Suggested questions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Micron / MU" }));
    const suggestions = screen.getByLabelText("Suggested questions");
    fireEvent.change(suggestions, {
      target: {
        value: "Is Micron's valuation justified by HBM-driven AI memory demand?"
      }
    });

    expect(screen.getByLabelText("Research question")).toHaveValue(
      "Is Micron's valuation justified by HBM-driven AI memory demand?"
    );

    fireEvent.click(screen.getByRole("button", { name: "Tesla / TSLA" }));
    expect(screen.getByLabelText("Suggested questions")).toHaveDisplayValue(
      "Choose a suggested question"
    );
    expect(
      screen.getByRole("option", {
        name: "Is Tesla's valuation justified by autonomous driving and robotaxi optionality?"
      })
    ).toBeInTheDocument();
  });
});
