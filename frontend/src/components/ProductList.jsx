import React, { useState, useEffect } from "react";
import { getAllProducts } from "../services/productApi";
import { Link } from "react-router-dom"; // Assuming you're using React Router for navigation

const ProductList = () => {
  const [products, setProducts] = useState([]);

  // Fetch products from the API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getAllProducts();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div>
      <h1>Product List</h1>

      {/* Product List */}
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link to={`/product/${product.id}`}>
            <div> {product.title}</div>
            <div> ${product.price}</div>
            <div> ${product.description}</div>
            </Link>
          </li>
        ))}
      </ul>

      <hr />
    </div>
  );
};

export default ProductList;