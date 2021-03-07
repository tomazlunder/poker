var Hand = require('pokersolver').Hand;
var db = require('./db');

const allCards = ["2h", "3h", "4h", "5h", "6h", "7h", "8h", "9h", "Th", "Jh", "Qh", "Kh", "Ah",
      "2d", "3d", "4d", "5d", "6d", "7d", "8d", "9d", "Td", "Jd", "Qd", "Kd", "Ad",
      "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "Ts", "Js", "Qs", "Ks", "As",
      "2c", "3c", "4c", "5c", "6c", "7c", "8c", "9c", "Tc", "Jc", "Qc", "Kc", "Ac"]

const timeForAction = 22000;
const timeAtEnd = 12000;
const showdownTime = 2000;

class Room{
    constructor(io, room_id, sb_size, min_buy_in, max_buy_in, numPlayers, name, pidRoomMap){
        this.io = io;
        this.room_id = "room"+room_id
		this.min_buy_in = min_buy_in;
		this.max_buy_in = max_buy_in;
        this.sb_size = sb_size
		this.name = name;

		this.pidRoomMap = pidRoomMap;

        this.seats = []
        for(var i = 0; i < numPlayers; i++){
            this.seats.push(null);
        }

        this.dealer_prev = -1

        this.message_sent = 0;

        this.winner = [];
	    this.acted = 0;
	    this.fold_win = 0

        this.state = 0;
		this.roundState = new RoundState();

        //Delta time for update loop
	    this.last_update = Date.now()
	    this.deltaTime = 0;

		this.lastUpdateState = -1
		this.timer = 0;

		this.markedForShutdown = 0;

		this.timeoutID;

    }

	/* Functions for sending data */

    sendWaitingForPlayer(){
		console.log(this.room_id + ": waiting for players sent.")
		this.io.to(this.room_id).emit('waitingForPlayers');
    }

	sendNamesStacks(){
		var data;
		data = playerData(this.seats)
		var args = [data[0],data[2]]
		console.log(this.room_id + ": names and stacks sent.")
		this.io.to(this.room_id).emit('namesStacks',args);
	}
	
    sendMessage(){
        this.io.to(this.room_id).emit('message', message);
    }

    sendGamestate(){
        var args = []
		args.push(this.roundState.pot)
		var pData = playerData(this.seats)
		args = args.concat([pData[1]])
		args = args.concat([pData[2]])
		args = args.concat([pData[3]])

		this.io.to(this.room_id).emit('gameState', args);
    }

	sendRevealedCards(){
		this.io.to(this.room_id).emit("revealedCards", this.roundState.revealedCards)
	}

	//Removes zombie players from the game and updates DB
	async removeZomibePlayers(){
		var promises = []
		
		for(var i = 0; i < this.seats.length; i++){
			if(this.seats[i]){
				if(this.seats[i].zombie == 1 || this.seats[i].stack < this.sb_size*2){
					var user = this.seats[i]
					
					promises.push(db.transferStackToBalance(user))

					user.balance = parseInt(user.balance)
					user.balance += parseInt(user.stack);
					user.stack = 0;
		
					user.socket.emit("newBalance", user.balance)

					console.log(this.room_id + ": removed zombie player ("+ user.name+").")
					this.pidRoomMap.delete(user.id_person)

					user.socket.emit("listOutdated")
					this.seats[i] = null;

				}
			}
		}

		if(promises.length == 0){
			if(this.state == 15){
				this.state = 0;
			}

			return;
		}

		Promise.all([...promises]).then(values => {
			if (this.state == 15){
				this.state = 0;
			}
			this.sendNamesStacks()
		}).catch((err) => {
			console.log(err)
		})
	}

	numberOfPlayers(){
		var ret = 0;
		for(var i in this.seats){
			if(this.seats[i]){
				ret++;
			}
		}
		return ret;
	}

    getEmptySeatID(){
        var emptySeat = -1;
        for(var i in this.seats){
          if(!this.seats[i]){
            console.log("Found empty seat id: " + i)
            return i;
          }  
        }
      
        return emptySeat;
    }

	//Betting states
    betting(){
		this.sendGamestate();

		if(alivePlayers(this.seats) == 1){
			this.state = 7;
			this.updateState();
			return;
		}

		if(this.roundState.to_act.has_acted){
			this.state++;
			this.updateState();
			return;
		}

		//IF PLAYER TO ACT IS ALL IN
		if(this.roundState.to_act.all_in){

			//Skip calling for action, force him to check
			console.log(this.room_id + ": " + this.roundState.to_act.name + "(all_in) forced skip");
			this.roundState.to_act.has_acted = 1;
			this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
			this.betting();
			return;
			
		} 

		//IF EVERYONE ELSE IS ALL IN AND DOESN'T HAVE TO CALL
		var count = 0;
		for(var i in this.seats){
			if(this.seats[i]){
				if(this.seats[i].alive & this.seats[i].all_in == 0){
					count++;
				}
			}
		}
		if(count == 1){
			if(this.roundState.to_act.bet == this.roundState.bet_size){
				console.log(this.room_id + ": " + this.roundState.to_act.name + "forced check (everyone else all_in)");
				return;
			}
		}
            
		var actualTimeForAction = timeForAction;

		//IF TO ACT IS A ZOMBIE (LEFT THE TABLE SCREEN) TODO
		if(this.roundState.to_act.zombie){
			//Skip calling for action, force check/fold
			console.log(this.room_id + ": " + this.roundState.to_act.name + "(zomibe) forced to act");
			actualTimeForAction = 0;
		}

		//SEND PLAYER THE ACTION REQUIRED MESSAGE
		else{
			//this.sendGamestate();
			this.io.to(this.room_id).emit('actionRequired', [this.roundState.to_act.name, actualTimeForAction, this.roundState.bet_size]);
			this.acted = 0;
			console.log(this.room_id + ": " + this.roundState.to_act.name + " called to act");
		}

		//Default action after timeout (canceled by clearning interval when acting)

		this.timeoutID = setTimeout(() => {this.autoCheckFold()},
		actualTimeForAction);

	}

	autoCheckFold(){
		this.roundState.to_act.has_acted = 1;

		//AUTO FOLD
		if(this.roundState.to_act.bet < this.roundState.bet_size){
			console.log(this.room_id + ": " + this.roundState.to_act.name + " autofold (timeout)");

			this.roundState.to_act.alive = 0;
		} 
		//AUTO CHECK
		else {
			console.log(this.room_id + ": " + this.roundState.to_act.name + " autocheck (timeout)");
		}

		if(this.roundState.to_act == this.roundState.last_to_act){
		} else {
			this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
		}

		clearInterval(this.timeoutID)
		this.betting();
	}

	//Handle received player action
    tryAction(id_person, action, raise_number){
        if(this.roundState.to_act.id_person == id_person){
			//If player acted already
			if(this.acted == 1){
				return;
			}
			this.acted = 1;

			console.log(this.room_id + ": " + this.roundState.to_act.name + " " + action + " " +raise_number);

			if(action == "raise"){
				var callsize = (this.roundState.bet_size - this.roundState.to_act.bet) //If raising into a raise
				console.log("t1 "+ callsize)
				callsize+= raise_number
				console.log("t2 "+ callsize)

				if(this.roundState.to_act.stack >= callsize){
					console.log(this.room_id + ": " +this.roundState.to_act.name + " raises ("+raise_number+").")
					clearInterval(this.timeoutID) //Clear timeout

					resetPlayersHasActed(this.seats);
					this.roundState.to_act.has_acted = 1;

					this.roundState.to_act.stack -= callsize
					this.roundState.to_act.bet += callsize
					this.roundState.to_act.total_bet_size += callsize

					this.roundState.pot += callsize
					this.roundState.bet_size = this.roundState.to_act.bet

					if(this.roundState.to_act.stack == 0){
						console.log(this.room_id + ": " +this.roundState.to_act.name + " is all in (" + this.roundState.to_act.total_bet_size + ").")
						this.roundState.to_act.all_in = 1;
					}

					this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)

					this.betting();
					return
				}else{
					console.log(this.room_id + ": " + this.roundState.to_act.name + "tried to raise but doensn't have enough money.");
					this.acted = 0; //Can try to send a new action (this should not happen)
				}
			}

			if(action == "fold"){
				console.log(this.roundState.to_act.name + " folds.")
				clearInterval(this.timeoutID) //Clear timeout
				this.roundState.to_act.has_acted = 1;
				this.roundState.to_act.alive = 0;

				this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
				this.betting();
				return
			}

			if(action == "checkcall"){
				if(this.roundState.to_act.bet < this.roundState.bet_size){
					var callsize = (this.roundState.bet_size - this.roundState.to_act.bet)

					if(this.roundState.to_act.stack >= callsize){
						//CALL
						console.log(this.room_id + ": " +this.roundState.to_act.name + " calls (" + callsize + ").")
						this.roundState.pot += callsize
						this.roundState.to_act.total_bet_size += callsize
						this.roundState.to_act.stack -= callsize
						this.roundState.to_act.bet = this.roundState.bet_size

						if(this.roundState.to_act.stack == 0){
							console.log(this.room_id + ": " +this.roundState.to_act.name + " is all in (" + this.roundState.to_act.total_bet_size + ").")
							this.roundState.to_act.all_in = 1;
						}

					}
					else{
						//ALL IN
						this.roundState.to_act.all_in = 1;
						callsize = this.roundState.to_act.stack;
						console.log(this.room_id + ": " +this.roundState.to_act.name + " part-calls all in(" + callsize + ").")
						this.roundState.pot += callsize
						this.roundState.to_act.total_bet_size += callsize
						this.roundState.to_act.stack -= callsize
						this.roundState.to_act.bet = this.roundState.bet_size
					}
				}
				else{
					//check
					console.log(this.room_id + ": " +this.roundState.to_act.name + " checks.")
				}
			}

			clearInterval(this.timeoutID) //Clear timeout
			this.roundState.to_act.has_acted = 1;

			this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
			this.betting()
		}
		else{
			console.log(this.room_id + ": " + id_person + "tried to act but it is not his turn.");
		}
    }

    //Card turn states
	cardTurns(num_cards){
		this.roundState.bet_size = 0;
		resetPlayerBets(this.seats)

		this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.dealer), this.seats);

		//burn a card
		this.roundState.deckCounter++;

		//Reveal cards
		for(var i = 0; i < num_cards; i++){
			this.roundState.revealedCards.push(this.roundState.deck[this.roundState.deckCounter])
			this.roundState.deckCounter++
		}

		console.log(this.roundState.revealedCards)

		this.sendRevealedCards();
	}

	//Result calculation
	calculateResults(){
		var handUserMap = new Map()
		var userHandMap = new Map()
		var hands = []
		var players = []
		var investment = []

		for(var i = 0; i < this.seats.length; i++){
			if(this.seats[i]){
				this.seats[i].result = 0; //new
				players.push(this.seats[i]);
				investment.push(this.seats[i].total_bet_size)
				if(this.seats[i].alive){
					var hand = Hand.solve(this.roundState.revealedCards.concat(this.seats[i].cards))
					handUserMap.set(hand, this.seats[i])
					hands.push(hand)
				}
			}
		}

		var min_stack;
		var runningPot = 0;
		while(players.length > 1){
			min_stack = Math.min(...investment)
			runningPot += players.length * min_stack;

			for(var i = 0; i < investment.length; i++){
				investment[i]-= min_stack;
			}

			var winnerHands = Hand.winners(hands)
			for(var i in winnerHands){
				var winningPlayer = handUserMap.get(winnerHands[i])

				winningPlayer.result += Math.floor(runningPot/winnerHands.length)

				console.log("["+this.room_id +"] Winner: " + winningPlayer.name + " result+= " + Math.floor(runningPot/winnerHands.length))

				userHandMap.set(winningPlayer, winnerHands[i].descr)
			}

			var remove_ids = []
			for(var i in investment){
				if(investment[i] <= 0){
					remove_ids.push(i);
				}
			}

			for(var i = remove_ids.length-1; i >= 0; i--){

				players.splice(remove_ids[i],1)
				hands.splice(remove_ids[i],1)
				investment.splice(remove_ids[i],1)
			}

			if(players.length == 1){
				//return uncalled bet
				console.log("Return uncalled bet "+players[0].name+" "+investment[0])
				players[0].result += investment[0]
			}

			runningPot = 0;
		}
		
		for(var i in this.seats){
			if(this.seats[i]){
				if(this.seats[i].result > 0){
					this.seats[i].stack+=this.seats[i].result;
					this.io.to(this.room_id).emit('winner', [this.seats[i].name, this.seats[i].result, userHandMap.get(this.seats[i])]);

					//Add result to winnings
					db.changeWinnings(this.seats[i].id_person, this.seats[i].result-this.seats[i].total_bet_size)
				}

				else {
					//Remove investment from winnings
					db.changeWinnings(this.seats[i].id_person, -this.seats[i].total_bet_size)
				}
			}
		}
		
		this.state++;
		this.updateState();
	}

	startRoom(){
		this.state = 0;
		this.updateState();
	}

	async updateState(){
		switch(this.state){
			case 0:{
				console.log(this.room_id + ": (state0) waiting for players.")
				this.removeZomibePlayers();

				this.sendWaitingForPlayer();
				this.sendNamesStacks();
			

				if(this.numberOfPlayers()<2){
					break;
				}
				this.state = 1;

				//Setting up game (state = 1)
				// Blinds and stuff
				console.log(this.room_id + ": (state1) round starting.")
				this.io.to(this.room_id).emit('roundStarted');
				resetPlayers(this.seats)

				var dealer, sb, fta, bb, lta;

				if(this.dealer_prev < 0){
					dealer = firstNonNullPlayer(this.seats)
				}
				else{
					dealer = nextPlayer(this.dealer_prev, this.seats)
				}
				this.dealer_prev = this.seats.indexOf(dealer);

				//  Heads-up 2 player mode
				if(alivePlayers(this.seats) == 2){
					sb = dealer
					fta = sb
					bb = nextPlayer(this.seats.indexOf(dealer), this.seats)
					lta = bb
				}
				//  Normal 3+ player poker
				else{
					sb = nextPlayer(this.seats.indexOf(dealer), this.seats)
					bb = nextPlayer(this.seats.indexOf(sb), this.seats)
					fta = nextPlayer(this.seats.indexOf(bb), this.seats)
					lta = bb
				}

				//Compulsory bets
				console.log(this.room_id + ": (state1) compulsory bets.")
				sb.stack -= this.sb_size;
				bb.stack -= 2*this.sb_size;
				
				sb.bet = this.sb_size;
				bb.bet = 2*this.sb_size;

				sb.total_bet_size =  this.sb_size;
				bb.total_bet_size = 2*this.sb_size;

				//Create new round 
				this.roundState = new RoundState(dealer,sb,bb,fta,lta)

				this.roundState.pot = 3*this.sb_size;
				this.roundState.bet_size = 2*this.sb_size;

				this.sendGamestate();

				//Dealing
				console.log(this.room_id + ": (state1) dealing.")
				for(var i in this.seats){
					var player = this.seats[i]
					if(player){
						player.cards.push(this.roundState.deck[this.roundState.deckCounter])
						this.roundState.deckCounter++;
						player.cards.push(this.roundState.deck[this.roundState.deckCounter])
						this.roundState.deckCounter++;
						console.log(this.room_id + ": " + player.name + " => " + player.cards)

						//Send cards to players
						this.io.to(player.socket.id).emit("drawnCards", player.cards);				
					}
				}

				//Betting (preflop)
				this.state = 2;
				console.log(this.room_id + ": (state2) betting1 [preflop].")
				this.betting()
			} break;

			case 3:{
				console.log("Betting complete")
				if(alivePlayers(this.seats) == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(3);
				resetPlayersHasActed(this.seats);
				this.betting();
			} break;

			case 4:{
				console.log("Betting complete")
				if(alivePlayers(this.seats) == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(1);
				resetPlayersHasActed(this.seats);
				this.betting();
			} break;

			case 5:{
				if(alivePlayers(this.seats) == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(1);
				resetPlayersHasActed(this.seats);
				this.betting();
			}

			case 6:{
				//Showdown
				var hands = [];
				for(var i in this.seats){
					if(this.seats[i]){
						if(this.seats[i].alive){
							hands.push(this.seats[i].cards)
						}else{
							hands.push(null)
						}
					}else{
						hands.push(null)
					}
				}

				this.io.to(this.room_id).emit('showdown', hands)

				this.state = 7;
			}

			case 7:{
				this.calculateResults();
			} break;

			case 8:{
				console.log(this.room_id + ": (state8) Waiting for new game....")
				this.io.to(this.room_id).emit("waitingForNewGame",timeAtEnd/1000)

				setTimeout(() => {this.resetGame()}, timeAtEnd)
			}
		}
	}

	resetGame() {
		console.log("Resetting game")
		for(var i in this.seats){
			if(this.seats[i]){
				db.setPersonStack(this.seats[i].id_person, this.seats[i].stack)

				if(this.seats[i].stack < this.sb_size){
					this.seats[i].socket.emit("roomKick");
					this.seats[i].zombie = 1;
				}
			} 
		}

		console.log(this.room_id)
		this.io.to(this.room_id).emit('resetGame');

		this.removeZomibePlayers()

		console.log("Start")

		this.startRoom()
	}
}

function playerData(seats){
	var names = []
	var bets = []
	var stacks = []
	var alive = []
	for(var i in seats){
		if(seats[i]){
			names.push(seats[i].name)
			bets.push(seats[i].bet)
			stacks.push(seats[i].stack)
			alive.push(seats[i].alive)
		}
		else{
			names.push(null)
			bets.push(null)
			stacks.push(null)
			alive.push(null)
		}
	}
	return [names,bets,stacks,alive]
}

function resetPlayers(seats){
	for(var i in seats){
	  if(seats[i]){
		seats[i].bet = 0
		seats[i].alive = 1
		seats[i].cards = []
		seats[i].total_bet_size = 0;
		seats[i].all_in = 0;
		seats[i].has_acted = 0;
	  }
	}
}

function resetPlayersHasActed(seats){
	for(var i in seats){
	  if(seats[i]){
		seats[i].has_acted = 0;
	  }
	}
}

function resetPlayerBets(seats){
	for(var i in seats){
	  if(seats[i]){
		seats[i].bet = 0
	  }
	}
}

function firstNonNullPlayer(seats){
	for(var i in seats){
	  if(seats[i]){
		return seats[i]
	  }
  }
}

function alivePlayers(seats){
	var counter = 0
	for(var i in seats){

		if(seats[i]){
			if(seats[i].alive){
				counter++
			}
		}
	}
	return counter
}

function nextPlayer(currentIndex, seats){	  
	var next = currentIndex+1
	while(1){
	  if(next == currentIndex){
		  console.err("["+this.room_id+"] next player not found!")
	  }

	  if(next >= seats.length){
		next = 0;
	  }
	  if(!seats[next]){
		next = next+1
		continue;
	  }
	  else{
		if(seats[next].alive == 0){
		  next = next+1
		  continue;
		}
		else{
		  return seats[next]
		}
	  }
	}
}

function shuffleArray(array) {
	for (var i = array.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
}

class RoundState{
    constructor(dealer, sb, bb, to_act, last_to_act){
        this.dealer = dealer; 
        this.sb = sb;
        this.bb = bb;
    
        this.to_act = to_act;
        this.last_to_act = last_to_act;

		var newDeck = [...allCards]
		shuffleArray(newDeck)
        this.deck = newDeck;
        this.deckCounter = 0;
        this.revealedCards = [];    

        this.bet_size = 0;
        this.pot = 0;
    }
}

exports.Room = Room;