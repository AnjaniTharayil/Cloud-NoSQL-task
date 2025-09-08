

import React, { useState } from 'react';
import { Upload, Button, message, Card } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const REACT_APP_IMPORT_API_URL =
    "https://hhxzauzopb.execute-api.eu-central-1.amazonaws.com/prod/import";
const ImportFileComponent = () => {
const [file, setFile] = useState(null); // State for selected file
const [loading, setLoading] = useState(false); // Loading state

const handleFileChange = (info) => {
console.log('File change event:', info);
if (info.file.status === 'removed') {
setFile(null);
message.info('File removed.');
return;
}

const selectedFile = info.file;
console.log(selectedFile);

if (selectedFile) {
setFile(selectedFile);
console.log('File selected:', selectedFile);
message.success(`File selected: ${selectedFile.name}`);
} else {
message.error('Error selecting file. Please try again.');
}
};

const handleFileUpload = async () => {
console.log('Upload button clicked. File:', file);
if (!file) {
message.error('Please select a file before uploading.');
return;
}

setLoading(true);
try {
console.log('Requesting signed URL...');
const response = await axios.get(`${REACT_APP_IMPORT_API_URL}/import`, {
params: { name: file.name },
});

console.log('Received Signed URL response:', response.data);
const { url } = response.data;

if (!url) {
throw new Error('Failed to get signed URL.');
}

console.log('Uploading file to S3...');
await axios.put(url, file, {
headers: {
    'Content-Type': 'text/csv',
},
});

message.success('File uploaded successfully!');

} catch (error) {
console.error('Error during file upload:', error);
message.error(
`Upload failed: ${
    error.response?.data?.message || error.message || 'Unknown error'
}`
);
} finally {
setLoading(false);
}
};

return (
<div style={{ maxWidth: '600px', margin: '50px auto' }}>
<Card title="Import File" bordered>
<Upload
    beforeUpload={() => false} // Prevent auto upload
    onChange={handleFileChange} // Handle file changes
    onRemove={() => setFile(null)} // Clear file from state
    maxCount={1} // Allow only one file
>
    <Button icon={<UploadOutlined />}>Select File</Button>
</Upload>

<Button
    type="primary"
    onClick={handleFileUpload} // Upload file on click
    loading={loading}
    style={{ marginTop: '10px' }}
    disabled={!file} // Disable button if no file is selected
>
    Upload
</Button>
</Card>
</div>
);
};

export default ImportFileComponent;