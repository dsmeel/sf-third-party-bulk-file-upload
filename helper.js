const fs = require('fs');

// Function to delete a file
function delete_file(filePath) {
    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File does not exist or cannot be accessed:', err);
        } else {
            // Delete the file
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error('Error deleting the file:', err);
                } else {
                    console.log('File deleted successfully.');
                }
            });
        }
    });
}

// Function to delete a folder and its contents recursively
function delete_folder(folderPath) {
    fs.rmdir(folderPath, { recursive: true }, (err) => {
        if (err) {
            console.error('Error removing the folder:', err);
        } else {
            console.log('Folder and its contents removed successfully.');
        }
    });
}

// Export the functions so they can be used in other parts of the code
module.exports = {
    delete_file,
    delete_folder
};
