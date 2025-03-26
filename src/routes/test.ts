import { type Context } from "hono";

/**
 * Test page for image upload functionality.
 * Provides a form to test uploading images with different prefixes.
*/
export function testPage(c: Context) {
    return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Image Upload Test</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input[type="text"], input[type="file"] {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                button {
                    background-color: #4CAF50;
                    color: white;
                    padding: 10px 15px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                #result {
                    margin-top: 20px;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    white-space: pre-wrap;
                }
                .error {
                    color: red;
                    margin-top: 10px;
                }
            </style>
        </head>
        <body>
            <h1>Image Upload Test</h1>
            <form id="uploadForm">
                <div class="form-group">
                    <label for="prefix">Prefix (e.g., dog-breeder, real-estate):</label>
                    <input type="text" id="prefix" name="prefix" 
                           placeholder="Enter prefix (alphanumeric, hyphens, underscores only)">
                    <small>This will be used in the URL path: /image/{prefix}</small>
                </div>
                <div class="form-group">
                    <label for="files">Select Images:</label>
                    <input type="file" id="files" name="files" multiple accept="image/*" required>
                </div>
                <button type="submit">Upload Images</button>
            </form>
            <div id="result"></div>
            <div id="error" class="error"></div>

            <script>
                document.getElementById('uploadForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const prefix = document.getElementById('prefix').value;
                    const files = document.getElementById('files').files;
                    const result = document.getElementById('result');
                    const error = document.getElementById('error');
                    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMDAwMDAwMCIsImlzcyI6ImltYWdlLXJlc2l6ZS1zZXJ2ZXIiLCJleHAiOjE3NDI5OTcwNzgsImFsZyI6IkhTMjU2In0.vSPxWOHsDzFCIogVpHBWW19RSSskUnpP-t3CcMIdo80';
                    
                    error.textContent = '';
                    result.textContent = 'Uploading...';

                    const formData = new FormData();
                    for (let i = 0; i < files.length; i++) {
                        formData.append('files', files[i]);
                        formData.append('sub', '20000000')
                    }

                    try {
                        const response = await fetch(\`/image/\${prefix}\`, {
                            method: 'POST',
                            body: formData,
                            headers: {
                                'Authorization': \`Bearer \${token}\`
                            }
                        });

                        const data = await response.json();
                        if (response.ok) {
                            result.textContent = JSON.stringify(data, null, 2);
                        } else {
                            error.textContent = data.message || 'Upload failed';
                        }
                    } catch (err) {
                        error.textContent = 'Error: ' + err.message;
                    }
                });
            </script>
        </body>
        </html>
    `);
} 