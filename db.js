const { response } = require('express');
var mysql = require('mysql');
var con;

function connectDatabase() {
    if (!con) {
        con = mysql.createConnection({
            host: "localhost",
            port: 3307,
            user: "appUser1",
            password: "awdqseww123",
            database: "ecto_poker",
            insecureAuth : true
        });

        con.connect(function(err){
            if(!err) {
                console.log('Database is connected!');
            } else {
                console.log('Error connecting database!');
            }
        });
    }

    return con;
}

//getUserBalance
function getPerson(account_name){
    return new Promise((resolve,reject) => {
        var query = con.query("SELECT * FROM person WHERE account_name = ?",
				[account_name],
				function(err, result){
					if (err) {
                        console.log(err)
                        reject()
                    }
					console.log(query.sql); 
					console.log(result);
					if(result.length == 1){
                        resolve(result[0])
					}
					else{
                        reject()
					}
				}
			);
    });
}


//getUserBalance
function tryDecreaseBalance(user_id, decrease_by){
    return new Promise((resolve,reject) => {
        var query = con.query("UPDATE person SET balance = balance - ? WHERE id_person = ?",
        [decrease_by, user_id],
		function(err, result){
            if (err){
                console.log(err)
                reject();
                return;
            }
            
            console.log(query.sql); 
			console.log(result);

			if(result.changedRows == 1){
				//Complete room join
				resolve()
			}
			else{
				reject()
			}
        });
    });
}

function setPersonStack(user_id, new_stack){
    return new Promise((resolve,reject) => {
        var query = con.query("UPDATE person SET stack = ? WHERE id_person = ?",
        [new_stack, user_id],
		function(err, result){
            if (err){
                console.log(err)
                reject();
                return;
            }

			if(result.changedRows == 1){
				resolve()
			}
			else{
				reject()
			}
        });
    });
}

function setPersonPassword(id_person, hash){
    return new Promise((resolve,reject) => {
        var query = con.query("UPDATE person SET password_hash = ? WHERE id_person = ?",
        [hash, id_person],
		function(err, result){
            if (err){
                console.log(err)
                reject();
                return;
            }
			if(result.changedRows == 1){
				resolve()
			}
			else{
				reject()
			}
        });
    });
}

function setPersonEmail(id_person, email){
    return new Promise((resolve,reject) => {
        var query = con.query("UPDATE person SET email = ? WHERE id_person = ?",
        [email, id_person],
		function(err, result){
            if (err){
                console.log(err)
                reject();
                return;
            }
			if(result.changedRows == 1){
				resolve()
			}
			else{
				reject()
			}
        });
    });
}


//getUserBalance
function insertPerson(account_name, password_hash, email){
    return new Promise((resolve,reject) => {    
        var query = con.query("INSERT INTO person(account_name, password_hash, email) VALUES (?,?,?)",
            [account_name,
            password_hash,
            email
            ],
            function(err, result){
                if (err){
                    console.log(err)
                    reject("User exist");
                    return;
                }

                if(result.affectedRows == 1){
                    resolve()
                }
                else{
                    reject()
                }            
            }
        );
        
    });
}

function transferStackToBalance(user){
    return new Promise((resolve,reject) => {    
        var query = con.query("UPDATE person SET balance = balance + ?, stack = 0 WHERE account_name = ?",
            [user.stack, user.name],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql); 
                console.log(result);
                if(result.affectedRows == 1){
                    console.log("Transfered stack to balance.")
                    resolve()
                }else{
                    reject()
                }
            }
        );
    });
}

function changeWinnings(id_person, change_by){
    return new Promise((resolve,reject) => {    
        var query = con.query("UPDATE person SET winnings = winnings + ?, roundsPlayed = roundsPlayed + 1 WHERE id_person = ?",
            [change_by, id_person],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql); 
                console.log(result);
                if(result.changedRows == 1){
                    console.log("Changed winnings.")
                    resolve()
                }else{
                    reject()
                }
            }
        );
    });
}

function insertWithdraw(id_person, amount){
    return new Promise((resolve,reject) => {    
        var query = con.query("INSERT INTO withdraw(id_person, amount) VALUE (?,?)",
            [id_person, amount],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql); 
                console.log(result);
                if(result.affectedRows == 1){
                    console.log("Created withdraw.")
                    resolve()
                }else{
                    reject()
                }
            }
        );
    });
}

//On startup (if crashed)
function transferAllPersonStackToBalance(){
    return new Promise((resolve,reject) => {    
        var query = con.query("UPDATE person SET balance = balance + stack, stack = 0 WHERE id_person >= 0;",
            null,
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql)
                console.log(result)
                resolve()
            }
        );
    });
}

function getSumTips(id_person){
    return new Promise((resolve,reject) => {    
        var query = con.query("SELECT SUM(amount) as result_sum FROM tip WHERE id_person = ?;",
            [id_person],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql)
                console.log(result)
                if(result.length == 1){
                    if(result[0].result_sum){
                        resolve(result[0].result_sum)
                    } else {
                        resolve(0)
                    }
                }
            }
        );
    });
}

function getPendingWithdrawals(id_person){
    return new Promise((resolve,reject) => {    
        var query = con.query("SELECT SUM(amount) as result_sum FROM withdraw WHERE id_person = ? AND completed = 0;",
            [id_person],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql)
                console.log(result)
                if(result.length == 1){
                    if(result[0].result_sum){
                        resolve(result[0].result_sum)
                    } else {
                        resolve(0)
                    }
                }
            }
        );
    });
}

function insertTip(id_person, amount){
    return new Promise((resolve,reject) => {    
        var query = con.query("INSERT INTO tip(id_person, amount) VALUE (?,?)",
            [id_person, amount],
            function(err, result){
                if (err) {
                    console.log(err)
                    reject()
                }
                console.log(query.sql); 
                console.log(result);
                if(result.affectedRows == 1){
                    resolve()
                }else{
                    reject()
                }
            }
        );
    });
}

module.exports = connectDatabase();
module.exports.getPerson = getPerson;
module.exports.tryDecreaseBalance = tryDecreaseBalance;
module.exports.setPersonStack = setPersonStack;
module.exports.insertPerson = insertPerson;
module.exports.transferStackToBalance = transferStackToBalance;
module.exports.changeWinnings = changeWinnings;
module.exports.insertWithdraw = insertWithdraw;
module.exports.transferAllPersonStackToBalance = transferAllPersonStackToBalance;
module.exports.getSumTips = getSumTips;
module.exports.getPendingWithdrawals = getPendingWithdrawals;
module.exports.insertTip = insertTip;
module.exports.setPersonPassword = setPersonPassword;
module.exports.setPersonEmail = setPersonEmail;




