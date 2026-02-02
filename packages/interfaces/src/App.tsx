import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Web3Provider } from "./providers/Web3Provider";
import { Home, Gallery, Mint } from "./pages";

export function App() {
  return (
    <Web3Provider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/mint" element={<Mint />} />
        </Routes>
      </BrowserRouter>
    </Web3Provider>
  );
}

export default App;
