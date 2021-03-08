var ARoom = require('./abstractRoom.js')
var db = require('./db.js');

class Tournament extends ARoom.AbstractRoom{
    constructor(io, id, name, numPlayers, minPlayers, playerRoomMap,  sb_size, entry_fee, chips_per, loops_till_increase, rewards){
        super(io, id, name, numPlayers, minPlayers, sb_size, playerRoomMap);

        //Room specific 
		this.entry_fee = entry_fee;
		this.chips_per = chips_per;
		this.loops_till_increase = loops_till_increase;
		this.rewards = rewards;

		this.bustedPlayers = []
    }

    async endTournament(){
        console.log("End tournament TODO")
        //TODO
    }

    async postGame(){
        console.log("Resetting game")
        console.log(this.room_id)
        this.io.to(this.room_id).emit('resetGame');

        for(var i in this.seats){
            if(this.seats[i]){
                if(this.seats[i].stack < this.sb_size * 2){
                    this.seats[i].busted = 1;
                    bustedPlayers.push(busted);
                }
            }
        }
        if(this.numberOfNonBustedPlayers(this.seats) == 1){
            this.endTournament();
            return;
        } else {
            this.roomState = 1;
            this.updateState();
        }
    
        //In tournaments players are not removed till the end
        //this.removePlayers()

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

    async joinRoom(user){
        if(this.roomState != 0){
            console.log("Tournament already started");
            //TODO: Emit

            return;
        }

        var seatId = this.getEmptySeatID()
		if(seatId >= 0){
			try{
				console.log(user.id_person)
				const response = await db.tryDecreaseBalance(user.id_person, this.entry_fee)

				user.balance -= this.entry_fee

				user.stack = this.chips_per;
				user.zombie = 0
				user.alive = 0

                //Stack in db is set as entry fee for the tournament
                //In case of server crash entry fee is returned
				const response2 = await db.setPersonStack(user.id_person, this.entry_fee)

				this.seats[seatId] = user
				console.log(this.room_id + ": join room sucessful ("+user.name+")")
				user.socket.emit("roomJoined",[this.room_id, seatId, user.balance])
				user.socket.join(this.room_id);

				this.playerRoomMap.set(user.id_person, this)
 
				if(this.roomState == 0){
					this.updateState();
				}
				this.sendNamesStacks()
				this.sendGamestate();
			} catch (err) {
                console.log("Room join error")
				console.log(err)
			}
		}
		else{
			user.socket.emit("roomFull")
			console.log("Selected room is full.");
		}
    }

    async removePlayers(){
        //If tournament has not started yet
        if(this.roomState == 0){
            var promises = []
		
            for(var i = 0; i < this.seats.length; i++){
                if(this.seats[i]){
                    if(this.seats[i].zombie == 1 || this.markedForShutdown == 1){
                        var user = this.seats[i]
                        
                        //Return entry fee
                        promises.push(db.tryIncreaseBalance(user.id_person, this.entry_fee))
    
                        user.balance = parseInt(user.balance)
                        user.balance += parseInt(this.entry_fee);
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
}

exports.Tournament = Tournament;