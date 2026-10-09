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
  lat: 45.25508,
  lng: 19.84594,
};

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

function FitRouteToMap({ routeCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!routeCoords || routeCoords.length === 0) {
      map.setView([exchangeOffice.lat, exchangeOffice.lng], 15);
      return;
    }

    const bounds = L.latLngBounds(routeCoords);
    map.fitBounds(bounds.pad(0.2));
  }, [map, routeCoords]);

  return null;
}

function RouteMap({ userPosition, onClose }) {
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    if (!userPosition) {
      setRouteCoords([]);
      setRouteError(
        "Lokacija nije dostupna, pa se prikazuje lokacija kancelarije bez rute.",
      );
      return;
    }

    const buildRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userPosition[1]},${userPosition[0]};${exchangeOffice.lng},${exchangeOffice.lat}?overview=full&geometries=geojson`,
        );

        if (!response.ok) {
          throw new Error("Route request failed");
        }

        const data = await response.json();
        const geometry = data?.routes?.[0]?.geometry?.coordinates ?? [];

        if (geometry.length === 0) {
          throw new Error("No route found");
        }

        const points = geometry.map(([lng, lat]) => [lat, lng]);
        setRouteCoords(points);
        setRouteError("");
      } catch (error) {
        setRouteCoords([]);
        setRouteError(
          "Ruta nije mogla da se prikaže, ali kancelarija je i dalje prikazana na mapi.",
        );
      }
    };

    buildRoute();
  }, [userPosition]);

  const center = userPosition
    ? [userPosition[0], userPosition[1]]
    : [exchangeOffice.lat, exchangeOffice.lng];
  const mapKey = userPosition
    ? `user-location-${userPosition[0].toFixed(5)}-${userPosition[1].toFixed(5)}`
    : "office-only-location";

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
            key={mapKey}
            center={center}
            zoom={15}
            scrollWheelZoom
            className="route-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

        {routeError && <div className="route-map-status">{routeError}</div>}
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
    setUserPosition(null);

    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition([coords.latitude, coords.longitude]);
      },
      () => {
        setUserPosition(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
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
              <p>{exchangeOffice.address}</p>
              <button
                type="button"
                className="address-link"
                onClick={showDirectionsMap}
              >
                Prikaži na mapi
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
