import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the phone number as a callable tel link", () => {
  render(<App />);

  const phoneLink = screen.getByRole("link", { name: /021\/521-421/i });
  expect(phoneLink).toHaveAttribute("href", "tel:+38121521421");
});
