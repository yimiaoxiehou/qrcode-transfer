import * as React from 'react';
import { BrowserRouter as Router, Routes } from 'react-router-dom';
import { Route } from 'react-router';
import Send from './components/Send';
import Receive from './components/Receive';
import Home from './components/Home';
import './App.css';

export default function App() {
  return (
    <div className="App">
      <header className="App-header">
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/send" element={<Send />} />  {/* 添加了前导斜杠 */}
            <Route path="/receive" element={<Receive />} />  {/* 添加了前导斜杠 */}
          </Routes>
        </Router>
      </header>
    </div>
  );
}