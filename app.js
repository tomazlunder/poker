//var app = require('express')();
var express = require('express');
var path = require('path');
var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);
var crypto = require('crypto');

// Express Middleware for serving static files
app.use(express.static(path.join(__dirname, 'public')));

let socketUserMap = new Map()
let pidRoomMap = new Map()

//var con = require('./db');
var Room = require('./room.js');
var db = require('./db.js');
var api = require('./api.js')

const { RSA_PKCS1_PADDING } = require('constants');

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
	async function login(data){
		var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');
	
		try{
			const response = await db.getPerson(data.name)

			if(response.password_hash == hash){
				var user = new User(socket,response.id_person,response.account_name,response.balance)

				users.push(user);
				socketUserMap.set(socket, user)

				console.log(response.account_name + " logged in")
				console.log('Number of users: '+ users.length);

				socket.emit("loginOk",[response.account_name, response.balance]);
			}
			else{
				console.log("Incorrect login info")
				socket.emit("loginFailed", "Incorrect password");
			}

		} catch (err) {
			console.log("Account not registered")
			socket.emit("loginFailed", "Account not registered");

		}
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

	async function registration(data) {
        console.log(data)

        if(data.password.length < 8){
			socket.emit("registrationFailed","Password too short")
			return
		}

		//checkNameVsAPI(data, checkAccountNameExists)

		try{
			const response = await api.getAccountName(data.api)

			var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');

			if(response != data.name){
				socket.emit("registrationFailed", "API key does not match user name")
				return;
			}

			const response2 = await db.insertUser(data.name, hash, data.email)

			console.log("Registration Successful!")
			/*
			console.log("LoginOK")
			socket.emit("loginOk",[data.name, 0]);
			*/
			login(data)

		} catch (err){
			console.log(err)
			if(err == "Invalid API Key"){
				socket.emit("registrationFailed", "Invalid API Key");
			}
		}
		//checkAccountNameExists -> Register
    }

	async function joinRoom(arg){
		var room_id = arg[0]
		var buy_in = arg[1]

		console.log(socketUserMap.get(socket).name + " requested to join " + room_id)
		var user = socketUserMap.get(socket)

		if(pidRoomMap.has(socketUserMap.get(socket).id_person)){
			console.log("Already in a room... ("+rooms[i].room_id+")")

			socket.emit("roomJoinFailed", "Already in a room!")
			return;
		}

		var the_room = null;
		for(var i in rooms){
			var room = rooms[i]
			if(room.room_id == room_id){
				the_room = room;
				break;
			}
		}

		if(!the_room){
			console.log("ERROR: Room not found");
			return;
		}

		if(buy_in > room.max_buy_in){
			console.log("Buy_in too big for room")
			return
		}
		
		if(buy_in < room.min_buy_in){
			console.log(room.min_buy_in)
			console.log("Buy in too small for room")
			return
		}

		var seatId = rooms[i].getEmptySeatID()
		if(seatId >= 0){
			try{
				console.log(user.id_person)
				const response = await db.tryDecreaseBalance(user.id_person, buy_in)

				user.balance -= buy_in

				user.stack = buy_in
				user.zombie = 0
				user.alive = 0

				room.seats[seatId] = user
				console.log(room.room_id + ": join room sucessful ("+user.name+")")
				socket.emit("roomJoined",[room.room_id, seatId, user.balance, room.min_buy_in, room.max_buy_in])
				socket.join(room.room_id);

				pidRoomMap.set(user.id_person, room)

				room.sendNamesStacks()
				room.sendGamestate();
			} catch (err) {
				console.log(err)
			}
		}
		else{
			socket.emit("roomFull")
			console.log("Selected room is full.");
		}
	}
	
	async function rebuyRoom(arg){
		var buy_in = parseInt(arg[0])
		var user = socketUserMap.get(socket)

		if(pidRoomMap.has(user.id_person)){
			var the_room = pidRoomMap.get(user.id_person);
			if(the_room.state == 0 || the_room.state == 14){
				if(buy_in <= the_room.max_buy_in - user.stack & buy_in != 0 & user.stack < the_room.min_buy_in){
					//checkAccountBalance(user,room, null, buy_in, completeRebuy);
					try{
						const response = db.tryDecreaseBalance(user.id_person, buy_in)

						const response2 = db.setPersonStack(user.id_person, parseInt(user.stack) + parseInt(buy_in))

						user.stack = user.stack + buy_in
						user.balance -= buy_in

						console.log(the_room.room_id + ": rebuy successful ("+user.name+","+buy_in+")")

						user.socket.emit("newBalance", user.balance)
						the_room.sendNamesStacks()

					} catch (err){
						console.log(err)
					}
				}
			}
			else{
				console.log("Someone tried rebuy but roomstate not 0 or 14.")
			}
		}
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
function User(socket, id_person, name, balance){
	this.socket = socket;
	this.id_person = id_person;
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

rooms.push(new Room.Room(io,1, 1, 40,100,6, "Lord Fahren's Quarters", pidRoomMap));
rooms.push(new Room.Room(io,2, 1, 40,100,6, "Zojja's Lab", pidRoomMap));
rooms.push(new Room.Room(io,3, 2, 80, 200,6, "Braham's Lodge", pidRoomMap));
rooms.push(new Room.Room(io,4, 2, 80, 200,6, "Rytlock's Tent", pidRoomMap));

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
