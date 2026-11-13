import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "../Auth";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    listThreads: vi.fn(),
    getThread: vi.fn(),
    deleteThread: vi.fn(),
    providers: vi.fn(),
    googleLoginUrl: vi.fn(() => "http://localhost:8080/api/auth/google"),
    uploadDocument: vi.fn(),
    listDocuments: vi.fn(),
    deleteDocument: vi.fn()
  }
}));

describe("Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.providers).mockResolvedValue({ google: false });
  });

  it("signs in and passes the user back to the app", async () => {
    const user = { id: "user-1", email: "user@example.com" };
    vi.mocked(api.login).mockResolvedValue(user);
    const onAuth = vi.fn();

    render(<Auth onAuth={onAuth} />);

    await userEvent.type(screen.getByLabelText("Email"), user.email);
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(api.login).toHaveBeenCalledWith(user.email, "password123");
    expect(onAuth).toHaveBeenCalledWith(user);
  });

  it("registers a new account when the register tab is selected", async () => {
    const user = { id: "user-2", email: "new@example.com" };
    vi.mocked(api.register).mockResolvedValue(user);
    const onAuth = vi.fn();

    render(<Auth onAuth={onAuth} />);

    await userEvent.click(screen.getByRole("tab", { name: "Create account" }));
    await userEvent.type(screen.getByLabelText("Email"), user.email);
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(api.register).toHaveBeenCalledWith(user.email, "password123");
    expect(onAuth).toHaveBeenCalledWith(user);
  });

  it("shows the server error message when sign in fails", async () => {
    vi.mocked(api.login).mockRejectedValue(new Error("Invalid email or password"));

    render(<Auth onAuth={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Email"), "user@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("shows the Google button when the backend has OAuth configured", async () => {
    vi.mocked(api.providers).mockResolvedValue({ google: true });

    render(<Auth onAuth={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
  });
});
