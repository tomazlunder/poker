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
let roomidRoomMap = new Map()

var db = require('./db.js');
var api = require('./api.js')
var Room = require('./room.js');
var Tournament = require('./tournament.js');



const { RSA_PKCS1_PADDING } = require('constants');
const { Socket } = require('dgram');
const { REPL_MODE_SLOPPY } = require('repl');

//Server vars
var users = []
var rooms = []

const removeDisconnectedUsersTime = 5000;
const checkForDepositTime = 2 * 60 * 1000;

const timeForAction = 25000;
const timeAtEnd = 10000;
const showdownTime = 2000;

var hash 
hash = crypto.createHash('sha256').update("awdqseww" + "ThaMightyBird.9712").digest('base64');
console.log(hash)

hash = crypto.createHash('sha256').update("awdqseww1" + "ThaMightyBird.9712").digest('base64');
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
	socket.on('joinTournament', joinTournament);
	socket.on('rebuyRoom', rebuyRoom);
	socket.on('leaveRoom',leaveRoom)
	socket.on('lookingForRooms',lookingForRooms)
	socket.on('actionRequest', actionRequest);
	socket.on('withdraw', withdraw);
	socket.on('tip', tip);
	socket.on('reconnect', reconnect);
	socket.on('accountStats', accountStats);
	socket.on('changePassword', changePassword);
	socket.on('changeEmail', changeEmail);
	socket.on('getLeaderboard', getLeaderboard);
	socket.on('adminRoomStop', adminRoomStop);
	socket.on('adminRoomStart', adminRoomStart);


	function adminRoomStop(room_id){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}
		if(socketUserMap.get(socket).is_admin == 0){
			console.log("Tried admin cmd but is not an admin.")
			return;
		}

		console.log("Received room stop ("+room_id+")")
		var the_room 

		for(var i in rooms){
			if(rooms[i].room_id == room_id){
				if(rooms[i].running == 0 || rooms[i].markedForShutdown == 1){
					console.log("Received room stop but room already stopped/marked for stopping");
					return;
				}

				rooms[i].markedToStop = 1;
				if(rooms[i].roomState == 0){
					rooms[i].updateState();
				}

				socket.emit("listOutdated")

				break;
			}
		}
		
	}

	function adminRoomStart(room_id){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}
		if(socketUserMap.get(socket).is_admin == 0){
			console.log("Tried admin cmd but is not an admin.")
			return;
		}

		console.log("Received room start ("+room_id+")")
		for(var i in rooms){
			if(rooms[i].room_id == room_id){
				if(rooms[i].running == 1 ){
					console.log("Received room start but room already running");
					return;
				}

				socket.emit("listOutdated")

				rooms[i].startRoom();
			}
		}
	}

	async function getLeaderboard(){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		try{
			const result = await db.topTenWinnings();

			const result2 = await db.topTenTourWinnings();
			
			socket.emit('leaderboard', [result,result2])

		} catch(err) {
			console.log("Get leaderboard error")
			console.log(err)
		}
	}

	async function changePassword(newPassword){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var user = socketUserMap.get(socket)

		var hash = crypto.createHash('sha256').update(newPassword + user.name).digest('base64');

		try{
			const response = await db.setPersonPassword(user.id_person, hash);

			socket.emit("changePasswordOk");

		} catch (err){
			console.log("changePasswordFailed")
			socket.emit("changePasswordFailed")
			console.log(err)
		}
	}

	async function changeEmail(newEmail){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var user = socketUserMap.get(socket);

		try{
			const response = await db.setPersonEmail(user.id_person, newEmail);

			socket.emit("changeEmailOk");
			accountStats();

		} catch (err){
			console.log("changeEmailFailed")
			socket.emit("changeEmailFailed")
			console.log(err)
		}
	}

	async function withdraw(amount){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		try{
			var user = socketUserMap.get(socket)
			const a = await db.tryDecreaseBalance(user.id_person, amount)
			const b = await db.insertWithdraw(user.id_person, amount)
			
			user.balance -= amount
			socket.emit("withdrawOk")
			user.socket.emit("newBalance", user.balance)
			accountStats();

		} catch (err){
			console.log("withdrawFailed")
			socket.emit("withdrawFailed")
			console.log(err)
		}
	}

	async function tip(amount){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		try{
			var user = socketUserMap.get(socket)
			const a = await db.tryDecreaseBalance(user.id_person, amount)
			const b = await db.insertTip(user.id_person, amount)
			
			user.balance -= amount
			socket.emit("tipOk")
			user.socket.emit("newBalance", user.balance)
			accountStats();

		} catch (err){
			console.log("tipFailed")
			socket.emit("tipFailed")
			console.log(err)
		}
	}

	function lookingForRooms(){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var alreadyInRoom
		var user = socketUserMap.get(socket)
		if(pidRoomMap.has(user.id_person)){
			alreadyInRoom = pidRoomMap.get(user.id_person).room_id;
		}

		var roomList = []
		var tournamentList = []

		for(var i in rooms){
			var room = rooms[i]
			if(room.type == "room"){
				roomList.push([room.room_id,room.sb_size,room.min_buy_in, room.max_buy_in, room.numberOfPlayers(), room.seats.length, room.name, room.running, room.markedForShutdown])
			}
			else if(room.type == "tournament"){
				tournamentList.push(([room.room_id, room.entry_fee, room.numberOfPlayers(), room.numPlayers, room.name, room.running, room.markedForShutdown, room.rewards]))
			}

		}

		socket.emit("roomList",[alreadyInRoom, roomList, users.length]);

		socket.emit("tournamentList",[alreadyInRoom, tournamentList])
	}

	function actionRequest(data){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		//console.log("AR :" + data)
	    var room_id = data[0]
	    var action = data[1];
		var raise_number = null;
		var user = socketUserMap.get(socket)

	    if(action == "raise"){
		   raise_number = data[2];
	    }

	    var the_room;

		if(pidRoomMap.has(user.id_person)){
			the_room = pidRoomMap.get(user.id_person)
		}
	
		if(the_room){
			the_room.tryAction(user.id_person,action,raise_number)
		} else {
			console.log(socket.id +" tried action but not in a room.")
		}

   }

    async function login(data){
		var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');
	
		try{
			const response = await db.getPerson(data.name)

			if(response.password_hash == hash){
				var someUser = null;
				for(var i in users){
					if(users[i].id_person == response.id_person){
						someUser = users[i];
					}
				}
				
				//User already logged in with another socket
				if(someUser){
					console.log("Duplicate login")
					someUser.socket.emit("dc")
					someUser.socket.disconnect();
					someUser.socket = socket;
					socketUserMap.set(socket, someUser);
					someUser.disconnected = 0;
				}
				else {
					var user = new User(socket,response.id_person,response.account_name,response.balance)

					users.push(user);
					socketUserMap.set(socket, user)
				}

				const response2 = await db.getSumTips(response.id_person)
				const response3 = await db.getPendingWithdrawals(response.id_person)

				console.log(response.account_name + " logged in")
				console.log('Number of users: '+ users.length);
				socket.emit("loginOk",[response.account_name, response.balance, response.is_admin]);

				socket.emit("accountStats", [response.balance, response.winnings, response2, response.roundsPlayed, response3, response.email] )

				console.log(response)
				if(response.deposited > 0){
					socket.emit("depositComplete", [response.deposited]);

					const response3 = await db.resetDeposited(response.id_person)
				}
				
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

	async function accountStats(){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		try{
			var user = socketUserMap.get(socket)

			const response = await db.getPerson(user.name)
			const response2 = await db.getSumTips(response.id_person)
			const response3 = await db.getPendingWithdrawals(response.id_person)

			socket.emit("accountStats", [response.balance, response.winnings, response2, response.roundsPlayed, response3, response.email] )
			
		} catch (err) {
			console.log("[ERROR] accountStats")
		}
	}

	function disconnect(reason){
		console.log('Someone disconnected');

		//Marks user as zombie if in any room
		leaveRoom()

		if(socketUserMap.has(socket)){
			socketUserMap.get(socket).disconnected = 1;
		}
	}

	function leaveRoom(){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var user = socketUserMap.get(socket)
		var room = pidRoomMap.get(user.id_person)

		if(room){
			user.zombie = 1;
			if(room.roomState == 0){
				room.updateState()
			}
		}
	}

	async function registration(data) {
        console.log(data)

        if(data.password.length < 8){
			socket.emit("registrationFailed","Password too short")
			return
		}

		try{
			const response = await api.getAccountName(data.api)

			var hash = crypto.createHash('sha256').update(data.password + data.name).digest('base64');

			if(response != data.name){
				socket.emit("registrationFailed", "API key does not match user name")
				return;
			}

			const response2 = await db.insertPerson(data.name, hash, data.email)

			console.log("Registration Successful!")
			login(data)

		} catch (err){
			console.log(err)
			if(err == "Invalid API Key"){
				socket.emit("registrationFailed", "Invalid API Key");
			}
			else if(err == "User exist"){
				socket.emit("registrationFailed", "Account already registered");
			}
		}
    }

	async function joinRoom(arg){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

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

		if(room.running == 0 || room.markedForShutdown == 1){
			console.log("Room is shutting down or already shut down")
			return;
		}

		the_room.joinRoom(user, buy_in);
	}

	async function joinTournament(arg){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var user = socketUserMap.get(socket)

		if(pidRoomMap.has(socketUserMap.get(socket).id_person)){
			console.log("Already in a room... ("+pidRoomMap.has(socketUserMap.get(socket).id_person).room_id+")")

			socket.emit("roomJoinFailed", "Already in a room!")
			return;
		}

		var tournament_id = arg

		console.log(socketUserMap.get(socket).name + " requested to join " + tournament_id)

		var the_tournament = null;
		if(roomidRoomMap.has(tournament_id)){
			the_tournament = roomidRoomMap.get(tournament_id)
		}

		if(!the_tournament){
			console.log("ERROR: Tournament not found");
			return;
		}

		if(the_tournament.running == 0 || the_tournament.markedForShutdown == 1){
			console.log("Room is shutting down or already shut down")
			return;
		}

		the_tournament.joinRoom(user);
	}

	async function reconnect(){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var user = socketUserMap.get(socket)
		var room = pidRoomMap.get(user.id_person)


		if(room){
			var seatId = room.seats.indexOf(user);

			socket.join(room.room_id);
	
			if(room.type == "room"){
				socket.emit("roomJoined",[room.type, room.room_id, seatId, user.balance, room.min_buy_in, room.max_buy_in])
			}
			else if(room.type == "tournament"){
				user.socket.emit("roomJoined",[room.type,room.room_id, seatId, user.balance])
			}

			io.to(user.socket.id).emit("drawnCards", user.cards);				
			room.sendNamesStacks();
			room.sendGamestate();
			socket.emit("reconnectOK");

			user.zombie = 0;
			if(room.gameState.to_act == user & room.roomState == 1){
				clearInterval(room.timeoutID)
				room.betting();
			}
		}

	}
	
	async function rebuyRoom(arg){
		if(!socketUserMap.has(socket)){
			console.log("Tried something but is not logged in")
			socket.emit('dc')
			socket.disconnect;
			return;
		}

		var buy_in = parseInt(arg[0])
		var user = socketUserMap.get(socket)

		if(pidRoomMap.has(user.id_person)){
			var the_room = pidRoomMap.get(user.id_person);
			if(the_room.state == 0 || the_room.state == 8){
				if(buy_in <= the_room.max_buy_in - user.stack & buy_in != 0 & user.stack < the_room.min_buy_in){
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

	this.disconnected = 0;

	this.has_acted;

	this.busted = 0;
}

async function depositCheck(){
	console.log("[server] Doing a deposit check")
	try{
		const guilds = await db.getGuilds()
		if(guilds){
			for(var i in guilds){
				var guild = guilds[i]
				console.log("[server] guild:" +  guild.guild_name)

				var log = await api.getGuildLog(guild.api_id, guild.access_token,guild.since)

				if(log.length == 0){
					console.log("[server] "+guild.guild_name+": no logs found.")
					continue;
				}

				console.log("[server] "+guild.guild_name+": found " + log.length + " logs since " + guild.since)

				var filtered = log.filter(function (log) {
					return log.type === "stash";
				});

				filtered = filtered.filter(function (log) {
					return log.operation === "deposit";
				});
				console.log(filtered)

				filtered = filtered.filter(function (log) {
					return log.item_id === 19721;
				});

				console.log("[server] "+guild.guild_name+": ..."+filtered.length+" of them are Ecto deposits:");
				//console.log(filtered)

				for(var j in filtered){
					try{
						var person = await db.getPerson(filtered[j].user)

						var response = await db.tryIncreaseBalance(person.id_person, filtered[j].count)

						var response2 = await db.insertDeposit(guild.id_guild, person.account_name, filtered[j].count, 1, filtered[j].id)

						//If person is online
						var online = 0;
						for(var i in users){
							if(users[i].id_person == person.id_person){
								users[i].balance += filtered[j].count;
								users[i].socket.emit("newBalance", users[i].balance);
								users[i].socket.emit("depositComplete", [filtered[j].count]);
								online = 1;
							}
						}

						if(!online){
							var response3 = await db.increaseDeposited(person.id_person, filtered[j].count)
						}


						console.log("[server] Deposit inserted and completed ("+person.account_name+","+filtered[j].count+")")
					} catch (err) {
						var response2 = await db.insertDeposit(guild.id_guild, filtered[j].user, filtered[j].count, 0, filtered[j].id)
						console.log("[server] Deposit inserted but not completed (user probably not registered)")
					}
				}
				//Guild update since
				var a = await db.setGuildSince(guild.id_guild, log[0].id)
			}

		}
	} catch(err){
		console.log("[Server] Deposit check error:")
		console.log(err)
	}
}

async function runServer(){
	users = []
	rooms = []
	tournaments = []
	
	try{
		/*
		* If some of the players stacks are non zero (served crashed mid-game):
		* Transfer that players playing stack to balance
		*/
		const p = await db.transferAllPersonStackToBalance();

		/*
		* Checking guild bank deposits on GW2 API
		*
		*/
		const a = await depositCheck();

		/*
		* Rooms
		*
		*/
		var room1 = new Room.Room(io, "room1", "Braham's Lodge", 6, pidRoomMap,  1, 40, 100)
		var room2 = new Room.Room(io, "room2", "Rytlock's Tent", 6, pidRoomMap,  1, 80, 200)
		var room3 = new Room.Room(io, "room3", "Zojja's Lab", 6, pidRoomMap,  2, 80, 200)
		var room4 = new Room.Room(io, "room4", "Lord Fahren's Chamber", 6, pidRoomMap,  2, 160, 400)
		var tour1 = new Tournament.Tournament(io, "tour1", "Small auto tournament", 3, pidRoomMap, 5, 50, 1000, 1000 * 60 * 2, [100,50,0], 1)

		rooms.push(room1)
		rooms.push(room2)
		rooms.push(room3)
		rooms.push(room4)
		rooms.push(tour1)

		roomidRoomMap.set("room1", room1);
		roomidRoomMap.set("room2", room2);
		roomidRoomMap.set("room3", room3);
		roomidRoomMap.set("room4", room4);
		roomidRoomMap.set("tour1", tour1);


		//Starting rooms (... and tournaments)
		for(var i in rooms){
			rooms[i].startRoom();
		}

		//Removing disconnected users from the user list
		setInterval(function(){
			for(var i =0;i<users.length;i++){
				if(users[i].disconnected & !pidRoomMap.has(users[i].id_person)){
				  console.log("Removed " + users[i].name + " from user list");
				  users.splice(i,1);
				  console.log('Number of users: '+users.length);
				  break;
				}
			}
		}, removeDisconnectedUsersTime);

		setInterval(async function(){
			console.log("Deposit check skipped (no users online)");
			if(users.length > 0){
				try{
					const dc = await depositCheck();
					console.log("Deposit check succeded.")
				} catch (err){
					console.log("Deposit check failed.")
				}
			}
		}, checkForDepositTime)


	} catch (err) {
		console.log("[SERVER] CRITICAL ERROR")
		console.log(err)
	}
}

checkForDeposits = async function(){
	console.log("Deposit check skipped (no users online)");
	if(users.length > 0){
		try{
			const dc = await depositCheck();
			console.log("Deposit check succeded.")
		} catch (err){
			console.log("Deposit check failed.")
		}
	}
}

runServer();

