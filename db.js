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
					if (err) throw err;
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
			if (err) throw err;
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


//getUserBalance
function insertUser(account_name, password_hash, email){
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
                if (err) throw err;
                console.log(query.sql); 
                console.log(result);
                if(result.changedRows == 1){
                    console.log("Transfered stack to balance.")
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
module.exports.insertUser = insertUser;
module.exports.transferStackToBalance = transferStackToBalance;