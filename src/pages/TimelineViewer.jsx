import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/timeline" element={<TimelineViewer />} />
      </Routes>
    </Router>
  );
}

export default App;
