//var app = require('express')();
var express = require('express')
var path = require('path')
var app = express()

var http = require('http').Server(app);
var io = require('socket.io')(http);
const https = require('https')
var crypto = require('crypto');

// Express Middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));

let socketUserMap = new Map()

var con = require('./db');
var Room = require('./room.js')

var hash 
hash = crypto.createHash('sha256').update("12345678" + "TestOne.1234").digest('base64');
console.log(hash)



app.get('/', function(req, res) {
   res.sendFile(__dirname +'/index.html');
});

io.on('connection', function(socket) {
	console.log('Someone connected');

	socket.on('login', login);
	socket.on('disconnect', disconnect);
	socket.on('registration', registration);
	socket.on('joinRoom', joinRoom);
	socket.on('rebuyRoom', rebuyRoom);

	socket.on('leaveRoom',leaveRoom)

	socket.on('lookingForRooms',lookingForRooms)

	socket.on('actionRequest', actionRequest);

	function lookingForRooms(){
		var alreadyInRoom = 0
		var user = socketUserMap.get(socket)

		for(var i = 0; i<rooms.length; i++){
			for(var j = 0; j<rooms[i].seats.length; j++){
				if(rooms[i].seats[j]){
					if(rooms[i].seats[j].name == user.name ){
						alreadyInRoom = 1
						break
					}
				}
			}
		}

		var ret = []
		var room;
		for(var i in rooms){
			room = rooms[i]
			ret.push([room.room_id,room.sb_size,room.min_buy_in, room.max_buy_in, rooms[i].numberOfPlayers(), room.seats.length, room.name])
		}
		socket.emit("roomList",[alreadyInRoom,ret]);
	}

	function actionRequest(data){
		//console.log("AR :" + data)
	    var room_id = data[0]
	    var action = data[1];
		var raise_number = null;

	    if(action == "raise"){
		   raise_number = data[2];
	    }

	    var the_room;
	    for(var i in rooms){
			if(rooms[i].room_id == room_id){
				the_room = rooms[i]
			}
		}
	
		if(the_room){
			the_room.tryAction(socket.id,action,raise_number)
		} else {
			console.log(socket.id +" tried action but not in a room.")
		}

   }

   //MAIN HANLDERS
	function login(data){
		var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');
	
		var query = con.query("SELECT * FROM user WHERE account_name = ?",
				[data.name],
				function(err, result){
					if (err) throw err;
					console.log(query.sql); 
					console.log(result);
					if(result.length == 1){
						if(result[0].password_hash == hash){
							console.log("Someone logged in")
							var user = new User(socket,result[0].account_name,parseInt(result[0].balance))
							users.push(user);
							socket.emit("loginOk",[result[0].account_name, result[0].balance]);
							socketUserMap.set(socket, user)
							console.log('Number of users: '+ users.length);
						}
						else{
							console.log("Incorrect password")
							socket.emit("loginFailed","Incorrect password");
						}
					}
					else{
						console.log("Name not registered")
						socket.emit("loginFailed","Account is not registered");
					}
				}
			);
	}

	function disconnect(reason){
		console.log('Someone disconnected');

		//Marks user as zombie if in any room
		leaveRoom()

		for(var i =0;i<users.length;i++){
			if(users[i].socket.id == socket.id){
			  //socket.broadcast.to(users[i].room).emit("opponentDisconnect");
			  users.splice(i,1);
			  console.log('Number of users: '+users.length);
			  break;
			}
		}
	}

	function leaveRoom(){
		for(var i = 0; i<rooms.length; i++){
			for(var j = 0; j<rooms[i].seats.length; j++){
				if(rooms[i].seats[j]){
					if(rooms[i].seats[j].socket == socket){
						rooms[i].seats[j].zombie = 1;
						console.log(rooms[i].room_id + ": marked "+rooms[i].seats[j].name+" as zombie.")
					}
				}
			}
		}
	}

	function registration(data) {
        console.log(data)

        if(data.password.length < 8){
			socket.emit("registrationFailed","Password too short")
			return
		}

		checkNameVsAPI(data, checkAccountNameExists)
		//checkAccountNameExists -> Register
    }

	function joinRoom(arg){
		var room_id = arg[0]
		var buy_in = arg[1]

		console.log(socketUserMap.get(socket).name + " requested to join " + room_id)
		var user = socketUserMap.get(socket)

		for(var i = 0; i<rooms.length; i++){
			for(var j = 0; j<rooms[i].seats.length; j++){
				if(rooms[i].seats[j]){
					if(rooms[i].seats[j].name == user.name ){
							console.log("Already in a room... ("+rooms[i].room_id+")")

							socket.emit("roomJoinFailed", "Already in a room!")
							return;
					}
				}
			}
		}

		for(var i in rooms){
			var room = rooms[i]
			if(room.room_id == room_id){
				console.log(buy_in)

				if(buy_in > room.max_buy_in){
					console.log("Buy_in too big for room")
					return
				}
				
				if(buy_in < room.min_buy_in){
					console.log(room.min_buy_in)
					console.log("Buy in too small for room")
					return
				}
				//console.log(room)
				var seatId = rooms[i].getEmptySeatID()
				if(seatId >= 0){
					//TODO
					checkAccountBalance(user,room,seatId,buy_in,completeJoinRoom);
				}
				else{
					socket.emit("roomFull")
					console.log("Selected room is full.");
				}
			}	
		}
	}
	
	function rebuyRoom(arg){
		var room_id = arg[0]
		var buy_in = arg[1]
		var user = socketUserMap.get(socket)

		for(var i in rooms){
			var room = rooms[i]
			if(room.room_id == room_id){
				for(var j in room.seats){
					if(room.seats[j]){
						if(room.seats[j].name == user.name){
							if(room.state == 0 || room.state == 14){
								if(buy_in <= room.max_buy_in - user.stack & buy_in != 0 & user.stack < room.min_buy_in){
									checkAccountBalance(user,room, null, buy_in, completeRebuy);
								}
							}
							else{
								console.log("Someone tried rebuy but roomstate not 0 or 14.")
							}
						}
					}
				}
			}
		}
	
	}

	//HELPER
	// Registration chain
	function checkNameVsAPI(data, myCallback){
		var url = "https://api.guildwars2.com/v2/account?access_token=" + data.api
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
					console.log("Invalid access token.")
					//RESPOND WITH API KEY INCORRECT
					socket.emit("registrationFailed","Invalid API key")
					return 1
				}


				//console.log(JSON.parse(api_data).name);
				var nameFromApi = JSON.parse(api_data).name;

				if(data.name !== nameFromApi){
					console.log(data.name)
					console.log(nameFromApi)
					socket.emit("registrationFailed","Entered account name does not match the API key")
					return 1
				}

				console.log("Name matches api")
				myCallback(data, register)
			});

		}).on("error", (err) => {
		console.log("Error: " + err.message);
		});
	}

	function checkAccountNameExists(data, myCallback) {
		var query =  con.query("SELECT * FROM user WHERE account_name = ?",
			[data.name],
		    function(err, result){
		    	if (err) throw err;
			    console.log(result);
			    console.log(result.length)
			    if(result.length == 1){
			    	console.log("Name already registered")
			    	socket.emit("registrationFailed","Name is already registered");
			    	return 1;
			    }
			    else{
			    	console.log("Name not registered")
			    	myCallback(data)
			    }
			}
		);
	}

	function register(data){
		if(!data.email){
			data.email = null
		}
	
		var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');
		console.log(hash)
		console.log(hash.length)
	
	
		var query = con.query("INSERT INTO user(account_name, password_hash, screen_name, email) VALUES (?,?,?,?)",
			[data.name,
			hash,
			data.name,
			data.email
			],
			function(err, result){
				if (err) throw err;
				console.log("1 record inserted");
				console.log("Registration Successful!")
				console.log("LoginOK")
				socket.emit("loginOk",[data.name, 0]);
			}
		);
	}

	// Join room chain
	function checkAccountBalance(user, room, seatId, buy_in, myCallback) {
		var query = con.query("SELECT * FROM user WHERE account_name = ?",
		[user.name],
		function(err, result){
			if (err) throw err;
			console.log(result);
			if(result.length == 1){
				console.log(query.sql); 
				user.balance = result[0].balance
				if(user.balance >= buy_in){
					console.log("Balance high enough for buy in")

					myCallback(user, room, seatId, buy_in);
				}
				else{
					console.log("Balance not high enough for buy in")
					//socket.emit("loginFailed","Incorrect password");
				}
			}
			else{
				console.log("Something went very wrong")
				//socket.emit("loginFailed","Account is not registered");
			}
		}
	);
	}

	function completeJoinRoom(user,room, seatId, buy_in){
		var diff = user.balance - buy_in
		var query =  con.query("UPDATE user SET balance = ?, stack = ? WHERE account_name = ?",
		[diff,buy_in,user.name],
		function(err, result){
			if (err) throw err;
			console.log(query.sql); 
			console.log(result);
			if(result.changedRows == 1){
				//Complete room join
				user.balance -= buy_in

				user.stack = buy_in
				user.zombie = 0
				user.alive = 0

				room.seats[seatId] = user
				console.log(room.room_id + ": join room sucessful ("+user.name+")")
				socket.emit("roomJoined",[room.room_id, seatId, user.balance, room.min_buy_in, room.max_buy_in])
				socket.join(room.room_id);

				room.sendNamesStacks()
				room.sendGamestate();
			
			}
			else{
				console.log("Something went very wrong")
				//socket.emit("loginFailed","Account is not registered");
			}
		}
	);
	}

	function completeRebuy(user, room, seatId, buy_in){
		var diff = user.balance - buy_in
		var newStack = parseInt(user.stack) + parseInt(buy_in)
		var query =  con.query("UPDATE user SET balance = ?, stack = ? WHERE account_name = ?",
		[diff,newStack,user.name],
		function(err, result){
			if (err) throw err;
			console.log(query.sql); 
			console.log(result);
			if(result.changedRows == 1){
				//Complete room join
				user.balance -= buy_in
				user.stack = newStack

				console.log(room.room_id + ": rebuy successful ("+user.name+","+buy_in+")")

				user.socket.emit

				user.socket.emit("newBalance", user.balance)
				room.sendNamesStacks()
			
			}
			else{
				console.log("Something went very wrong")
				//socket.emit("loginFailed","Account is not registered");
			}
		}
	);

	}

});

http.listen(process.env.PORT || 3000, function() {
   console.log('listening on *:3000');
});

process
  .on('unhandledRejection', (reason, p) => {
    console.error(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', err => {
    console.error(err, 'Uncaught Exception thrown');
    process.exit(1);
  });

//LOGGED IN USER
function User(socket, name, balance){
	this.socket = socket;
	this.name = name;
	this.balance = balance;
	
	this.cards = []
	this.stack = 0;
	this.bet = 0;
	this.alive = 0;
	this.zombie = 0;

	this.all_in = 0;
	this.total_bet_size = 0;
	this.result = 0;
}


//GAME LOOP  
var users = []
var rooms = []

const tickTime = 2000;
const timeForAction = 25000;
const timeAtEnd = 10000;
const showdownTime = 2000;

rooms.push(new Room.Room(io,1, 1, 40,100,6, "Lord Fahren's Quarters"));
rooms.push(new Room.Room(io,2, 1, 40,100,6, "Zojja's Lab"));
rooms.push(new Room.Room(io,3, 2, 80, 200,6, "Braham's Lodge"));
rooms.push(new Room.Room(io,4, 2, 80, 200,6, "Rytlock's Tent"));

/*
rooms.push(new Room.Room(io,5, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,6, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,7, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,8, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,9, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,10, 2, 100, 500,6, "Bla"));
rooms.push(new Room.Room(io,11, 2, 100, 500,6, "Bla"));
/*
rooms.push(new Room.Room(io,6, 2, 100,6));
rooms.push(new Room.Room(io,7, 2, 100,6));
rooms.push(new Room.Room(io,8, 2, 100,6));
rooms.push(new Room.Room(io,9, 2, 100,6));
rooms.push(new Room.Room(io,10, 2, 100,6));
rooms.push(new Room.Room(io,11, 2, 100,6));
rooms.push(new Room.Room(io,12, 2, 100,6));
rooms.push(new Room.Room(io,13, 2, 100,6));
*/


for(var i in rooms){
	setInterval(function(){
		for(var i in rooms){
			rooms[i].updateGame();
		}
	}, tickTime);
}
