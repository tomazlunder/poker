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

function getGuildLog(key_guild, key_api, since = null){
    return new Promise((resolve,reject) => {
        //var url = "https://api.guildwars2.com/v2/account?access_token=" + api_key

        var url = "https://api.guildwars2.com/v2/guild/"
        url = url + key_guild
        url = url + "/log"
        if(since){
            url = url + "?since="+since+"&"
        }
        else{
            url = url + "?"
        }
        url = url + "access_token="
        url = url + key_api

        console.log(url)

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
    
                //var nameFromApi = JSON.parse(api_data).name;
                resolve(parsedData)
            });
    
        }).on("error", (err) => {
            console.log(err)
            reject("Unknown error")
        });
    
    });
}

module.exports.getAccountName = getAccountName;
module.exports.getGuildLog = getGuildLog;
