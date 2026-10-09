import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
// import currencyToCountryCode from "./currencyFlags";
// import Flag from './Flag';
import { currencyToCountry } from "./currencyToCountry";
import ReactCountryFlag from "react-country-flag";
import "./App.css";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_ID,
  measurementId: process.env.REACT_APP_MEASURMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const exchangeOffice = {
  address: "Bulevar Oslobođenja 109, Novi Sad",
  lat: 45.25508,
  lng: 19.84594,
};

function App() {
  const [data, setData] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [mapUrl] = useState(
    "https://www.openstreetmap.org/export/embed.html?bbox=19.83%2C45.24%2C19.86%2C45.27&layer=mapnik&marker=45.25508%2C19.84594",
  );

  const showDirectionsMap = () => {
    setShowMap(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      const docRef = doc(db, "kursna-lista", "json");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
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
      {/* Header */}
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
        <div className="map-modal-backdrop" onClick={() => setShowMap(false)}>
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
                onClick={() => setShowMap(false)}
                aria-label="Zatvori mapu"
              >
                ×
              </button>
            </div>
            <iframe
              title="Mapa do Menjačnice Sedmica MMS"
              src={mapUrl}
              className="map-iframe"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      )}

      {/* Body */}
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
