import { render, screen } from "@testing-library/react-native";
import Home from "../app/index";

afterEach(() => { jest.restoreAllMocks(); });

it("shows that the API is ready", async () => {
  jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
  await render(<Home />);
  expect(await screen.findByText("API is ready.")).toBeOnTheScreen();
});

it("says when the API cannot be reached", async () => {
  jest.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));
  await render(<Home />);
  expect(await screen.findByText("The API cannot be reached.")).toBeOnTheScreen();
});
