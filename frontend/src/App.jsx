import React from 'react';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProductList from './components/ProductList';
import ProductDetails from './components/ProductDetails';
import ImportFileComponent from './components/fileUpload'; // Adjust the import path as necessary

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImportFileComponent />} />
        {/* <Route path="/product/:id" element={<ProductDetails />} /> */}
      </Routes>
    </Router>
  );
};

export default App;