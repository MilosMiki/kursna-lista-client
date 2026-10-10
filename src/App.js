import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { MapPinned } from "lucide-react";
import { currencyToCountry } from "./currencyToCountry";
import ReactCountryFlag from "react-country-flag";
import "leaflet/dist/leaflet.css";
import "./App.css";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_ID,
  measurementId: process.env.REACT_APP_MEASURMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const exchangeOffice = {
  address: "Bulevar Oslobođenja 109, Novi Sad",
  lat: 45.2476631,
  lng: 19.8398067,
};

const FALLBACK_USER_POSITION = [45.2582, 19.7603];

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") {
    return [];
  }

  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let byte = 0;
    let shift = 0;
    let result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lat / 1e6, lng / 1e6]);
  }

  return coordinates;
}

const defaultMarkerIcon = L.icon({
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userPinIcon = L.icon({
  iconUrl:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="8" fill="#1b8cff" stroke="white" stroke-width="3" />
      </svg>
    `),
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
});

function MapPinLocationIcon() {
  return (
    <MapPinned size={18} className="address-link-icon-svg" aria-hidden="true" />
  );
}

function FitRouteToMap({ routeCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!Array.isArray(routeCoords) || routeCoords.length === 0) {
      map.setView([exchangeOffice.lat, exchangeOffice.lng], 15);
      return;
    }

    const validCoords = routeCoords.filter(
      ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng),
    );

    if (validCoords.length === 0) {
      map.setView([exchangeOffice.lat, exchangeOffice.lng], 15);
      return;
    }

    try {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds.pad(0.2));
    } catch (error) {
      map.setView([exchangeOffice.lat, exchangeOffice.lng], 15);
    }
  }, [map, routeCoords]);

  return null;
}

const travelModes = [
  { key: "pedestrian", label: "Walk", icon: "🚶" },
  { key: "bicycle", label: "Bike", icon: "🚲" },
  { key: "auto", label: "Car", icon: "🚗" },
];

const osrmProfiles = {
  pedestrian: "foot",
  bicycle: "cycling",
  auto: "driving",
};

async function fetchOSRMRoute(userPosition, mode = "auto") {
  const profile = osrmProfiles[mode] || "driving";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${userPosition[1]},${userPosition[0]};${exchangeOffice.lng},${exchangeOffice.lat}?overview=full&geometries=geojson`;
  console.log("OSRM request", { mode, profile, url });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`OSRM route request failed for ${mode}`);
  }

  const data = await response.json();
  const geometry = data?.routes?.[0]?.geometry?.coordinates ?? [];

  if (!geometry || geometry.length === 0) {
    throw new Error(`OSRM returned no route geometry for ${mode}`);
  }

  const coords = geometry.map(([lng, lat]) => [lat, lng]);
  console.log("OSRM response", {
    mode,
    profile,
    distance: data?.routes?.[0]?.distance,
    duration: data?.routes?.[0]?.duration,
    coordsCount: coords.length,
    firstPoint: coords[0],
    lastPoint: coords[coords.length - 1],
  });

  return coords;
}

async function fetchRouteForMode(userPosition, mode) {
  const payload = {
    locations: [
      { lat: userPosition[0], lon: userPosition[1] },
      { lat: exchangeOffice.lat, lon: exchangeOffice.lng },
    ],
    costing: mode,
    units: "km",
  };

  console.log("Valhalla request", { mode, payload });

  const response = await fetch("https://valhalla1.openstreetmap.de/route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Valhalla request failed for ${mode}`);
  }

  const data = await response.json();
  const summary = data?.trip?.summary ?? null;
  const directCoords = data?.trip?.coordinates ?? [];
  const legShapes = (data?.trip?.legs ?? [])
    .map((leg) => leg?.shape)
    .filter(Boolean);

  let coords = [];

  if (Array.isArray(directCoords) && directCoords.length > 0) {
    coords = directCoords.map(([lon, lat]) => [lat, lon]);
  } else if (legShapes.length > 0) {
    coords = legShapes.flatMap((shape) => decodePolyline(shape));
  }

  const validCoords = coords.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng),
  );

  console.log("Valhalla response", {
    mode,
    summary,
    directCoordsCount: directCoords.length,
    legShapesCount: legShapes.length,
    validCoordsCount: validCoords.length,
    firstPoint: validCoords[0],
    lastPoint: validCoords[validCoords.length - 1],
  });

  if (validCoords.length < 2 || !summary) {
    throw new Error(`Valhalla returned invalid route data for ${mode}`);
  }

  return {
    mode,
    distance: summary.length ?? 0,
    time: summary.time ?? 0,
    coords: validCoords,
  };
}

function RouteMap({ userPosition, onClose }) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeSummaries, setRouteSummaries] = useState({});
  const [routeByMode, setRouteByMode] = useState({});
  const [activeMode, setActiveMode] = useState("pedestrian");

  useEffect(() => {
    if (!userPosition) {
      setRouteCoords([]);
      setRouteSummaries({});
      setRouteByMode({});
      setActiveMode("pedestrian");
      return;
    }

    let isMounted = true;

    const buildRouteFromOSRM = async (mode = "auto") =>
      fetchOSRMRoute(userPosition, mode);

    const buildRouteForMode = async (mode) =>
      fetchRouteForMode(userPosition, mode);

    const buildRoutes = async () => {
      try {
        let nextRouteByMode = {};

        const valhallaResults = await Promise.all(
          travelModes.map(async (modeInfo) => {
            try {
              const data = await buildRouteForMode(modeInfo.key);
              return { ...modeInfo, ...data };
            } catch (error) {
              console.error("Valhalla route error:", error);
              return null;
            }
          }),
        );

        const validValhallaResults = valhallaResults.filter(Boolean);

        validValhallaResults.forEach((result) => {
          if (result.coords && result.coords.length >= 2) {
            nextRouteByMode[result.key] = result.coords;
          }
        });

        if (!isMounted) {
          return;
        }

        setRouteByMode(nextRouteByMode);
        setActiveMode("pedestrian");

        if (nextRouteByMode.pedestrian) {
          setRouteCoords(nextRouteByMode.pedestrian);
        } else {
          const firstRoute = Object.values(nextRouteByMode)[0];
          setRouteCoords(firstRoute || []);
        }

        const nextSummaries = {};

        validValhallaResults.forEach((result) => {
          nextSummaries[result.key] = {
            distance: result.distance,
            time: result.time,
          };
        });

        setRouteSummaries(nextSummaries);

        console.log("Route cache after Valhalla load", {
          nextRouteByMode,
          nextSummaries,
          activeMode: "pedestrian",
        });

        if (Object.keys(nextRouteByMode).length === 0) {
          const osrmFallback = await Promise.all(
            travelModes.map(async (modeInfo) => {
              try {
                const coords = await buildRouteFromOSRM(modeInfo.key);
                return { mode: modeInfo.key, coords };
              } catch (error) {
                console.error(
                  `OSRM fallback route error for ${modeInfo.key}:`,
                  error,
                );
                return null;
              }
            }),
          );

          const validFallbackRoutes = osrmFallback.filter(Boolean);
          const fallbackByMode = validFallbackRoutes.reduce((acc, item) => {
            if (item.coords.length >= 2) {
              acc[item.mode] = item.coords;
            }
            return acc;
          }, {});

          if (Object.keys(fallbackByMode).length > 0) {
            setRouteByMode(fallbackByMode);
            setRouteCoords(
              fallbackByMode.pedestrian ||
                Object.values(fallbackByMode)[0] ||
                [],
            );
          }
        }
      } catch (error) {
        console.error("Route fallback error:", error);
        if (isMounted) {
          setRouteCoords([]);
          setRouteSummaries({});
          setRouteByMode({});
          setActiveMode("pedestrian");
        }
      }
    };

    buildRoutes();

    return () => {
      isMounted = false;
    };
  }, [userPosition]);

  const handleModeChange = async (mode) => {
    setActiveMode(mode);
    console.log("Mode button clicked", {
      mode,
      currentRouteByMode: routeByMode,
    });

    if (routeByMode[mode] && routeByMode[mode].length >= 2) {
      console.log("Using cached route for mode", {
        mode,
        routeLength: routeByMode[mode].length,
      });
      setRouteCoords(routeByMode[mode]);
      return;
    }

    if (!userPosition) {
      return;
    }

    try {
      const result = await fetchRouteForMode(userPosition, mode);

      console.log("Mode switch route result", {
        mode,
        coordsCount: result.coords.length,
        firstPoint: result.coords[0],
        lastPoint: result.coords[result.coords.length - 1],
      });

      if (result.coords.length >= 2) {
        setRouteByMode((prev) => ({ ...prev, [mode]: result.coords }));
        setRouteCoords(result.coords);
      }
    } catch (error) {
      console.error(`Route switch error for ${mode}:`, error);

      try {
        const coords = await fetchOSRMRoute(userPosition, mode);

        if (coords.length >= 2) {
          setRouteByMode((prev) => ({ ...prev, [mode]: coords }));
          setRouteCoords(coords);
        }
      } catch (fallbackError) {
        console.error(
          `Route switch fallback failed for ${mode}:`,
          fallbackError,
        );
      }
    }
  };

  const center = userPosition
    ? [userPosition[0], userPosition[1]]
    : [exchangeOffice.lat, exchangeOffice.lng];

  return (
    <div className="map-modal-backdrop" onClick={onClose}>
      <div
        className="map-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Mapa do Menjačnice Sedmica MMS"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="map-modal-header">
          <button
            type="button"
            className="close-map-button"
            onClick={onClose}
            aria-label="Zatvori mapu"
          >
            ×
          </button>
        </div>

        <div className="route-map-shell" data-testid="route-map">
          <MapContainer
            center={center}
            zoom={15}
            scrollWheelZoom
            className="route-map"
            whenReady={() => {
              console.log("Map ready");
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <FitRouteToMap routeCoords={routeCoords} />

            {userPosition && (
              <Marker position={userPosition} icon={userPinIcon}>
                <Popup>Vaša lokacija</Popup>
              </Marker>
            )}

            <Marker
              position={[exchangeOffice.lat, exchangeOffice.lng]}
              icon={defaultMarkerIcon}
            >
              <Popup>Menjačnica Sedmica MMS</Popup>
            </Marker>

            {routeCoords.length > 1 && (
              <Polyline
                positions={routeCoords}
                color="#0b6db7"
                weight={5}
                opacity={0.9}
              />
            )}
          </MapContainer>
        </div>

        {userPosition && Object.keys(routeSummaries).length > 0 && (
          <div className="travel-summary-bar">
            {travelModes.map((modeInfo) => {
              const summary = routeSummaries[modeInfo.key];

              if (!summary) {
                return null;
              }

              const isActive = activeMode === modeInfo.key;
              const minutes = Math.max(1, Math.round(summary.time / 60));
              const distanceKm =
                summary.distance < 1
                  ? `${Math.round(summary.distance * 1000)} m`
                  : `${summary.distance.toFixed(1)} km`;

              return (
                <button
                  key={modeInfo.key}
                  type="button"
                  className={`travel-mode-card ${isActive ? "is-active" : ""}`}
                  onClick={() => handleModeChange(modeInfo.key)}
                  aria-label={`${modeInfo.label} route details`}
                >
                  <span className="travel-mode-icon" aria-hidden="true">
                    {modeInfo.icon}
                  </span>
                  <span className="travel-mode-time">{minutes} min</span>
                  <span className="travel-mode-distance">{distanceKm}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [data, setData] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [updatedDate, setUpdatedDate] = useState("");
  const [userPosition, setUserPosition] = useState(null);

  const showDirectionsMap = () => {
    setShowMap(true);

    if (navigator && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextPosition = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          console.log("Using browser geolocation", nextPosition);
          setUserPosition(nextPosition);
        },
        () => {
          console.log(
            "Geolocation unavailable; using fallback position",
            FALLBACK_USER_POSITION,
          );
          setUserPosition(FALLBACK_USER_POSITION);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      );
      return;
    }

    console.log(
      "Geolocation API unavailable; using fallback position",
      FALLBACK_USER_POSITION,
    );
    setUserPosition(FALLBACK_USER_POSITION);
  };

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "kursna-lista", "json");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const rawDate = docSnap.data().date || "";
        const formattedDate = rawDate ? rawDate.split(" ")[0] : "";

        setUpdatedDate(formattedDate);

        const jsonData = JSON.parse(docSnap.data().Data);
        setData(jsonData);
      } else {
        console.log("No such document!");
      }
    };

    fetchData();
  }, []);

  return (
    <div className="App">
      <header className="header">
        <div className="logo-title">
          <img
            src="/logo.jpeg"
            alt="Menjačnica Sedmica MMS Logo"
            className="logo"
          />
          <div className="header-left">
            <h1>Menjačnica Sedmica MMS</h1>
            <div className="address-row">
              <p className="address-text">{exchangeOffice.address}</p>
              <button
                type="button"
                className="address-link"
                onClick={showDirectionsMap}
                aria-label="Prikaži lokaciju na mapi"
              >
                <span className="address-link-icon" aria-hidden="true">
                  <MapPinLocationIcon />
                </span>
                <span className="address-link-label">Prikaži na mapi</span>
              </button>
            </div>
          </div>
        </div>
        <div className="header-right">
          <a
            href="tel:+38121521421"
            className="phone-link"
            aria-label="Call Menjačnica Sedmica MMS"
          >
            Tel: 021/521-421
          </a>
        </div>
      </header>

      {showMap && (
        <RouteMap
          userPosition={userPosition}
          onClose={() => setShowMap(false)}
        />
      )}

      {updatedDate && (
        <div className="update-panel" aria-live="polite">
          <span className="info-icon" aria-hidden="true">
            ℹ
          </span>
          <span>Kursna lista ažurirana na dan {updatedDate}</span>
        </div>
      )}

      <div className="box-container">
        {data.map((item, index) =>
          item.Otkup === "" || item.Prodaja === "" ? null : (
            <div key={index} className="box">
              <h2>
                <ReactCountryFlag
                  countryCode={currencyToCountry[item.Naziv]}
                  svg
                  className="box-flag"
                  style={{
                    width: "auto",
                    height: "100%",
                    position: "absolute",
                    left: 0,
                    top: 0,
                  }}
                />
                <div className="item-name">{item.Naziv}</div>
              </h2>
              <p className="label">Otkup:</p>
              <p className="value">{item.Otkup}</p>
              <p className="label">Prodaja:</p>
              <p className="value">{item.Prodaja}</p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default App;
