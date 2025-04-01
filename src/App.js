import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import currencyToCountryCode from "./currencyFlags";
import Flag from './Flag';
import "./App.css";

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_ID,
  measurementId: process.env.REACT_APP_MEASURMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function App() {
  const [data, setData] = useState([]);

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
          <img src="/logo.jpeg" alt="Menjačnica Sedmica MMS Logo" className="logo" />
          <div className="header-left">
            <h1>Menjačnica Sedmica MMS</h1>
            <p>Bulevar Oslobođenja 109, Novi Sad</p>
          </div>
        </div>
        <div className="header-right">
          <p>Tel: 021/521-421</p>
        </div>
      </header>
      {/* Body */}
      <div className="box-container">
        {data.map((item, index) => (
          item.Otkup === "" || item.Prodaja === "" ? null : (
            <div key={index} className="box">
              <h2>
                <Flag countryCode={currencyToCountryCode[item.Naziv]} />
                {item.Naziv}
              </h2>
              <p className="label">Otkup:</p>
              <p className="value">{item.Otkup}</p>
              <p className="label">Prodaja:</p>
              <p className="value">{item.Prodaja}</p>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

export default App;