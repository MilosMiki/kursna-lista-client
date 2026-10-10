jest.mock("leaflet", () => ({
  __esModule: true,
  default: {
    icon: () => ({}),
  },
}));

jest.mock("react-leaflet", () => {
  const React = require("react");

  return {
    __esModule: true,
    MapContainer: ({ children, ...props }) => (
      <div data-testid="mock-map-container" {...props}>
        {children}
      </div>
    ),
    Marker: ({ children }) => <div>{children}</div>,
    Polyline: () => <div />,
    Popup: ({ children }) => <div>{children}</div>,
    TileLayer: () => null,
    useMap: () => ({
      setView: jest.fn(),
      fitBounds: jest.fn(),
    }),
  };
});

const { render, screen } = require("@testing-library/react");
const userEvent = require("@testing-library/user-event").default;
const App = require("./App").default;

test("renders the phone number as a callable tel link", () => {
  render(<App />);

  const phoneLink = screen.getByRole("link", {
    name: /call menjačnica sedmica mms/i,
  });

  expect(phoneLink).toHaveAttribute("href", "tel:+38121521421");
});

test("opens an in-app route map when the map button is clicked", async () => {
  render(<App />);

  await userEvent.click(
    screen.getByRole("button", { name: /prikaži lokaciju na mapi/i }),
  );

  expect(screen.getByTestId("route-map")).toBeInTheDocument();
});
