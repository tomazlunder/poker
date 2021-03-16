var ARoom = require('./abstractRoom.js')
var db = require('./db.js');

class Room extends ARoom.AbstractRoom{
    constructor(io, id, name, numPlayers, playerRoomMap,  sb_size, min_buy_in, max_buy_in){
        super(io, id, name, numPlayers, 2, sb_size, playerRoomMap);

		this.type = "room"

        //Room specific 
        this.min_buy_in = min_buy_in;
        this.max_buy_in = max_buy_in;
    }

    async postGame(){
        //Change winnings in DB
		for(var i in this.seats){
			if(this.seats[i]){
				if(this.seats[i].result > 0){
					//Add result to winnings
					db.changeWinnings(this.seats[i].id_person, this.seats[i].result-this.seats[i].total_bet_size)
				}

				else {
					//Remove investment from winnings
					db.changeWinnings(this.seats[i].id_person, -this.seats[i].total_bet_size)
				}
			}
		}

		if(this.splitTip > 0){
			//TODO: Do something
		}

        console.log("Resetting game")
        console.log(this.room_id)
        this.io.to(this.room_id).emit('resetGame');
    
        for(var i in this.seats){
            if(this.seats[i]){
                 db.setPersonStack(this.seats[i].id_person, this.seats[i].stack)
            } 
        }
    
        this.removePlayers()

        console.log("Round ended")

		if(!this.markedForShutdown){
			this.roomState = 0;
            this.gameState.state = 0;
            this.updateState();
            return;
		} else {
			console.log(this.room_id + ": has shut down.")
			this.running = 0;
			this.markedForShutdown = 0;
            return;
		}
    }

    async joinRoom(user, buy_in){
        var seatId = this.getEmptySeatID()
		if(seatId >= 0){
			try{
				console.log(user.id_person)
				const response = await db.tryDecreaseBalance(user.id_person, buy_in)

				user.balance -= buy_in

				user.stack = buy_in
				user.zombie = 0
				user.alive = 0

				const response2 = await db.setPersonStack(user.id_person, user.stack)

				this.seats[seatId] = user
				console.log(this.room_id + ": join room sucessful ("+user.name+")")
				user.socket.emit("roomJoined",[this.type,this.room_id, seatId, user.balance, this.min_buy_in, this.max_buy_in])
				user.socket.join(this.room_id);

				this.playerRoomMap.set(user.id_person, this)
 
				if(this.roomState == 0){
					this.updateState();
				}
				this.sendNamesStacks()
				this.sendGamestate();
			} catch (err) {
				console.log(err)
			}
		}
		else{
			user.socket.emit("roomFull")
			console.log("Selected room is full.");
		}
    }

    async removePlayers(){
		var promises = []
		
		for(var i = 0; i < this.seats.length; i++){
			if(this.seats[i]){
				if(this.seats[i].zombie == 1 || this.seats[i].stack == 0  || this.markedForShutdown == 1){
					var user = this.seats[i]
					
					promises.push(db.transferStackToBalance(user))

					user.balance = parseInt(user.balance)
					user.balance += parseInt(user.stack);
					user.stack = 0;
		
					user.socket.emit("newBalance", user.balance)
					this.seats[i].socket.emit("roomKick");

					console.log(this.room_id + ": removed zombie player ("+ user.name+").")
					this.playerRoomMap.delete(user.id_person)

					user.socket.emit("listOutdated")
					this.seats[i] = null;

				}
			}
		}

		Promise.all([...promises]).then(values => {
            if(promises.length > 0){
                this.sendNamesStacks()
            }
		}).catch((err) => {
			console.log(err)
		})
	}
}

exports.Room = Room;