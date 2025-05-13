import axios from "axios";

const API_BASE_URL =
  "https://n5j8y8gjci.execute-api.eu-central-1.amazonaws.com/prod/products";

export const getAllProducts = async () => {
  const response = await axios.get(API_BASE_URL);
  return response.data;
};

export const getProductById = async (productId) => {
  const response = await axios.get(`${API_BASE_URL}/${productId}`);
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await axios.post(API_BASE_URL, productData);
  return response.data;
};
