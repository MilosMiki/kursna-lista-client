// components/Flag.js
export default function Flag({ countryCode }) {
  return (
    <img
      src={`/flags/${countryCode}.png`}
      alt={`${countryCode} flag`}
      className="flag"
    />
  );
}