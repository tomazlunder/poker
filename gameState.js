const allCards = ["2h", "3h", "4h", "5h", "6h", "7h", "8h", "9h", "Th", "Jh", "Qh", "Kh", "Ah",
      "2d", "3d", "4d", "5d", "6d", "7d", "8d", "9d", "Td", "Jd", "Qd", "Kd", "Ad",
      "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "Ts", "Js", "Qs", "Ks", "As",
      "2c", "3c", "4c", "5c", "6c", "7c", "8c", "9c", "Tc", "Jc", "Qc", "Kc", "Ac"]

class GameState{
    constructor(dealer, to_act){
        this.dealer = dealer; 
    
        this.to_act = to_act;

		var newDeck = [...allCards]
		shuffleArray(newDeck)

        this.deck = newDeck;
        this.deckCounter = 0;
        this.revealedCards = [];    

        this.bet_size = 0;
        this.pot = 0;

        this.state = 0;
    }
}

shuffleArray = function(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

exports.GameState = GameState