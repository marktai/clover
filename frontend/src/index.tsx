import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.css'
import './index.css';
import List from './pages/list';
import Clues from './pages/clues';
import Guess from './pages/guess';
import Daily from './pages/daily';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
      integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3"
      crossOrigin="anonymous"
    />
    <BrowserRouter>
      <Link to="/">All games</Link>
      <Routes>
        <Route index element={<List adult={false}/>} />
        <Route path="/adult" element={<List adult={true}/>} />
        <Route path="/games/:id/clues" element={<Clues />} />
        <Route path="/games/:id/guess" element={<Guess />} />
        <Route path="/games/new_daily" element={<Daily />} />
        <Route path="/daily" element={<Daily />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
