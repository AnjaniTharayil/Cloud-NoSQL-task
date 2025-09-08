import axios from "axios";

const REACT_APP_IMPORT_API_URL =
  "https://hhxzauzopb.execute-api.eu-central-1.amazonaws.com/prod/import";

// API helper to upload files
const importFile = async (file) => {
  try {
    // Step 1: Fetch a signed URL from the `/import` REST endpoint
    const signedUrlResponse = await axios.get(
      `${REACT_APP_IMPORT_API_URL}/import`,
      {
        params: {
          name: file.name, // Pass the filename as a query param
        },
      }
    );

    const { url } = signedUrlResponse.data;

    if (!url) {
      throw new Error("Failed to retrieve signed URL");
    }

    // Step 2: Upload file using the Signed URL
    await axios.put(url, file, {
      headers: {
        "Content-Type": "text/csv", // Ensure the file matches the content type
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error in importFile:", error);
    throw error; // Allow the calling function to handle errors
  }
};

export default importFile;
