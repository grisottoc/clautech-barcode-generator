import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Declare the preload API type for TS in renderer
// declare global {
//   interface Window {
//     api: {
//       ping: () => Promise<string>;
//     };
//   }
// }

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
