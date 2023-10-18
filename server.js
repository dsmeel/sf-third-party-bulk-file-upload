// Required dependencies
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");

const helpers = require('./helper'); // Import helper functions for file deletion
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

var timeout = require('connect-timeout');

// Create an Express app and define the port number
const app = express();
const port = process.env.PORT || 3000; // You can choose any available port number

// Set up middleware for JSON parsing
app.use(bodyParser.json());


app.get('/', (req, res) => {
    res.json({ status: 'success', message: 'Server is running fine' });
});


// Set up the storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create the parent folder if it doesn't exist
        if (!fs.existsSync('uploads/' + req.body.parentId)) {
            fs.mkdirSync('uploads/' + req.body.parentId);
            console.log(`Folder "${req.body.parentId}" created successfully.`);
        }
        cb(null, 'uploads/' + req.body.parentId + '/'); // Uploads will be stored in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.originalname);
    },
});

// Create a multer instance with the storage configuration
const upload = multer({ storage: storage });

// Define a route for file upload
app.post('/upload-files', upload.array('files', 5), (req, res) => {
    const files = req.files;
    console.log('files', files);

    // Check if any files were uploaded
    if (!files || files.length == 0) {
        return res.status(400).json({ message: 'No files were uploaded.' });
    }

    // Check if parentId is provided in the request body
    if (req.body.parentId == undefined || req.body.parentId == '') {
        return res.status(400).json({ message: 'Please post parentId' });
    }

    // Generate file paths for the uploaded files
    const fileNames = files.map(file => req.body.parentId + '/' + file.filename);
    res.json({ status: 'success', message: 'File uploaded successfully.', filePath: fileNames });
});

// Define a route for file deletion
app.post('/delete-files', (req, res) => {
    // Check if 'type' is provided in the request body
    if (req.body.type == undefined || req.body.type == '') {
        return res.status(400).json({ message: 'Please post type' });
    } else {
        if (req.body.type == 'file') {
            // Check if 'filePath' is provided in the request body
            if (req.body.filePath == undefined || req.body.filePath.length == 0) {
                return res.status(400).json({ message: 'Please post filePath' });
            }

            console.log('files', req.body.filePath);
            // Delete the files using helper function for file deletion
            req.body.filePath.map(file => {
                helpers.delete_file('uploads/' + file);
            });

            res.json({ status: 'success', message: 'Files deleted successfully.' });
        } else if (req.body.type == 'parent') {
            // Check if 'parentId' is provided in the request body
            if (req.body.parentId == undefined || req.body.parentId == '') {
                return res.status(400).json({ message: 'Please post parentId' });
            }

            // Delete the parent folder using helper function for folder deletion
            helpers.delete_folder('uploads/' + req.body.parentId);
            console.log('parentId', req.body.parentId);
            res.json({ status: 'success', message: 'Parent folder deleted successfully.' });
        }
    }
});

// Define a route to post data and file to third party server
app.post('/third-party-request', async (req, res) => {

    if (req.body.endpoint == undefined || req.body.endpoint == '') {
        return res.status(400).json({ message: 'Please post endpoint' });
    }

    if (req.body.method == undefined || req.body.method == '') {
        return res.status(400).json({ message: 'Please post method' });
    }



    if (req.body.requestBody == undefined || Object.keys(req.body.requestBody).length === 0) {
        return res.status(400).json({ message: 'Please post requestBody' });
    }



    if ((req.body.format && req.body.format.toLowerCase() == "form-data") || (req.body.files != undefined && req.body.files.length > 0)) {
        var data = new FormData();
        console.log('req.body.requestBody', req.body.requestBody);
        for (let key in req.body.requestBody) {
            if(req.body.requestBody[key]){
                data.append(key, req.body.requestBody[key]);
            }
        }

        if (req.body.files) {
            var counter = 0;
            req.body.files.forEach(file => {
                let filePath = path.join(__dirname, '/uploads/' + file);
                var fileKey = 'files';
                if (req.body.fileConfig && req.body.fileConfig.uploadType
                    && req.body.fileConfig.uploadType.toLowerCase() == 'multiple'
                    && req.body.fileConfig.uploadKeys && req.body.fileConfig.uploadKeys.length > 0) {
                    fileKey = req.body.fileConfig.uploadKeys[0];
                }
                if (req.body.fileConfig && req.body.fileConfig.uploadType
                    && req.body.fileConfig.uploadType.toLowerCase() == 'single'
                    && req.body.fileConfig.uploadKeys && req.body.fileConfig.uploadKeys.length >= counter) {
                    fileKey = req.body.fileConfig.uploadKeys[counter];
                }
                counter++;
                //data.delete(fileKey);
                data.append(fileKey, fs.createReadStream(filePath));
            });
        }
        var requestHeaders = {
            ...data.getHeaders(),
        }
        if (req.body.headers) {
            for (var key in req.body.headers) {
                if(key.toLowerCase() != 'content-type'){
                    requestHeaders[key] = req.body.headers[key];
                }
            }
        }

        var config = {
            method: req.body.method,
            url: req.body.endpoint,
            headers: requestHeaders,
            data: data
        };
    } else {
        var config = {
            method: req.body.method,
            url: req.body.endpoint,
            headers: req.body.headers,
            data: JSON.stringify(req.body.requestBody)
        };
    }

    console.log('config=>', config);

    axios(config)
        .then(function (response) {
            console.log(JSON.stringify(response.data));
            res.json({ status: 'success', data: response.data });
        })
        .catch(function (error) {
            var errorToReturn = { status: 'error' };
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorToReturn.data = error.response.data;
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
              } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser 
                // and an instance of http.ClientRequest in node.js
                errorToReturn.data = error.response;
                console.log(error.request);
              } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error', error.message);
              }
              errorToReturn.message = error.message;
            res.json(errorToReturn);
        });



});


function haltOnTimedout (req, res, next) {
    if (!req.timedout) next()
  }

// Define a route to post data and file to third party server
app.post('/third-party-request-xmlpayload', timeout('50s'), haltOnTimedout,  async (req, res) => {

    if (req.body.endpoint == undefined || req.body.endpoint == '') {
        return res.status(400).json({ message: 'Please post endpoint' });
    }

    if (req.body.method == undefined || req.body.method == '') {
        return res.status(400).json({ message: 'Please post method' });
    }



    if (req.body.requestBody == undefined || Object.keys(req.body.requestBody).length === 0) {
        return res.status(400).json({ message: 'Please post requestBody' });
    }


    const options = {
        ignoreAttributes : false
    };
    let jObj;
    const builder = new XMLBuilder(options);
    const parser = new XMLParser(options);
    if (req.body.files != undefined && req.body.files.length > 0) {
        
        jObj = parser.parse(req.body.requestBody);


        if (req.body.files) {
            jObj['soap:Envelope']['soap:Body']['CreateLead']['leadWSModel']['Documents'] = [];
            req.body.files.forEach(file => {
                let filePath = path.join(__dirname, '/uploads/' + file.path);
                const fileObj = {};
                fileObj.ClientDocument = {
                    FileName:file.name, 
                    DocumentType:file.documentType, 
                    Content:fs.readFileSync(filePath, {encoding: 'base64'}) 
                };
                jObj['soap:Envelope']['soap:Body']['CreateLead']['leadWSModel']['Documents'].push(fileObj);
            });
        }

        var config = {
            keepAlive: true,
            method: req.body.method,
            url: req.body.endpoint,
            headers: req.body.headers,
            data: builder.build(jObj)
        };
    } else {
        var config = {
            keepAlive: true,
            method: req.body.method,
            url: req.body.endpoint,
            headers: req.body.headers,
            data: JSON.stringify(req.body.requestBody)
        };
    }

    console.log('config=>', config);

    axios(config)
        .then(function (response) {
            console.log("api response -- ",JSON.stringify(response.data));
            res.json(response.data);
        })
        .catch(function (error) {
            var errorToReturn = { status: 'error' };
            console.log("api error response -- ",error);
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                errorToReturn.data = error.response.data;
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
              } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser 
                // and an instance of http.ClientRequest in node.js
                errorToReturn.data = error.response;
                console.log(error.request);
              } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error', error.message);
              }
              errorToReturn.message = error.message;
            res.json(errorToReturn);
        });
        console.log('return response to user');
    //res.json({success:true});   
        

        

});






// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
