var Hand = require('pokersolver').Hand;
var gs = require('./gameState');

const timeForAction = 22000;
const timeAtEnd = 12000;

class AbstractRoom{
    constructor(io, id, name, numPlayers, minPlayers, sb_size, playerRoomMap){
        this.io = io;
        this.room_id = id;
        this.name = name;
        this.numPlayers = numPlayers;
		this.sb_size = sb_size;
        this.playerRoomMap = playerRoomMap;
        this.minPlayers = minPlayers

        this.seats = []
        for(var i = 0; i < numPlayers; i++){
            this.seats.push(null);
        }

		this.roomState = 0;
		this.fold_win;

        this.running = 0;
        this.markedToStop = 0;

        this.gameState = new gs.GameState(null,null);
        this.timeoutID;
        this.acted;

        this.roomState = 0; //0 - waiting for players, 1 - game started, 2 - game finished
        this.dealer_prev = null

		this.splitTip = 0;
    }

    startRoom(){
        this.running = 1;
        this.markedToStop = 0;
        this.roomState = 0;
		this.dealer_prev = null;
		this.gameState = new gs.GameState(null,null);

        this.seats = []
        for(var i = 0; i < this.numPlayers; i++){
            this.seats.push(null);
        }

        //this.gameState = newGameState();

        console.log(this.room_id + ": started.")
		this.updateState();
    }

    updateState(){
        switch(this.roomState){
            case 0:{
                console.log(this.room_id + ": (state0) waiting for players.")
				this.removePlayers();

				if(this.markedToStop){
					this.running = 0;
					console.log(this.room_id + ": has shut down.")
					return;
				}

				this.sendWaitingForPlayer();
				this.sendNamesStacks();

                if(this.numberOfPlayers()<this.minPlayers){
                    break;
                }

				this.roomState = 1;
            }
            case 1:{
                this.updateGame();
                break;
            }
            case 2:{
                console.log(this.room_id + ": (state8) Waiting for new game....")
				this.io.to(this.room_id).emit("waitingForNewGame",timeAtEnd/1000)

				setTimeout(() => {this.postGame()}, timeAtEnd)
                break;
            }
        }
    }

    updateGame(){
        switch(this.gameState.state){
			case 0:{
				//Setting up game (state = 1)
				// Blinds and stuff
				console.log(this.room_id + ": (state1) round starting.")
				this.io.to(this.room_id).emit('roundStarted');
				this.resetPlayers()

				this.fold_win = 1;

				var dealer, sb, fta, bb, lta;

				if(this.dealer_prev < 0){
					dealer = this.firstNonNullPlayer()
				}
				else{
					dealer = this.nextPlayer(this.dealer_prev)
				}
				this.dealer_prev = this.seats.indexOf(dealer);

				//  Heads-up 2 player mode
				if(this.alivePlayers() == 2){
					sb = dealer
					fta = sb
					bb = this.nextPlayer(this.seats.indexOf(dealer))
					lta = bb
				}
				//  Normal 3+ player poker
				else{
					sb = this.nextPlayer(this.seats.indexOf(dealer))
					bb = this.nextPlayer(this.seats.indexOf(sb))
					fta = this.nextPlayer(this.seats.indexOf(bb))
					lta = bb
				}

				//Compulsory bets
				console.log(this.room_id + ": (state1) compulsory bets.")
				/*
				sb.stack -= this.sb_size;
				bb.stack -= 2*this.sb_size;
				
				sb.bet = this.sb_size;
				bb.bet = 2*this.sb_size;

				sb.total_bet_size =  this.sb_size;
				bb.total_bet_size = 2*this.sb_size;
				*/
				if(sb.stack >= this.sb_size){
					sb.bet = this.sb_size;
				} else {
					sb.bet = sb.stack;
					sb.all_in = 1;
				}

				sb.total_bet_size = sb.bet;
				sb.stack -= sb.bet;

				if(bb.stack >= this.sb_size * 2){
					bb.bet = this.sb_size * 2;
				} else {
					bb.bet = bb.stack;
					bb.all_in = 1;
				}

				bb.total_bet_size = bb.bet;
				bb.stack -= bb.bet;

				//If after obligatory bets one of the blinds has 0 chips remaining, all in
				if(sb.stack == 0){
					sb.all_in = 1;
				}
				if(bb.stack == 0){
					bb.all_in = 1;
				}

				//Create new round 
				this.gameState = new gs.GameState(dealer,fta)

				this.gameState.pot = sb.bet + bb.bet;
				this.gameState.bet_size = Math.max(sb.bet, bb.bet) //In case sb is all in

				this.sendGamestate();

				//Dealing
				console.log(this.room_id + ": (state1) dealing.")
				for(var i in this.seats){
					var player = this.seats[i]
					if(player){
						player.cards.push(this.gameState.deck[this.gameState.deckCounter])
						this.gameState.deckCounter++;
						player.cards.push(this.gameState.deck[this.gameState.deckCounter])
						this.gameState.deckCounter++;
						console.log(this.room_id + ": " + player.name + " => " + player.cards)

						//Send cards to players
						this.io.to(player.socket.id).emit("drawnCards", player.cards);				
					}
				}

				//Betting (preflop)
				this.gameState.state = 1;
				console.log(this.room_id + ": (state2) betting1 [preflop].")
				this.betting()
			} break;

			case 2:{
				console.log("Betting complete")
				if(this.alivePlayers() == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(3);
				this.resetPlayersHasActed();
				this.betting();
			} break;

			case 3:{
				console.log("Betting complete")
				if(this.alivePlayers() == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(1);
				this.resetPlayersHasActed();
				this.betting();
			} break;

			case 4:{
				if(this.alivePlayers() == 1){
					this.calculateResults();
					return;
				} 
				this.cardTurns(1);
				this.resetPlayersHasActed();
				this.betting();
			} break;

			case 5:{
				//Showdown
				this.fold_win = 0;
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

				this.gameState.state = 6;
			}

			case 6:{
				this.calculateResults();
			} break;
        }
    }

    async postGame(){
        throw new Error("Method 'postGame()' must be implemented.");
    }

    /*
    newGameState(){
        throw new Error("Method 'newGameState()' must be implemented.");
    }
    */

    playerJoin(user){
        //Currently handeled by app
        throw new Error("Method 'playerJoin()' must be implemented.");
    }

    removePlayers(user){
        throw new Error("Method 'removePlayers()' must be implemented.");
    }


    tryAction(id_person, action, arg){
        if(this.gameState.to_act.id_person == id_person){
			//If player acted already
			if(this.acted == 1){
				return;
			}
			this.acted = 1;

			console.log(this.room_id + ": " + this.gameState.to_act.name + " " + action + " " +arg);

			if(action == "raise"){
				var callsize = (this.gameState.bet_size - this.gameState.to_act.bet) //If raising into a raise
				console.log("t1 "+ callsize)
				callsize+= arg
				console.log("t2 "+ callsize)

				if(this.gameState.to_act.stack >= callsize){
					console.log(this.room_id + ": " +this.gameState.to_act.name + " raises ("+arg+").")
					clearInterval(this.timeoutID) //Clear timeout

					this.resetPlayersHasActed();
					this.gameState.to_act.has_acted = 1;

					this.gameState.to_act.stack -= callsize
					this.gameState.to_act.bet += callsize
					this.gameState.to_act.total_bet_size += callsize

					this.gameState.pot += callsize
					this.gameState.bet_size = this.gameState.to_act.bet

					if(this.gameState.to_act.stack == 0){
						console.log(this.room_id + ": " +this.gameState.to_act.name + " is all in (" + this.gameState.to_act.total_bet_size + ").")
						this.gameState.to_act.all_in = 1;
					}

					this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.to_act))

					this.betting();
					return
				}else{
					console.log(this.room_id + ": " + this.gameState.to_act.name + "tried to raise but doesn't have enough chips.");
					this.acted = 0; //Can try to send a new action (this should not happen)
				}
			}

			if(action == "fold"){
				console.log(this.gameState.to_act.name + " folds.")
				clearInterval(this.timeoutID) //Clear timeout
				this.gameState.to_act.has_acted = 1;
				this.gameState.to_act.alive = 0;

				this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.to_act))
				this.betting();
				return
			}

			if(action == "checkcall"){
				if(this.gameState.to_act.bet < this.gameState.bet_size){
					var callsize = (this.gameState.bet_size - this.gameState.to_act.bet)

					if(this.gameState.to_act.stack >= callsize){
						//CALL
						console.log(this.room_id + ": " +this.gameState.to_act.name + " calls (" + callsize + ").")
						this.gameState.pot += callsize
						this.gameState.to_act.total_bet_size += callsize
						this.gameState.to_act.stack -= callsize
						this.gameState.to_act.bet = this.gameState.bet_size

						if(this.gameState.to_act.stack == 0){
							console.log(this.room_id + ": " +this.gameState.to_act.name + " is all in (" + this.gameState.to_act.total_bet_size + ").")
							this.gameState.to_act.all_in = 1;
						}

					}
					else{
						//ALL IN
						this.gameState.to_act.all_in = 1;
						callsize = this.gameState.to_act.stack;
						console.log(this.room_id + ": " +this.gameState.to_act.name + " part-calls all in(" + callsize + ").")
						this.gameState.pot += callsize
						this.gameState.to_act.total_bet_size += callsize
						this.gameState.to_act.stack -= callsize
						this.gameState.to_act.bet = this.gameState.bet_size
					}
				}
				else{
					//check
					console.log(this.room_id + ": " +this.gameState.to_act.name + " checks.")
				}
			}

			clearInterval(this.timeoutID) //Clear timeout
			this.gameState.to_act.has_acted = 1;

			this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.to_act))
			this.betting()
		}
		else{
			console.log(this.room_id + ": " + id_person + "tried to act but it is not his turn.");
		}
    }

    betting(){
		this.sendGamestate();

		if(this.alivePlayers() == 1){
			this.gameState.state = 6;
			this.updateState();
			return;
		}

		if(this.gameState.to_act.has_acted){
			this.gameState.state++;
			this.updateState();
			return;
		}

		//IF PLAYER TO ACT IS ALL IN
		if(this.gameState.to_act.all_in){

			//Skip calling for action, force him to check
			console.log(this.room_id + ": " + this.gameState.to_act.name + "(all_in) forced skip");
			this.gameState.to_act.has_acted = 1;
			this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.to_act))
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
			if(this.gameState.to_act.bet == this.gameState.bet_size){
				console.log(this.room_id + ": " + this.gameState.to_act.name + "forced check (everyone else all_in)");
				this.gameState.state = 5;
				this.updateState();
				return;
			}
		}
            
		var actualTimeForAction = timeForAction;

		//IF TO ACT IS A ZOMBIE (LEFT THE TABLE SCREEN) TODO
		if(this.gameState.to_act.zombie){
			//Skip calling for action, force check/fold
			console.log(this.room_id + ": " + this.gameState.to_act.name + "(zomibe) forced to act");
			actualTimeForAction = 0;
		}

		//SEND PLAYER THE ACTION REQUIRED MESSAGE
		else{
			//this.sendGamestate();
			this.io.to(this.room_id).emit('actionRequired', [this.gameState.to_act.name, actualTimeForAction, this.gameState.bet_size]);
			this.acted = 0;
			console.log(this.room_id + ": " + this.gameState.to_act.name + " called to act");
		}

		//Default action after timeout (canceled by clearning interval when acting)

		this.timeoutID = setTimeout(() => {this.autoCheckFold()}, actualTimeForAction);

	}

    autoCheckFold(){
		this.gameState.to_act.has_acted = 1;

		//AUTO FOLD
		if(this.gameState.to_act.bet < this.gameState.bet_size){
			console.log(this.room_id + ": " + this.gameState.to_act.name + " autofold (timeout)");

			this.gameState.to_act.alive = 0;
		} 
		//AUTO CHECK
		else {
			console.log(this.room_id + ": " + this.gameState.to_act.name + " autocheck (timeout)");
		}

		this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.to_act), this.seats)
		clearInterval(this.timeoutID)
		this.betting();
	}

    //Card turn states
	cardTurns(num_cards){
		this.gameState.bet_size = 0;
		this.resetPlayerBets()

		this.gameState.to_act = this.nextPlayer(this.seats.indexOf(this.gameState.dealer));

		//burn a card
		this.gameState.deckCounter++;

		//Reveal cards
		for(var i = 0; i < num_cards; i++){
			this.gameState.revealedCards.push(this.gameState.deck[this.gameState.deckCounter])
			this.gameState.deckCounter++
		}

		console.log(this.gameState.revealedCards)

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
					var hand = Hand.solve(this.gameState.revealedCards.concat(this.seats[i].cards))
					handUserMap.set(hand, this.seats[i])
					userHandMap.set(this.seats[i], hand)

					hands.push(hand)
				}
			}
		}

		var min_stack;
		var runningPot = 0;

		var winnerCards = []
		while(players.length > 1){
			min_stack = Math.min(...investment)
			runningPot += players.length * min_stack;

			for(var i = 0; i < investment.length; i++){
				investment[i]-= min_stack;
			}

			var winnerHands = Hand.winners(hands)
			console.log("["+this.room_id +"] Running pot: " + runningPot + " num_hands+= " + hands.length + " " + "num_win: " + winnerHands.length)

			this.splitTip += runningPot%winnerHands.length; //In case multiple winners but not divisible by number of players, this counts as a tip for the house;
			if(runningPot%winnerHands.length > 0){
				console.log("["+this.room_id +"] Split tip " + runningPot%winnerHands.length);
			}

			for(var i in winnerHands){
				var winningPlayer = handUserMap.get(winnerHands[i])

				winningPlayer.result += Math.floor(runningPot/winnerHands.length)

				var allCards = winnerHands[i].cards
				for(var j in allCards){
					winnerCards.push(allCards[j])
				}

				console.log("["+this.room_id +"] Winner: " + winningPlayer.name + " result+= " + Math.floor(runningPot/winnerHands.length)) + " Desc: " + winnerHands[i].desc

				userHandMap.set(winningPlayer, winnerHands[i].descr)
			}

			var remove_ids = []
			for(var i in investment){
				if(investment[i] <= 0){
					remove_ids.push(i);
				}
			}

			for(var i = remove_ids.length-1; i >= 0; i--){

				if(hands.includes(userHandMap.get(players[remove_ids[i]]))){
					var index = hands.indexOf(userHandMap.get(players[remove_ids[i]]))
					hands.splice(index)
				}

				players.splice(remove_ids[i],1)
				investment.splice(remove_ids[i],1)
			}

			if(players.length == 1){
				//return uncalled bet
				console.log("["+this.room_id +"] Return uncalled bet "+players[0].name+" "+investment[0])
				players[0].result += investment[0]
			}

			runningPot = 0;
		}
		
		for(var i in this.seats){
			if(this.seats[i]){
				if(this.seats[i].result > 0){
					this.seats[i].stack+=this.seats[i].result;
					var desc = userHandMap.get(this.seats[i]).descr
					if(this.fold_win){
						desc = "Fold win"
					}

					this.io.to(this.room_id).emit('winner', [this.seats[i].name, this.seats[i].result, desc]);
				}
			}
		}

		if(!this.fold_win){
			this.sendWinnerCards(winnerCards);
		}
		
		this.roomState++;
		this.updateState();
	}

	sendWinnerCards(winnerCards){
		var toSend = []

		winnerCards.forEach(item => {
			if(item.toString().substr(0,2) == "10"){
				toSend.push(("T") + item.toString().substr(2,1));
			}
			else{
				toSend.push(item.toString());
			}
		})


		this.io.to(this.room_id).emit("winnerCards", toSend);
	}

    /* Functions for sending data */
    sendWaitingForPlayer(){
        console.log(this.room_id + ": waiting for players sent.")
        this.io.to(this.room_id).emit('waitingForPlayers');
    }

    sendNamesStacks(){
        var data;
        data = this.playerData()
        var args = [data[0],data[2]]
        console.log(this.room_id + ": names and stacks sent.")
        this.io.to(this.room_id).emit('namesStacks',args);
    }
    
    sendMessage(){
        this.io.to(this.room_id).emit('message', message);
    }

    sendGamestate(){
        var args = []
        args.push(this.gameState.pot)
        var pData = this.playerData()
        args = args.concat([pData[1]])
        args = args.concat([pData[2]])
        args = args.concat([pData[3]])

        this.io.to(this.room_id).emit('gameState', args);
    }

    sendRevealedCards(){
        this.io.to(this.room_id).emit("revealedCards", this.gameState.revealedCards)
    }

    /* HELPER */

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
		return this.seats.indexOf(null);
    }

    playerData(){
        var names = []
        var bets = []
        var stacks = []
        var alive = []
        for(var i in this.seats){
            if(this.seats[i]){
                names.push(this.seats[i].name)
                bets.push(this.seats[i].bet)
                stacks.push(this.seats[i].stack)
                alive.push(this.seats[i].alive)
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
    
    resetPlayers(){
        for(var i in this.seats){
          if(this.seats[i]){
            this.seats[i].bet = 0
            this.seats[i].alive = 1
            this.seats[i].cards = []
            this.seats[i].total_bet_size = 0;
            this.seats[i].all_in = 0;
            this.seats[i].has_acted = 0;
    
            if(this.seats[i].busted){
                this.seats[i].alive = 0;
            }
          }
        }
    }
    
    resetPlayersHasActed(){
        for(var i in this.seats){
          if(this.seats[i]){
            this.seats[i].has_acted = 0;
          }
        }
    }
    
    resetPlayerBets(){
        for(var i in this.seats){
          if(this.seats[i]){
            this.seats[i].bet = 0
          }
        }
    }
    
    firstNonNullPlayer(){
        for(var i in this.seats){
          if(this.seats[i]){
              if(this.seats[i].alive){
                return this.seats[i]
              }
          }
      }
    }
    
    alivePlayers(){
        var counter = 0
        for(var i in this.seats){
    
            if(this.seats[i]){
                if(this.seats[i].alive){
                    counter++
                }
            }
        }
        return counter
    }
    
    nextPlayer(currentIndex){	  
        var next = currentIndex+1
        while(1){
          if(next == currentIndex){
              console.log("["+this.room_id+"] next player not found!")
          }
    
          if(next >= this.seats.length){
            next = 0;
          }
          if(!this.seats[next]){
            next = next+1
            continue;
          }
          else{
            if(this.seats[next].alive == 0){
              next = next+1
              continue;
            }
            else{
              return this.seats[next]
            }
          }
        }
    }

}

exports.AbstractRoom = AbstractRoom;