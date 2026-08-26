import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SplitPanel } from "../src/components/SplitPanel";

const VALID_RECIPIENT = "GA7QYNF7SOWQXGLAV2CYQ5VGVPTJHAFKD7LYLQEMNXOCE2ZNO4BCTLDZ";

function renderPanel(onSettle = vi.fn()) {
  return render(
    <SplitPanel balanceXlm="100" locked={false} onSettle={onSettle} />,
  );
}

describe("SplitPanel", () => {
  it("shows the exact computed share in the summary", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Total expense/i), {
      target: { value: "10" },
    });
    const summary = screen.getByText(/Each person pays/).closest(".summary");
    expect(summary?.textContent).toContain("2.5 XLM");
  });

  it("keeps the settle button disabled until inputs are valid", () => {
    renderPanel();
    const button = screen.getByRole("button", {
      name: /Settle my share/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Total expense/i), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText(/Recipient of this share/i), {
      target: { value: VALID_RECIPIENT },
    });
    expect(button.disabled).toBe(false);
  });

  it("forwards recipient and exact share on submit", () => {
    const onSettle = vi.fn();
    renderPanel(onSettle);
    fireEvent.change(screen.getByLabelText(/Total expense/i), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText(/Recipient of this share/i), {
      target: { value: VALID_RECIPIENT },
    });
    fireEvent.click(screen.getByRole("button", { name: /Settle my share/i }));
    expect(onSettle).toHaveBeenCalledWith(VALID_RECIPIENT, "2.25", "9", 4);
  });

  it("surfaces a validation message for an invalid recipient after interaction", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText(/Total expense/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/Recipient of this share/i), {
      target: { value: "nope" },
    });
    expect(screen.getByText(/starts with G/)).toBeTruthy();
  });

  it("disables settlement entirely while locked", () => {
    render(
      <SplitPanel balanceXlm="100" locked onSettle={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText(/Total expense/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/Recipient of this share/i), {
      target: { value: VALID_RECIPIENT },
    });
    const button = screen.getByRole("button", {
      name: /Settle my share/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Connect Freighter on Testnet/)).toBeTruthy();
  });
});
