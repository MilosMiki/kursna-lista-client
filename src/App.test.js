import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders the phone number as a callable tel link", () => {
  render(<App />);

  const phoneLink = screen.getByRole("link", { name: /021\/521-421/i });
  expect(phoneLink).toHaveAttribute("href", "tel:+38121521421");
});

test("opens an in-app route map when the map button is clicked", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /prikaži na mapi/i }));

  expect(screen.getByTestId("route-map")).toBeInTheDocument();
});
