var ARoom = require('./abstractRoom.js')
var db = require('./db.js');

class Tournament extends ARoom.AbstractRoom{
    constructor(io, id, name, numPlayers, minPlayers, playerRoomMap,  sb_size, entry_fee, chips_per, loops_till_increase, rewards, continuous){
        super(io, id, name, numPlayers, minPlayers, sb_size, playerRoomMap);

        this.type = "tournament"

        //Room specific 
		this.entry_fee = entry_fee;
		this.chips_per = chips_per;
		this.loops_till_increase = loops_till_increase;
		this.rewards = rewards;

        this.continuous = continuous;

		this.bustedPlayers = []
    }

    startRoom(){
        this.bustedPlayers = []

        super.startRoom();
    }

    async endTournament(){
        console.log("End tournament TODO")
        //TODO
        var reversed = this.bustedPlayers.reverse();

        //Send tournament end to players
        var reversedNames = []
        for(var i in reversed){
            reversedNames.push(reversed[i].name)
        }

        for(var i in reversed){
                var player = reversed[i]
            
                if(this.rewards[i] > 0){
                    try{
                        db.tryIncreaseBalance(player.id_person, this.rewards[i])

                        player.balance += this.rewards[i]
                        player.socket.emit("newBalance", player.balance)
                     } catch (err){
                        console.log("Tournament reward error")
                        console.log(err)
                    }
                }
                player.stack = 0;

                //TODO: Change this to some kind of tournament kick (stays on game screen with results)
                player.socket.emit("tournamentEnd",[reversedNames, this.rewards]);

                console.log(this.room_id + ": removed player ("+ player.name+").")
                this.playerRoomMap.delete(player.id_person)

                player.socket.emit("listOutdated")
                this.seats[this.seats.indexOf(player)] = null;
        }

        if(this.continuous && !this.markedForShutdown){
            this.roomState = 0;
            this.updateState();
            return;
        }

        this.markedForShutdown = 0;
        this.running = 0;
    }

    async postGame(){
        console.log("Resetting game")
        this.gameState.state = 0;

        this.io.to(this.room_id).emit('resetGame');

        for(var i in this.seats){
            if(this.seats[i]){
                if(this.seats[i].stack == 0 && this.seats[i].busted == 0){
                    this.seats[i].busted = 1;
                    this.bustedPlayers.push(this.seats[i]);
                }
            }
        }
        if(this.numberOfNonBustedPlayers(this.seats) == 1){
            this.bustedPlayers.push(this.getLastPlayer())
            this.endTournament();
            return;
        } else {
            this.roomState = 1;
            this.updateState();
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
                user.busted = 0

                //Stack in db is set as entry fee for the tournament
                //In case of server crash entry fee is returned
				const response2 = await db.setPersonStack(user.id_person, this.entry_fee)

				this.seats[seatId] = user
				console.log(this.room_id + ": join room sucessful ("+user.name+")")
				user.socket.emit("roomJoined",[this.type,this.room_id, seatId, user.balance])
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

    numberOfNonBustedPlayers(){
        var ret = 0;
        for(var i in this.seats){
            if(this.seats[i]){
                if(this.seats[i].busted == 0){
                    ret++;
                }
            }
        }
        return ret;
    }

    getLastPlayer(){
        var ret = null;
        for(var i in this.seats){
            if(this.seats[i]){
                if(this.seats[i].busted == 0){
                    ret = this.seats[i]
                }
            }
        }
        return ret;
    }
}

exports.Tournament = Tournament;