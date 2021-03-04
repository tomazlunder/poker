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
        this.answer_received = 0;

        this.timer = 0;
        this.logged = 0;
        this.winner = [];
	    this.acted = 0;
	    this.fold_win = 0

        this.state = 0;
		this.roundState = new RoundState();

        //Delta time for update loop
	    this.last_update = Date.now()
	    this.deltaTime = 0;
    }

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

	async removeZomibePlayers(){
		var promises = []

		for(var i = 0; i < this.seats.length; i++){
			if(this.seats[i]){
				if(this.seats[i].zombie == 1){
						var user = this.seats[i]
						promises.push(db.transferStackToBalance(user))

						user.balance = parseInt(user.balance)
						user.balance += parseInt(user.stack);
						user.stack = 0;
			
						user.socket.emit("newBalance", user.balance)

						console.log(this.room_id + ": removed zombie player ("+ this.seats[i].name+").")
						this.pidRoomMap.delete(this.seats[i].id_person)

						this.seats[i].socket.emit("listOutdated")
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
			if(this.state == 0){
				this.sendNamesStacks()
			} else if (this.state == 15){
				this.state = 0;
			}
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

    tryAction(socket_id, action, raise_number){
        if(this.roundState.to_act.socket.id == socket_id){
			if(this.acted == 1){
				return;
			}
			this.acted = 1;
			console.log(this.room_id + ": " + this.roundState.to_act.name + " " + action + " " +raise_number);
			this.message_received = 1;
			this.message_sent = 0;

			if(action == "raise"){
				var callsize = (this.roundState.bet_size - this.roundState.to_act.bet) //If raising into a raise
				console.log("t1 "+ callsize)
				callsize+= raise_number
				console.log("t2 "+ callsize)

				if(this.roundState.to_act.stack >= callsize){
					console.log(this.room_id + ": " +this.roundState.to_act.name + " raises ("+raise_number+").")
					this.roundState.to_act.stack -= callsize
					this.roundState.to_act.bet += callsize
					this.roundState.to_act.total_bet_size += callsize

					this.roundState.pot += callsize
					this.roundState.bet_size = this.roundState.to_act.bet

					if(this.roundState.to_act.stack == 0){
						console.log(this.room_id + ": " +this.roundState.to_act.name + " is all in (" + this.roundState.to_act.total_bet_size + ").")
						this.roundState.to_act.all_in = 1;
					}

					this.roundState.last_to_act = prevPlayer(this.seats.indexOf(this.roundState.to_act),this.seats)
					this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)

					this.sendGamestate();
					return
				}else{
					console.log(this.room_id + ": " + this.roundState.to_act.name + "tried to raise but doensn't have enough money.");
				}
			}

			if(action == "fold"){
				console.log(this.roundState.to_act.name + " folds.")

				this.roundState.to_act.alive = 0;
				if(alivePlayers(this.seats) == 1){
					this.winner.push(nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats))
					this.fold_win = 1;
					this.state = 12;

					this.sendGamestate();
					return;
				}

				//TODO: Check if winner

			}

			if(action == "checkcall"){
				if(this.roundState.to_act.bet < this.roundState.bet_size){
					var callsize = (this.roundState.bet_size - this.roundState.to_act.bet)

					if(this.roundState.to_act.stack >= callsize){
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
					this.sendGamestate();
				}
				else{
					//check
					console.log(this.room_id + ": " +this.roundState.to_act.name + " checks.")
				}
			}


			if(this.roundState.to_act == this.roundState.last_to_act){
				this.logged = 0;
				this.state++;
			} else {
				this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
			}

		}
		else{
			console.log(this.room_id + ": " + socket_id + "tried to act but it is not his turn.");
		}

    }

    betting(){
		if(!this.message_sent){
			//console.log("Betting...")
			//this.sendGamestate();
			if(this.roundState.to_act.all_in){
				//Skip calling for action, force "check"
				if(this.roundState.to_act != this.roundState.last_to_act){
					this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
                    this.message_sent = 0;
                    return;
				}

				console.log(this.room_id + ": " + this.roundState.to_act.name + "(all_in) forced skip");
				this.logged = 0;
				this.state++;
				return;
			} else {
                //If everyone else is all_in and player doesn't have to call -> force check
                var count = 0;
                for(var i in this.seats){
                    if(this.seats[i]){
                        if(this.seats[i].alive & this.seats[i].all_in == 0){
                            count++;
                        }
                    }
                }
                if(count == 1){
					console.log(this.roundState.bet_size)
                    if(this.roundState.to_act.bet == this.roundState.bet_size){
                        console.log(this.room_id + ": " + this.roundState.to_act.name + "forced check (everyone else all_in)");
                        this.logged = 0;
                        this.message_sent = 0;
                        this.state++;
						return;
                    }
                }
            }

			if(this.roundState.to_act.zombie){
				//Skip calling for action, force check/fold
				this.timer = timeForAction+1;
				console.log(this.room_id + ": " + this.roundState.to_act.name + "(zomibe) forced to act");
				this.message_sent = 1;
			}
			else{                
				this.io.to(this.room_id).emit('actionRequired', [this.roundState.to_act.name, timeForAction, this.roundState.bet_size]);
				console.log(this.room_id + ": " + this.roundState.to_act.name + " called to act");
				this.acted = 0;
				this.message_sent = 1;
				this.timer = 0;
			}
		}
		else{
			this.timer += this.deltaTime;
			//console.log(this.timer)
		}
	
		if(this.timer > timeForAction){
			this.message_sent = 0;
			this.timer = 0;
			this.acted = 0;
			
			//AUTO Check/FOLD
			//Fold
			if(this.roundState.to_act.bet < this.roundState.bet_size){
				console.log(this.room_id + ": " + this.roundState.to_act.name + " autofold (timeout)");

				this.roundState.to_act.alive = 0;

				if(alivePlayers(this.seats) == 1){
					this.winner.push(nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats))
					this.fold_win = true;
					this.logged = 0;
					this.state = 12;
					
					this.sendGamestate();
					return;
				}
			} 
			//Check
			else {
				console.log(this.room_id + ": " + this.roundState.to_act.name + " autocheck (timeout)");
			}
	
			if(this.roundState.to_act == this.roundState.last_to_act){
				this.state++;
				this.logged = 0;
			} else {
				this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)
			}
		}	
	}

    //Card turn states
	cardTurns(num_cards){
		this.logged = 0;
		this.roundState.bet_size = 0;
		resetPlayerBets(this.seats)

		this.roundState.to_act = nextPlayer(this.seats.indexOf(this.roundState.dealer), this.seats);
		this.roundState.last_to_act = prevPlayer(this.seats.indexOf(this.roundState.to_act), this.seats)

		//burn a card
		this.roundState.deckCounter++;

		//Reveal cards
		for(var i = 0; i < num_cards; i++){
			this.roundState.revealedCards.push(this.roundState.deck[this.roundState.deckCounter])
			this.roundState.deckCounter++
		}

		console.log(this.roundState.revealedCards)

		this.state++;
		this.sendRevealedCards();
		this.sendGamestate();
	}

    updateGame(){
		var now = Date.now();
		this.deltaTime = now - this.last_update;
		this.last_update = now;

		switch(this.state){
			//state 0 - Waiting for at least two players (LOOP)
			case 0:{
				this.removeZomibePlayers()

				if(this.logged == 0){
					console.log(this.room_id + ": (state0) waiting for players.")
					
					this.sendWaitingForPlayer();
					this.sendNamesStacks();
					this.logged = 1;
				}

				if(this.numberOfPlayers()>=2){
					this.state = 1;
					this.logged = 0;
				}
			} break;

			//state 1 - Round started
			case 1:{
				console.log(this.room_id + ": (state1) round started.")
				//Set SB,BB,Action,FTA, LTA
				resetPlayers(this.seats)

				var dealer, sb, bb, fta, lta
				
				if(this.dealer_prev < 0){
					dealer = firstNonNullPlayer(this.seats)
				}
				else{
					dealer = nextPlayer(this.dealer_prev, this.seats)
				}

				//Heads-up 2 player mode
				if(alivePlayers(this.seats) == 2){
					sb = dealer
					fta = sb
					bb = nextPlayer(this.seats.indexOf(dealer), this.seats)
					lta = bb
				}
				//Normal 3+ player poker
				else{
					sb = nextPlayer(this.seats.indexOf(dealer), this.seats)
					bb = nextPlayer(this.seats.indexOf(sb), this.seats)
					fta = nextPlayer(this.seats.indexOf(bb), this.seats)
					lta = bb
				}

				var deck = [...allCards]
				shuffleArray(deck)
				this.roundState = new RoundState(dealer,sb,bb,fta,lta,deck)

				//Send roundStarted to players
				this.io.to(this.room_id).emit('roundStarted');

				this.state = 2;
			} break;

			//state 2 compulsory bets
			case 2:{
				console.log(this.room_id + ": (state2) compulsory bets.")
				//Set Pot, Take from SB/BB, set starting bet size
				this.roundState.pot = 3*this.sb_size;
				this.roundState.sb.stack -= this.sb_size;
				this.roundState.bb.stack -= 2*this.sb_size;
				
				this.roundState.sb.bet = this.sb_size;
				this.roundState.bb.bet = 2*this.sb_size;
				this.roundState.sb.total_bet_size =  this.sb_size;
				this.roundState.bb.total_bet_size = 2*this.sb_size;


				this.roundState.bet_size = 2*this.sb_size;

				//TODO: SEND GAME STATE TO ROOM CLIENTS
				this.io.to(this.room_id).emit('compulsoryBets');

				this.sendGamestate();

				this.state = 3;
			} break;

			//state 3 - dealing
			case 3: {
				console.log(this.room_id + ": (state3) dealing.")
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
				this.state = 4;
			} break;

			//state 4 - betting 1
			case 4:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state4) betting1 (preflop).")
					this.logged = 1;
				}
				this.betting()
			} break;

			//state 5 - flop
			case 5:{
				console.log(this.room_id + ": (state5) flop.")
				this.cardTurns(3)
			} break;

			//state 6 - betting 2
			case 6:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state6) betting2.")
					this.logged = 1;
				}
				this.betting();
			} break;

			//state 7 - turn
			case 7:{
				console.log(this.room_id + ": (state7) turn.")
				this.cardTurns(1)
			} break;

			//state 8 - betting 3
			case 8:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state8) betting3.")
					this.logged = 1;
				}
				this.betting();
			}break;

			//state 9 - river
			case 9:{
				console.log(this.room_id + ": (state9) river.")

				this.cardTurns(1)
			} break;

			//state 10 - betting 4
			case 10:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state10) betting4.")
					this.logged = 1;
				}
				this.betting();
			} break;

			//state 11 - showdown
			case 11:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state11) showdown.")
					this.logged = 1;
					this.timer = 0;

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

				}
				else{
					this.timer+= this.deltaTime;
				}

				if(this.timer > showdownTime){
					this.state++;
					this.timer = 0;
					this.logged = 0;
				}


			} break;
			//state 12 - winner calc
			case 12:{
				console.log(this.room_id + ": (state12) Winner calculation.")

				if(this.fold_win){
					this.winner[0].stack+=this.roundState.pot
					this.state++;
					console.log(this.winner[0].name + " wins " + this.roundState.pot + " by folds")
					this.io.to(this.room_id).emit('winner', [this.winner[0].name, this.roundState.pot, "folds"]);

					return
				}

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
					console.log("plen " + players.length)
					//console.log(players)
					//console.log(hands)
					console.log(investment)

					min_stack = Math.min(...investment)

					console.log("min_stack" + min_stack)

					console.log("investments: " + investment)

					runningPot += players.length * min_stack;

					console.log("runningPot" + runningPot)


					for(var i = 0; i < investment.length; i++){
						investment[i]-= min_stack;
					}

					var winnerHands = Hand.winners(hands)
					console.log("num winners "+winnerHands.length)
					for(var i in winnerHands){
						var winningPlayer = handUserMap.get(winnerHands[i])

						winningPlayer.result += Math.floor(runningPot/winnerHands.length)

						console.log("winner: " + winningPlayer.name + " result+= " + Math.floor(runningPot/winnerHands.length))

						userHandMap.set(winningPlayer, winnerHands[i].descr)
					}

					var remove_ids = []
					for(var i in investment){
						if(investment[i] <= 0){
							remove_ids.push(i);
						}
					}

					console.log("investments: " + investment)

					console.log("remove ids" + remove_ids)

					for(var i = remove_ids.length-1; i >= 0; i--){
						console.log(remove_ids[i])
						//console.log(players[remove_ids[i]])
						console.log(investment[remove_ids[i]])

						players.splice(remove_ids[i],1)
						hands.splice(remove_ids[i],1)
						investment.splice(remove_ids[i],1)
					}

					console.log("investments: " + investment)


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
						}
					}
				}
				this.state++;
			} break;

			//state 13 - cleanup
			case 13:{
				console.log(this.room_id + ": (state13) Cleanup.")

				this.sendGamestate()

				this.logged = 0;
				this.winner = []
				this.acted = 0;
				this.message_sent = 0;
				this.fold_win = 0;

				this.state++;

				this.dealer_prev = this.seats.indexOf(this.roundState.dealer)
			} break;

			//state 14 waiting for new game... 
			case 14:{
				if(this.logged == 0){
					console.log(this.room_id + ": (state14) Waiting for new game....")
					this.io.to(this.room_id).emit("waitingForNewGame",timeAtEnd/1000)
					this.timer = 0;
					this.logged = 1;
				}
				else {
					this.timer+=this.deltaTime;
				}

				if(this.timer >= timeAtEnd){

                    for(var i in this.seats){
                        if(this.seats[i]){
                            //updateUserStack(this.seats[i])
							db.setPersonStack(this.seats[i].id_person, this.seats[i].stack)
    
                            if(this.seats[i].stack < this.sb_size){
                                //Remove player
                                this.seats[i].socket.emit("roomKick");
                                this.seats[i].zombie = 1;
                            }
                        } 
                    }

					this.logged = 0;
					this.timer = 0;
					this.state++;

					this.removeZomibePlayers()
					this.io.to(this.room_id).emit('resetGame');
				}
			} break;

			case 15:{
				//Waiting for zombie players to be removed and their balances updated
			} break;

			default:{
				console.log("[ERR]"+this.room_id+" Unknown state :" + this.state)
			} break;

		}
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

function prevPlayer(currentIndex, seats){	  
	var prev = currentIndex-1
	while(1){
	  if(prev < 0){
		prev = seats.length - 1;
	  }
	  if(!seats[prev]){
		prev = prev-1
		continue;
	  }
	  else{
		if(seats[prev].alive == 0){
		  prev = prev-1
		  continue;
		}
		else{
		  return seats[prev]
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
    constructor(dealer, sb, bb, to_act, last_to_act, deck){
        this.dealer = dealer; 
        this.sb = sb;
        this.bb = bb;
    
        this.to_act = to_act;
        this.last_to_act = last_to_act;
    
        this.deck = deck;
        this.deckCounter = 0;
        this.revealedCards = [];    

        this.bet_size = 0;
        this.pot = 0;
    }
}

exports.Room = Room;