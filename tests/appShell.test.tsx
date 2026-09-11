import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("Splash application shell", () => {
  it("has a single descriptive page heading and navigable sections", () => {
    render(<App />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Choose your wallet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Settlement workspace" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Live contract activity" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Skip to workspace" }).getAttribute("href")).toBe("#workspace");
  });

  it("exposes all required wallets with accessible names", () => {
    render(<App />);
    for (const name of ["Freighter", "Albedo", "xBull", "Rabet", "LOBSTR"]) {
      expect(screen.getByRole("button", { name: new RegExp(name, "i") })).toBeTruthy();
    }
  });

  it("clearly identifies Testnet and the disconnected empty state", () => {
    render(<App />);
    expect(screen.getByText("STELLAR TESTNET")).toBeTruthy();
    expect(screen.getByText("Connect to enter the workspace")).toBeTruthy();
    expect(screen.getByText(/surface is calm/i)).toBeTruthy();
  });
});
