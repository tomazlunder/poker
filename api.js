const https = require('https');

function getAccountName(api_key){
    return new Promise((resolve,reject) => {
        var url = "https://api.guildwars2.com/v2/account?access_token=" + api_key

        https.get(url, (resp) => {
            let api_data = '';
    
            // A chunk of data has been received.
            resp.on('data', (chunk) => {
                api_data += chunk;
            });
    
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                //console.log(JSON.parse(data))
                parsedData = JSON.parse(api_data)
                if(parsedData.text == "Invalid access token"){
                    //socket.emit("registrationFailed","Invalid API key")
                    reject("Invalid API Key")
                }
    
    
                //console.log(JSON.parse(api_data).name);
                var nameFromApi = JSON.parse(api_data).name;
                resolve(nameFromApi)
            });
    
        }).on("error", (err) => {
            console.log(err)
            reject("Unknown error")
        });
    
    });
}

module.exports.getAccountName = getAccountName;
