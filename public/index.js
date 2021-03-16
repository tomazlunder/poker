var socket = io();
var canvas = document.getElementById('canvas');

var audio_notify = new Audio('audio/notify.wav');
var audio_deal = new Audio('audio/deal.wav');
var audio_bridge = new Audio('audio/bridge.wav');

var depositsFound = 0;

audio_notify.volume = 0.3;
audio_bridge.volume = 0.5;
audio_deal.volume = 0.5;


var mute = 0;

var myName = ""
var room_id;
var mySeat
var gameType

var pot = 0;
var revealedCards = []
var playerNames = []
var playerBets = []
var playerStacks = []
var playerAlive = []
var playerResults = [0,0,0,0,0,0]
var playerResultReason = [null,null,null,null,null,null]

var isAdmin = false;
var adminMode = false;

var buttonRoomMap = new Map()

var playerToAct;

var myCards = []
var showdown = []

var message = ""

var state = 0;

var timeToAct;
var startTime;
var intervalId;

var modalBuyIn, modalRebuy, modalWithdraw, modalTip, modalEmail, modalPassword;
var span1, span2, span3, span4, span5, span6;
var buyInRange, rebuyRange, withdrawRange, tipRange;

var myBalance;

//to pass to buy in modal functions
var buttonRoomdataMap = new Map()
var buttonTournamentDataMap = new Map()

var cur_min_buy_in;
var cur_max_buy_in;

var myLeaderboard;

var winnerCards = new Set()

modalBuyIn = document.getElementById("modalBuyIn");
modalRebuy = document.getElementById("modalRebuy");
modalWithdraw = document.getElementById("modalWithdraw")
modalTip = document.getElementById("modalTip")
modalEmail = document.getElementById("modalEmail")
modalPassword = document.getElementById("modalPassword")


span1 = document.getElementById("closeBuyIn");
span2 = document.getElementById("closeRebuy");
span3 = document.getElementById("closeWithdraw");
span4 = document.getElementById("closeTip");
span5 = document.getElementById("closeEmail")
span6 = document.getElementById("closePassword")

buyInRange = document.getElementById("buyInRange");
rebuyRange = document.getElementById("rebuyRange");
withdrawRange = document.getElementById("withdrawRange");
tipRange =  document.getElementById("tipRange")

cardType = ""


document.addEventListener("DOMContentLoaded", function(event){
    console.log("DOM LOADED")
});

//Modal stuff
window.onload = function(){ 
    window.onclick = function(event) {
        if (event.target == modalBuyIn) {
            modalBuyIn.style.display = "none";
        }
        else if (event.target == modalRebuy) {
            modalRebuy.style.display = "none";
        }
        else if (event.target == modalWithdraw) {
            modalWithdraw.style.display = "none";
        }
        else if (event.target == modalTip) {
            modalTip.style.display = "none";
        }
        else if (event.target == modalEmail) {
            modalEmail.style.display = "none";
        }
        else if (event.target == modalPassword) {
            modalPassword.style.display = "none";
        }
    } 
};

span1.onclick = function() {
    modalBuyIn.style.display = "none";
}

span2.onclick = function() {
    modalRebuy.style.display = "none";
}

span3.onclick = function() {
    modalWithdraw.style.display = "none";
}
  
span4.onclick = function() {
    modalTip.style.display = "none";
}

span5.onclick = function(){
    modalEmail.style.display = "none";
}

span6.onclick = function(){
    modalPassword.style.display = "none";
}

var spanDeposited = document.getElementById("closeDeposited");

spanDeposited.onclick = function(){
    depositsFound = 0;
    document.getElementById("deposited").style.display = 'none';
}

socket.on("depositComplete", (arg) => {
    console.log("Received: deposit complete ("+arg[0]+")")
    depositsFound += arg[0];
    document.getElementById("depositedLabel").innerHTML = "Deposited: " + depositsFound;
    document.getElementById("deposited").style.display = 'block';
});

socket.on("winnerCards", (arg) => {
    console.log("Received: winner cards ("+arg+")")
    console.log(arg)

    if(arg){
        arg.forEach(item => winnerCards.add(item))
    }

})


//Messages
//TODO ADD MANAGER THAT CAN THROW THIS
socket.io.on('connect_error', function(err) {
    console.log('Error connecting to server');
    location.reload();
  });

socket.on("dc", (arg) => {
    location.reload();
});

socket.on("registrationFailed", (arg) => {
    console.log("Received: Registration failed ");
    console.log(arg) 
    document.getElementById("error_label_register").innerHTML = "Registration failed: "+ arg+"."
    document.getElementById("error_label_register").style.display="block"
});

socket.on("loginFailed", (arg) => {
    console.log("Received: Loing failed ");
    
    console.log(arg) 
    document.getElementById("error_label_login").innerHTML = "Login failed: "+ arg+"."
    document.getElementById("error_label_login").style.display="block"
});

socket.on('loginOk', (arg) => {
    console.log("Received: Loing OK");
    console.log(arg)

    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "none";
    document.getElementById("home").style.display = "block";
    document.getElementById("userWrapper").style.display = "block";

    myName = arg[0]
    myBalance = arg[1]
    isAdmin = arg[2]

    if(isAdmin){
        document.getElementById("buttonAdminMode").style.display = "block";
    }

    document.getElementById("home_label_user").innerHTML = arg[0]
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[1]

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
});

socket.on("accountStats", (arg) => {
    console.log("Received: accountStats")
    console.log(arg)

    document.getElementById("homeAccountName").innerHTML = myName;
    document.getElementById("homeAccountBalance").innerHTML = arg[0]
    document.getElementById("homeAccountBalance").innerHTML = arg[0]
    document.getElementById("homeAccountWinnings").innerHTML = arg[1]
    document.getElementById("homeAccountTipped").innerHTML = arg[2]
    document.getElementById("homeAccountRoundsplayed").innerHTML = arg[3]
    document.getElementById("homeAccountWithdrawPending").innerHTML = arg[4]

    if(arg[5]){
        document.getElementById("emailLabel").innerHTML = "Email: " + arg[5]
    }
});

socket.on('newBalance', (arg) => {
    console.log("Received: New balance ("+arg+")");
    myBalance = arg;
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg
});

socket.on('withdrawOk', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;

    showSuccess("Withdrawal successful!")
});

socket.on('withdrawFailed', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    //TODO: add popup
});

socket.on('tipOk', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    
    showSuccess("Tip successful!")
});

socket.on('tipFailed', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    
    showSuccess("Tip failed!",1)
});

socket.on('changeEmailOk', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    
    showSuccess("Email changed!")
});

socket.on('changeEmailFailed', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    //TODO: add popup
});

socket.on('changePasswordOk', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    
    showSuccess("Password changed!")
});

socket.on('changePasswordFailed', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    //TODO: add popup
});

socket.on('leaderboard', (arg)=>{
    console.log("Received: leaderboard")
    console.log(arg)
    myLeaderboard = arg;
    var table = document.getElementById("totalBody");
    var table2 = document.getElementById("tourBody");

    table.innerHTML =  "<tr> <th></th>   <th>Name</th> <th>Winnings</th><th>Rounds played</th></tr>"
    table2.innerHTML =  "<tr> <th></th>   <th>Name</th> <th>Tournament winnings</th><th>Tournaments played</th></tr>"

    for(var j in arg){
        for(var i in arg[j]){
            var row = document.createElement("tr")
            var td0 = document.createElement("td")
            var td1 = document.createElement("td")
            var td2 = document.createElement("td")
            var td3 = document.createElement("td")
    
            row.classList.add("tableLeaderboardRow");
    
            td0.classList.add("tdLeaderboardRank")
            td1.classList.add("tdLeaderboard")
            td2.classList.add("tdLeaderboard")
            td3.classList.add("tdLeaderboard")
    
            var label_rank = document.createElement("label")
            var label_name = document.createElement("label")
            var label_winnings = document.createElement("label")
            var label_roundsPlayed = document.createElement("label")
    
            td0.append(label_rank)
            td1.append(label_name)
            td2.append(label_winnings)
            td3.append(label_roundsPlayed)
    
            row.append(td0)
            row.append(td1)
            row.append(td2)
            row.append(td3)
    
            if(j == 0){
                table.append(row)
                label_rank.innerHTML = (parseInt(i)+1);
                label_name.innerHTML = arg[j][i].account_name;
                label_winnings.innerHTML = arg[j][i].winnings;
                label_roundsPlayed.innerHTML = arg[j][i].roundsPlayed;
            }
            if(j == 1){
                table2.append(row)
                label_rank.innerHTML = (parseInt(i)+1);
                label_name.innerHTML = arg[j][i].account_name;
                label_winnings.innerHTML = arg[j][i].tour_winnings;
                label_roundsPlayed.innerHTML = arg[j][i].tour_played;
            }
        }

    }
    
});

socket.on('roomList', (arg) =>{
    console.log("Received: RoomList");
    console.log(arg)

    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    var alreadyInRoom = arg[0];
    document.getElementById("labelRoomMessage").innerHTML= ""

    if(alreadyInRoom){
        document.getElementById("labelRoomMessage").innerHTML= "&#160&#160&#160&#160 Waiting for previous round to finish."
    }

    document.getElementById("usersOnline").innerHTML = "Users connected: " + arg[2]

    buttonRoomdataMap = new Map()

    var room_list = arg[1];
    for(var i in room_list){
        var id = room_list[i][0]
        var sb = room_list[i][1]
        var minBuyIn = room_list[i][2]
        var maxBuyIn = room_list[i][3]
        var numplayers = room_list[i][4]
        var numseats = room_list[i][5]
        var roomName = room_list[i][6]

        var roomRunning = room_list[i][7]
        var roomMarkedForShutdown = room_list[i][8]

        var div_room = document.createElement("div");
        var div_col80 = document.createElement("div");
        var div_row50_1 = document.createElement("div");
        var div_row50_2 = document.createElement("div");
        var label_room_1 = document.createElement("label");
        var div_col20 = document.createElement("div");
        var button_join = document.createElement("button");

        var button_stop = document.createElement("button");
        var button_start = document.createElement("button");

        var table = document.createElement("table")
        var tableTr = document.createElement("tr")
        var tableTd1 = document.createElement("td")
        var tableTd2 = document.createElement("td")
        var tableTd3 = document.createElement("td")

        var label_stakes = document.createElement("label");
        var label_buyin = document.createElement("label");
        var label_players = document.createElement("label");

        div_room.classList.add("room")
        div_col80.classList.add("col80")
        div_row50_1.classList.add("row50")
        div_row50_2.classList.add("row50")
        div_col20.classList.add("col20")

        button_stop.classList.add("buttonRoomStop")
        button_start.classList.add("buttonRoomStart")

        button_join.classList.add("buttonJoin")
        table.classList.add("tableRoom")
        tableTd1.classList.add("tdRoom")
        tableTd2.classList.add("tdRoom")
        tableTd3.classList.add("tdRoom")

        label_room_1.innerHTML = roomName;

        label_stakes.innerHTML = "Stakes: "+sb+"/"+2*sb
        label_buyin.innerHTML = "Buy-in: "+minBuyIn+"/"+maxBuyIn
        label_players.innerHTML = "Players: "+numplayers+"/"+numseats

        tableTd1.append(label_stakes)
        tableTd2.append(label_buyin)
        tableTd3.append(label_players)

        tableTr.append(tableTd1)
        tableTr.append(tableTd2)
        tableTr.append(tableTd3)

        table.append(tableTr)

        div_row50_1.append(label_room_1)
        div_row50_2.append(table)

        div_col80.append(div_row50_1)
        div_col80.append(div_row50_2)
        button_join.innerHTML = "Join"

        button_stop.innerHTML = "Stop"
        button_start.innerHTML = "Start"

        if(adminMode){
            div_col20.append(button_stop)
            div_col20.append(button_start)

            button_start.disabled = true;
            if(roomRunning == 0 || roomMarkedForShutdown == 1){
                button_stop.disabled = true;

                if(roomRunning == 1){
                    button_stop.innerHTML = "Shutting down..."
                }
            } 
            if(roomRunning == 0){
                button_start.disabled = false;
            }
            

        } else {
            div_col20.append(button_join)

            if(roomRunning == 0 || roomMarkedForShutdown == 1){
                button_join.disabled = true;
                button_join.innerHTML = "Room closed"
            }

            if(myBalance<minBuyIn){
                button_join.disabled = true;
            }
        }

        div_room.append(div_col80)
        div_room.append(div_col20)

        buttonRoomdataMap.set(button_join, [id, minBuyIn, maxBuyIn])
        buttonRoomdataMap.set(button_stop, [id, minBuyIn, maxBuyIn])
        buttonRoomdataMap.set(button_start, [id, minBuyIn, maxBuyIn])


        button_join.onclick = function(){
            buttonJoinRoomClicked(buttonRoomdataMap.get(this)[0], buttonRoomdataMap.get(this)[1], buttonRoomdataMap.get(this)[2])
        }

        button_stop.onclick = function(){
            buttonStopRoomClicked(buttonRoomdataMap.get(this)[0])
            this.disabled = true;
        }

        button_start.onclick = function(){
            buttonStartRoomClicked(buttonRoomdataMap.get(this)[0])
            this.disabled = true;
        }

        if(arg[0]){
            button_join.disabled = true;
            console.log("Waiting for last round to end")
        }

        if(arg[0] == id){
            button_join.innerHTML = "Reconnect";
            button_join.disabled = false;

            button_join.onclick = function(){
                socket.emit("reconnect");
            }
        }

        var containerRooms = document.getElementById("containerRooms");
        containerRooms.append(div_room)
        containerRooms.append(document.createElement("br"))
    }
});

socket.on('tournamentList', (arg) => {
    console.log("Received: tournamentList");
    console.log(arg)

    var myNode = document.getElementById("containerTournaments");
    myNode.innerHTML = '';

    var alreadyInRoom = arg[0];
    document.getElementById("labelRoomMessage").innerHTML= ""

    if(alreadyInRoom){
        document.getElementById("labelRoomMessage").innerHTML= "&#160&#160&#160&#160 Waiting for previous round to finish."
    }

    //buttonRoomdataMap = new Map()
    buttonTournamentDataMap = new Map()

    var tournament_list = arg[1];
    for(var i in tournament_list){
        var id = tournament_list[i][0]
        var buyin = tournament_list[i][1]
        var numplayers = tournament_list[i][2]
        var numseats = tournament_list[i][3]
        var tournamentName = tournament_list[i][4]

        var tournamentRunning = tournament_list[i][5]
        var tournamentMarkedForShutdown = tournament_list[i][6]
        var tournamentRewards = tournament_list[i][7]

        var div_tournament = document.createElement("div");
        var div_col80 = document.createElement("div");
        var div_row50_1 = document.createElement("div");
        var div_row50_2 = document.createElement("div");
        var label_room_1 = document.createElement("label");
        var div_col20 = document.createElement("div");
        var button_join = document.createElement("button");

        var button_stop = document.createElement("button");
        var button_start = document.createElement("button");

        var table = document.createElement("table")
        var tableTr = document.createElement("tr")
        var tableTd1 = document.createElement("td")
        var tableTd2 = document.createElement("td")

        var label_rewards = document.createElement("label");
        var label_players = document.createElement("label");

        div_tournament.classList.add("tournament")
        div_col80.classList.add("col80")
        div_row50_1.classList.add("row50")
        div_row50_2.classList.add("row50")
        div_col20.classList.add("col20")

        button_stop.classList.add("buttonRoomStop")
        button_start.classList.add("buttonRoomStart")

        button_join.classList.add("buttonJoin")

        table.classList.add("tableRoom")
        tableTd1.classList.add("tdTournament1")
        tableTd2.classList.add("tdTournament2")

        label_room_1.innerHTML = tournamentName;

        var rewardsText = "";
        if(tournamentRewards[0]){
            if(tournamentRewards[0] > 0){
                rewardsText += "1ST: "+tournamentRewards[0] +", "
            }
        }
        if(tournamentRewards[1]){
            if(tournamentRewards[1] > 0){
                rewardsText += "2ND: "+tournamentRewards[1] +", "
            }
        }

        if(tournamentRewards[2]){
            if(tournamentRewards[2] > 0){
                rewardsText += "3RD: "+tournamentRewards[2] +", "
            }
        }

        if(tournamentRewards[3]){
            if(tournamentRewards[3] > 0){
                rewardsText += "4TH: "+tournamentRewards[2] +", "
            }
        }

        if(tournamentRewards[4]){
            if(tournamentRewards[4] > 0){
                rewardsText += "5TH: "+tournamentRewards[2] +", "
            }
        }

        if(tournamentRewards[5]){
            if(tournamentRewards[5] > 0){
                rewardsText += "6TH: "+tournamentRewards[2] +", "
            }
        }

        label_rewards.innerHTML = rewardsText.slice(0,-2)
        label_players.innerHTML = "Players: "+numplayers+"/"+numseats

        tableTd1.append(label_rewards)
        tableTd2.append(label_players)

        tableTr.append(tableTd1)
        tableTr.append(tableTd2)

        table.append(tableTr)

        div_row50_1.append(label_room_1)
        div_row50_2.append(table)

        div_col80.append(div_row50_1)
        div_col80.append(div_row50_2)
        button_join.innerHTML = "Join ("+buyin+")"
        if(buyin == 0){
            button_join.innerHTML = "Join (FREE)"
        }

        button_stop.innerHTML = "Stop"
        button_start.innerHTML = "Start"

        if(adminMode){
            div_col20.append(button_stop)
            div_col20.append(button_start)

            button_start.disabled = true;
            if(tournamentRunning == 0 || tournamentMarkedForShutdown == 1){
                button_stop.disabled = true;

                if(tournamentRunning == 1){
                    button_stop.innerHTML = "Shutting down..."
                }
            } 
            if(tournamentRunning == 0){
                button_start.disabled = false;
            }
            

        } else {
            div_col20.append(button_join)

            if(tournamentRunning == 0 || tournamentMarkedForShutdown == 1){
                button_join.disabled = true;
                button_join.innerHTML = "Room closed"
            }

            if(myBalance<buyin){
                button_join.disabled = true;
            }
        }

        div_tournament.append(div_col80)
        div_tournament.append(div_col20)

        buttonTournamentDataMap.set(button_join, id)
        buttonTournamentDataMap.set(button_stop, id)
        buttonTournamentDataMap.set(button_start, id)


        button_join.onclick = function(){
            buttonJoinTournamentClicked(buttonTournamentDataMap.get(this))
        }

        button_stop.onclick = function(){
            buttonStopRoomClicked(buttonTournamentDataMap.get(this))
            this.disabled = true;
        }

        button_start.onclick = function(){
            buttonStartRoomClicked(buttonTournamentDataMap.get(this))
            this.disabled = true;
        }

        if(arg[0]){
            button_join.disabled = true;
            console.log("Waiting for last round to end")
        }

        if(arg[0] == id){
            button_join.innerHTML = "Reconnect";
            button_join.disabled = false;

            button_join.onclick = function(){
                socket.emit("reconnect");
            }
        }

        var containerRooms = document.getElementById("containerTournaments");
        containerRooms.append(div_tournament)
        containerRooms.append(document.createElement("br"))
    }
});

socket.on('listOutdated', (arg) => {
    console.log("Received: Room list outdated");
    console.log("Emitted: lookingForRooms");

    socket.emit("lookingForRooms")    
});

socket.on('drawnCards', (arg) => {
    console.log("Received: Drawn Cards ("+arg+")")

    if(gameType == "tournament"){
        document.getElementById('homeLeaveRoomButton').style.display = 'none';
    }

    document.getElementById('homeRebuyButton').style.display = 'none';


    if(!mute){
        audio_deal.play();
    }

    myCards = []
    myCards.push(arg[0])
    myCards.push(arg[1])
    console.log(myCards)
    message = ""
});

socket.on('roomJoined', (arg) => {
    console.log("Received: Room Joined ("+arg+")")
    var type = arg[0]
    var rid = arg[1]
    var seat_id = arg[2]
    myBalance = arg[3]

    if(type == "room"){
        gameType = "room";
        cur_min_buy_in = arg[4]
        cur_max_buy_in = arg[5]
    }
    else if (type == "tournament"){
        gameType = "tournament";
    }

    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[3]

    room_id = rid

    mySeat = seat_id;

    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "none";
    document.getElementById("home").style.display = "none";

    document.getElementById("game").style.display = "block";

    document.getElementById("raiseRange").disabled = true;
    document.getElementById('homeRaiseButton').disabled = true;
    document.getElementById('homeCallButton').disabled = true;
    document.getElementById('homeFoldButton').disabled = true;

    document.getElementById('homeRebuyButton').disabled = true;

    document.getElementById('homeLeaveRoomButton').style.display = 'block';

    if(type == "tournament"){
        document.getElementById('homeRebuyButton').style.display = 'none';
    }

    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    message = "";
});

socket.on('reconnectOK', (arg) => {
});

socket.on('waitingForPlayers', (arg) => {
    state = 0
    console.log("Received: waitingForPlayers")
    message = "Waiting for players..."

    drawGame()
});

socket.on('namesStacks', (arg) => {
    console.log("Received: namesStacks")
    console.log(arg)

    playerNames = arg[0]
    playerStacks = arg[1]

    playerNames = playerNames.slice(mySeat).concat(playerNames.slice(0,mySeat))
    playerStacks = playerStacks.slice(mySeat).concat(playerStacks.slice(0,mySeat))

    drawGame()
    
});

socket.on('roundStarted', (arg) => {
    console.log("Received: Round started")
    state = 1;
    if(!mute){
        //audio_bridge.play();
    }

    document.getElementById("homeRebuyButton").disabled = true;
    document.getElementById("homeRebuyButton").style.display = 'none';

    
    if(gameType == "room"){
        document.getElementById("homeLeaveRoomButton").style.display = 'block';
    }
    if(gameType == "tournament"){
        document.getElementById("homeLeaveRoomButton").style.display = 'none';
    }

    message = "Starting...";
});

socket.on('resetGame', (arg) => {
    myCards = []
    pot = 0;
    playerBets = []
    revealedCards = []
    playerResults = [0,0,0,0,0,0]
    playerResults = [null,null,null,null,null,null]
    winnerCards = new Set();

    showdown = []

    drawGame();
});

socket.on('showdown', (arg) => {
    console.log("Received: Showdown")
    console.log(arg)

    timeToAct = 0;
    message = ""

    this.showdown = arg;
    this.showdown = showdown.slice(mySeat).concat(showdown.slice(0,mySeat))
    
    drawGame();
});

socket.on('revealedCards', (arg) => {
    console.log("Received: Revealed cards");
    console.log(arg)

    revealedCards = arg;
    drawGame();
});

socket.on('gameState', (arg) => {
    console.log("Received: Game State");
    console.log(arg)
    pot = arg[0]
    //playerNames = arg[1]
    playerBets = arg[1]
    playerStacks = arg[2]
    playerAlive = arg[3]

    //playerNames = playerNames.slice(mySeat).concat(playerNames.slice(0,mySeat))
    playerBets = playerBets.slice(mySeat).concat(playerBets.slice(0,mySeat))
    playerStacks = playerStacks.slice(mySeat).concat(playerStacks.slice(0,mySeat))
    playerAlive = playerAlive.slice(mySeat).concat(playerAlive.slice(0,mySeat))

    drawGame();
});

socket.on('winner', (arg) =>{
    console.log("Received: Winner")
    state = 2;
    console.log(arg)

    var username = arg[0]
    var result = arg[1]
    var hand = arg[2]
    if(!hand){
        hand = "Uncalled bet"
    }

    var localIndex = playerNames.indexOf(username)
    playerResults.splice(localIndex,1,result);
    playerResultReason.splice(localIndex,1,hand);

    console.log(playerResults)

    drawGame();

    if(message == "Your turn!"){
        message = "";
    }
    
    //this.message += arg;
    timeToAct = 0;

    //Disable everything, enable when needed
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
});

socket.on('roomJoinFailed', (arg) => {
    console.log("Received: Room join failed (" + arg+")")
});

socket.on('roomKick', (arg) =>{
    console.log("Received: Room kick")
    document.getElementById("game").style.display = "none";
    document.getElementById("home").style.display = "block";

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
});


socket.on('tournamentEnd', (arg) =>{
    console.log("Received: Tournament end")

    var table = document.createElement("table")
    for(var i in arg[0]){
        var name = arg[0][i]
        var result = arg[1][i]

        var tr = document.createElement("tr")
        var td1 = document.createElement("td")
        var td2 = document.createElement("td")
        var td3 = document.createElement("td")

        td1.classList.add("tdResult1")
        td2.classList.add("tdResult2")
        td3.classList.add("tdResult3")


        td1.innerHTML = parseInt(i) + 1;
        td2.innerHTML = name;
        td3.innerHTML = result;

        tr.append(td1)
        tr.append(td2)
        tr.append(td3)
        table.append(tr)
    }

    table.classList.add("tableResult")

    document.getElementById("modalTourResultsContent").innerHTML = ""
    document.getElementById("modalTourResultsContent").append(table)

    document.getElementById("modalTourResults").style.display = "block";


    //TODO: Tournament end modal
});

socket.on('waitingForNewGame', (arg) => {
    if(playerStacks[0] + playerResults[0] < cur_min_buy_in){
        if(myBalance > 0 && gameType == "room"){
            document.getElementById("homeRebuyButton").style.display = 'block';
            document.getElementById("homeRebuyButton").disabled = false;
        }
    }

    console.log("Received: Waiting for new game")
    timeToAct = arg;
    startTime = timeToAct;
    state = 3;

    if(!intervalId){
        intervalId = window.setInterval(function(){
            /// call your function here
            if(timeToAct > 0){
                timeToAct -= 1;
                drawGame()
            } else {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, 1000);
    }
})

socket.on('actionRequired', (arg) => {
    console.log("Received: Action required ("+arg+")")
    message = ""
    playerToAct = arg[0]
    timeToAct = arg[1]/1000
    startTime = timeToAct;
    state = 1; //In case reconnect

    if(!intervalId){
        intervalId = window.setInterval(function(){
            /// call your function here
            if(timeToAct > 0){
                timeToAct -= 1;
                drawGame()
            } else {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, 1000);
    }

    //Disable everything, enable when needed
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;

    var curBetSize = arg[2]
    if(playerToAct == myName){
        console.log("Your turn to act")

        message = "Your turn!"
        if(!mute){
            audio_notify.play();
        }

        var max = playerStacks[0]-(curBetSize-playerBets[0])
        var min = curBetSize;
        if(min == 0){
            min = 1;
        }

        if(max <= 0){
            min = 0;
            document.getElementById('raiseRange').max = 0;
        } else {
            document.getElementById('raiseRange').max = max;
            document.getElementById("raiseRange").disabled = false;
            document.getElementById("homeRaiseButton").disabled = false;

        }

        document.getElementById('raiseRange').min = min;
        document.getElementById('raiseRange').value = min;
        document.getElementById("homeRaiseButton").innerHTML =  "Raise ("+min+")";


        var callsize = curBetSize-playerBets[0]

        document.getElementById('homeCallButton').innerHTML = "Check";

        if(callsize>0){
            document.getElementById('homeCallButton').innerHTML = "Call ("+callsize+")";
        }

        if(max<=0){
            //Can't full call, only all in
            document.getElementById('homeCallButton').innerHTML = "ALL IN ("+playerStacks[0]+")";
        }

        document.getElementById('homeCallButton').disabled = false;
        document.getElementById('homeFoldButton').disabled = false;

    } else {
        message = "";
    }
    drawGame();
} );

function buttonJoinRoomClicked(room_id, room_min, room_max){
    buyInRange.min = room_min
    var actualMax = Math.min(myBalance, room_max);
    buyInRange.max = actualMax;
    buyInRange.value = actualMax;
    buyInRange.step = 1;

    var buyInNumberField = document.getElementById("buyInNumberField");
    buyInNumberField.min = room_min;
    buyInNumberField.max = actualMax;
    buyInNumberField.step = 1;
    buyInNumberField.value = actualMax;

    var modalButton = document.getElementById("modalBuyInButton");
    modalButton.innerHTML = "Join"

    modalButton.onclick = function (){
        modalBuyInClicked(room_id);
    }


    modalBuyIn.style.display = "block";
}

function buttonJoinTournamentClicked(tournament_id){
    //TODO:
    socket.emit("joinTournament", tournament_id)
}


function buttonStopRoomClicked(room_id){
    socket.emit("adminRoomStop", room_id)
}

function buttonStartRoomClicked(room_id){
    socket.emit("adminRoomStart", room_id)
}

function leaderboardTotalButton(){
    document.getElementById("leaderboardTourButton").disabled = false;
    document.getElementById("leaderboardTotalButton").disabled = true;

    document.getElementById("tableTourLeaderboard").style.display = 'none';
    document.getElementById("tableLeaderboard").style.display = 'table';

    document.getElementById("totalBody").style.width = '100%';



}

function leaderboardTourButton(){
    document.getElementById("leaderboardTourButton").disabled = true;
    document.getElementById("leaderboardTotalButton").disabled = false;

    document.getElementById("tableLeaderboard").style.display = 'none';
    document.getElementById("tableTourLeaderboard").style.display = 'table';

    document.getElementById("tourBody").style.width = '100%';

}


//Buttons in modals

function modalBuyInClicked(room_id){
    var modalButton = document.getElementById("modalBuyInButton");
    var rangeSlider = document.getElementById("buyInRange");

    joinRoom(room_id,rangeSlider.value)

    modalBuyIn.style.display = "none";
}

function modalRebuyClicked(){
    var rangeSlider = document.getElementById("rebuyRange");
    rebuyRoom(rangeSlider.value);

    var rebuyButton = document.getElementById("homeRebuyButton");
    rebuyButton.disabled = true;

    modalRebuy.style.display = "none";
}

function modalWithdrawClicked(){
    var rangeSlider = document.getElementById("withdrawRange");

    socket.emit("withdraw", rangeSlider.value)

    var withdrawButton = document.getElementById("homeWithdrawButton");
    withdrawButton.disabled = true;

    modalWithdraw.style.display = "none";
}

function modalEmailClicked(){
    var email = document.getElementById("emailTextField").value;
    document.getElementById("errorLabelModalEmail").innerHTML = "";

    if(validateEmail(email)){
        socket.emit("changeEmail", email)
        modalEmail.style.display = "none";
    } else {
        document.getElementById("errorLabelModalEmail").innerHTML = "Email format incorrect";
    }
}

function modalPasswordClicked(){

    var password = document.getElementById("password1").value
    var repeat_password  = document.getElementById("password2").value

    //TODO:
    console.log(password)
    if(password.length < 8){
        console.log("Test: Password length FAIL");

        document.getElementById("errorLabelModalPassword").innerHTML = "Password must be least 8 symbols long."
        document.getElementById("errorLabelModalPassword").style.display="block"
        return
    }

    if(password !== repeat_password){
        console.log("Test: Password matching FAIL");

        console.log(repeat_password)

        document.getElementById("errorLabelModalPassword").innerHTML = "Passwords do not match."
        document.getElementById("errorLabelModalPassword").style.display="block"
        return
    }

    socket.emit("changePassword", password)
    modalPassword.style.display = "none";

}

function modalTipClicked(){
    var rangeSlider = document.getElementById("tipRange");

    socket.emit("tip", rangeSlider.value)

    var tipButton = document.getElementById("modalTipButton");
    tipButton.disabled = true;

    modalTip.style.display = "none";
}

//Welcome page buttons

function welcomeLoginButton() {
    document.getElementById("error_label_login").style.display="none"

    //Check if input is correct
    var name = document.getElementById("input_welcome_name").value;
    var password = document.getElementById("input_welcome_password").value;

    var nameTest = /^([a-zA-Z]{3,}.[0-9]{4,4})$/.test(name)

    if(!nameTest){
        console.log("Test: Account name format FAIL")
        document.getElementById("error_label_login").innerHTML = "Not a valid account name."
        document.getElementById("error_label_login").style.display="block"
        return
    }

    if(password.length < 8){
        console.log("Test: Password length FAIL")
        document.getElementById("error_label_login").innerHTML = "Password must be least 8 symbols long."
        document.getElementById("error_label_login").style.display="block"
        return
    }

    console.log("Test: Input format OK")

    //SEND STUFF TO SERVER
    console.log("Emitted: login")
    socket.emit('login',{name,password});
}

function welcomeRegisterButton() {
    document.getElementById("error_label_login").style.display="none"

    //Check if input is correct
    var name = document.getElementById("input_welcome_name").value;
    var password = document.getElementById("input_welcome_password").value;

    var nameTest = /^([a-zA-Z]{3,}.[0-9]{4,4})$/.test(name)
    console.log(nameTest)
    if(!nameTest){
        document.getElementById("error_label_login").innerHTML = "Not a valid account name."
        document.getElementById("error_label_login").style.display="block"
        return
    }
    console.log(password)
    if(password.length < 8){
        document.getElementById("error_label_login").innerHTML = "Password must be least 8 symbols long."
        document.getElementById("error_label_login").style.display="block"
        return
    }

    //Display registration
    document.getElementById("input_registration_name").value = name;
    document.getElementById("input_registration_password").value = password;

    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "block";
}

//Register page buttons

function registrationRegisterButton() {
    document.getElementById("error_label_register").style.display="none"

    //Check if input is correct
    var name = document.getElementById("input_registration_name").value;
    var password = document.getElementById("input_registration_password").value;
    var api = document.getElementById("input_registration_api").value;
    var email = document.getElementById("input_registration_email").value;
    var repeat_password = document.getElementById("input_registration_repeat_password").value;



    var nameTest = /^([a-zA-Z]{3,}.[0-9]{4,4})$/.test(name)
    console.log(nameTest)
    if(!nameTest){
        document.getElementById("error_label_register").innerHTML = "Not a valid account name."
        document.getElementById("error_label_register").style.display="block"
        return
    }
    console.log(password)
    if(password.length < 8){
        console.log("Test: Password length FAIL");

        document.getElementById("error_label_register").innerHTML = "Password must be least 8 symbols long."
        document.getElementById("error_label_register").style.display="block"
        return
    }

    if(password !== repeat_password){
        console.log("Test: Password matching FAIL");

        console.log(repeat_password)

        document.getElementById("error_label_register").innerHTML = "Passwords do not match."
        document.getElementById("error_label_register").style.display="block"
        return
    }

    console.log("Test: Input format OK")

    //SEND STUFF TO SERVER
    console.log("Emitted: registration")
    socket.emit('registration',{name,password,api,email});
}

function registrationBackButton() {
    document.getElementById("welcome").style.display = "block";
    document.getElementById("registration").style.display = "none";
}

//Home buttons

function homeRoomsButton(){
    document.getElementById("homeRooms").style.display="block"
    document.getElementById("containerRooms").style.display="block"
    document.getElementById("containerTournaments").style.display="none"

    document.getElementById("homeAccount").style.display="none"
    document.getElementById("homeLeaderboard").style.display="none"

    document.getElementById("homeRoomsButton").disabled = true;
    document.getElementById("homeTournamentsButton").disabled = false;

    document.getElementById("homeAccountButton").disabled = false;
    document.getElementById("homeLeaderboardButton").disabled = false;
}

function homeTournamentsButton(){
    document.getElementById("homeRooms").style.display="block"
    document.getElementById("containerRooms").style.display="none"
    document.getElementById("containerTournaments").style.display="block"

    document.getElementById("homeAccount").style.display="none"
    document.getElementById("homeLeaderboard").style.display="none"

    document.getElementById("homeRoomsButton").disabled = false;
    document.getElementById("homeTournamentsButton").disabled = true;

    document.getElementById("homeAccountButton").disabled = false;
    document.getElementById("homeLeaderboardButton").disabled = false;
}


function homeAccountButton(){
    document.getElementById("homeRooms").style.display="none"
    document.getElementById("homeAccount").style.display="block"
    document.getElementById("homeLeaderboard").style.display="none"


    document.getElementById("homeRoomsButton").disabled = false;
    document.getElementById("homeTournamentsButton").disabled = false;
    document.getElementById("homeAccountButton").disabled = true;
    document.getElementById("homeLeaderboardButton").disabled = false;
}

function homeLeaderboardButton(){
    if(myLeaderboard == null){
        socket.emit("getLeaderboard");
    }

    document.getElementById("homeRooms").style.display="none"
    document.getElementById("homeAccount").style.display="none"
    document.getElementById("homeLeaderboard").style.display="block"

    document.getElementById("homeRoomsButton").disabled = false;
    document.getElementById("homeTournamentsButton").disabled = false;
    document.getElementById("homeAccountButton").disabled = false;
    document.getElementById("homeLeaderboardButton").disabled = true;
}

function roomRefreshButton(){
    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms")
}

function homeWithdrawButton() {
    console.log("Clicked withdraw button")

    withdrawRange.min = 0
    withdrawRange.max = myBalance
    withdrawRange.value = withdrawRange.min
    withdrawRange.disabled =  false

    var withdrawNumberField = document.getElementById("withdrawNumberField")
    withdrawNumberField.min = 0;
    withdrawNumberField. max = myBalance
    withdrawNumberField.value = withdrawRange.min

    modalWithdraw.style.display = "block";
}

function homeTipButton(){
    console.log("Clicked tip button")

    tipRange.min = 0
    tipRange.max = myBalance
    tipRange.value = tipRange.min
    tipRange.disabled =  false

    var tipNumberField = document.getElementById("tipNumberField")
    tipNumberField.min = 0;
    tipNumberField. max = myBalance
    tipNumberField.value = tipRange.min

    modalTip.style.display = "block";
}

function changeEmailButton(){
    console.log("Clicked email button")
    document.getElementById("errorLabelModalEmail").innerHTML = "";

    modalEmail.style.display = "block";
}

function changePasswordButton(){
    console.log("Clicked email button")

    modalPassword.style.display = "block";

    document.getElementById("password1").value = ""
    document.getElementById("password2").value = ""
    document.getElementById("errorLabelModalPassword").innerHTML = ""
}

function homeLogoffButton(){
    location.reload();
}

function buttonAdminMode(){
    console.log("Clicked admin mode")

    if(adminMode){
        adminMode = 0;
    } else {
        adminMode = 1;
    }

    socket.emit("lookingForRooms");
}

function modalTourResultsClicked(){
    document.getElementById("modalTourResults").style.display = "none";
    document.getElementById("game").style.display = "none";
    document.getElementById("home").style.display = "block";

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
}

//Game buttons

function homeLeaveRoom() {
    console.log("Emitted: leaveRoom")
    socket.emit("leaveRoom")
    document.getElementById("game").style.display = "none";
    document.getElementById("home").style.display = "block";

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
}

function soundCheckboxClicked(){
    if(mute){
        mute = 0;
    } else {
        console.log("Muted")
        mute = 1;
    }
}

function cardCheckboxClicked(){
    if(cardType == ""){
        cardType = "s_";
    } else {
        cardType = ""
    }
    drawGame();
}


function homeFoldButton() {
    console.log("Emitted: actionRequest(fold)")
    socket.emit("actionRequest", [room_id,"fold"])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
    document.getElementById("homeRebuyButton").disabled = true;
}

function homeCallButton() {
    console.log("Emitted: actionRequest(checkcall)")

    socket.emit("actionRequest", [room_id,"checkcall"])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
}

function homeRaiseButton() {
    var val = document.getElementById("raiseRange").value;
    val = parseInt(val)

    console.log("Emitted: actionRequest(raise,"+val+")")
    socket.emit("actionRequest", [room_id,"raise", val])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
}

function homeRebuyButton() {
    console.log("Clicked rebuy button")

    var temp = playerStacks[0] + playerResults[0]

    var actualMax = Math.min(myBalance, cur_max_buy_in - temp)
    rebuyRange.min = cur_min_buy_in - temp
    rebuyRange.max = actualMax
    rebuyRange.value = rebuyRange.max
    rebuyRange.disabled =  false;

    var rebuyNumberField = document.getElementById("rebuyNumberField");

    rebuyNumberField.min = cur_min_buy_in - temp
    rebuyNumberField.max = actualMax
    rebuyNumberField.value = rebuyRange.max

    modalRebuy.style.display = "block";
}

//Dynamic
function joinRoom(id, buyin) {
    console.log("Emitted: joinRoom ("+id+","+buyin+")")
    socket.emit("joinRoom", [id,buyin])
}

function rebuyRoom(id, buyin) {
    console.log("Emitted: rebuyRoom ("+id+","+buyin+")")
    socket.emit("rebuyRoom", [id,buyin])
}


//Range on change
function rangeChange() {
    var val = document.getElementById("raiseRange").value;
    if((parseInt(val) + Math.max(...playerBets)-playerBets[0])==playerStacks[0]){
        document.getElementById("homeRaiseButton").innerHTML = "ALL IN ("+val+")"

    } else {
        document.getElementById("homeRaiseButton").innerHTML = "Raise ("+val+")"
    }
}

function rangeBuyinChange() {
    var val = document.getElementById("buyInRange").value;
    document.getElementById("buyInNumberField").value = val;
}

function rangeRebuyChange() {
    var val = document.getElementById("rebuyRange").value;
    document.getElementById("rebuyNumberField").value = val;
}

function rangeWithdrawChange() {
    var val = document.getElementById("withdrawRange").value;
    document.getElementById("withdrawNumberField").value = val;
}

function rangeTipChange() {
    var val = document.getElementById("tipRange").value;
    document.getElementById("tipNumberField").value = val;
}

//Number input on change
function numberBuyinChange(){
    var val = document.getElementById("buyInNumberField").value;
    document.getElementById("buyInRange").value = val;
}

function numberRebuyChange(){
    var val = document.getElementById("rebuyNumberField").value;
    document.getElementById("rebuyRange").value = val;
}

function numberWithdrawChange(){
    var val = document.getElementById("withdrawNumberField").value;
    document.getElementById("withdrawRange").value = val;
}

function numberTipChange(){
    var val = document.getElementById("tipNumberField").value;
    document.getElementById("tipRange").value = val;
}

//NOTIFICATIONS
showSuccess = function(message, type = 0){
    var success = document.getElementById("success");

    if(type == 0){
        success.style.backgroundColor = "#4CAF50"
    } else {
        success.style.backgroundColor = "#f44336"
    }

    var success = document.getElementById("success");
    success.style.display = "block";
    success.innerHTML = message

    success.style.opacity = "1"; 

    setTimeout(function(){ 
        success.style.opacity = "0"; 
    }, 1500);

    setTimeout(function(){ 
        success.style.display = "none"; 
    }, 3000);
}


/*
* DRAWING FUNCTIONS
* 
*/
function drawGame(){
    drawTable();
    drawMyCards();
    drawPlayers();
    drawRevealedCards();
    drawNumbers();
}

function drawTable(){
    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var height = canvas.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var img = document.getElementById("img_table")
    ctx.drawImage(img,0 ,0 + height * 0.10, width, height*0.8)
}

function drawProfile(x,y,id){
    var canvas = document.getElementById("canvas");

    var width = canvas.width;
    var height = canvas.height;

    var ctx = canvas.getContext("2d");

    var border_width = width*0.22;
    var border_height = 0.4 * border_width

    var img1,img2
    if(id != 0 && playerAlive[id]){
        var cardHeight = height*0.18;
        var cardWidth = cardHeight * 0.65;

        if(showdown[id]){
            //img1 = document.getElementById(cardType + "img_" + showdown[id][0])
            //img2 = document.getElementById(cardType + "img_" + showdown[id][1])
            drawCard(showdown[id][0], x + border_width/2- cardWidth - width * 0.005, y - height*0.11, cardWidth, cardHeight)
            drawCard(showdown[id][1], x + border_width/2 + width * 0.005, y - height*0.11, cardWidth, cardHeight)
        }
        else {
            //img1 = document.getElementById("img_back")
            //img2 = img1
            drawCard(null, x + border_width/2- cardWidth - width * 0.005, y - height*0.11, cardWidth, cardHeight)
            drawCard(null, x + border_width/2 + width * 0.005, y - height*0.11, cardWidth, cardHeight)
        }

        //ctx.drawImage(img1,x + border_width/2- cardWidth - width * 0.005, y - height*0.11, cardWidth, cardHeight)
        //ctx.drawImage(img2,x + border_width/2 + width * 0.005, y - height*0.11, cardWidth, cardHeight)

        //drawCard(showdown[id][0], x + border_width/2- cardWidth - width * 0.005, y - height*0.11, cardWidth, cardHeight)
        //drawCard(showdown[id][1], x + border_width/2 + width * 0.005, y - height*0.11, cardWidth, cardHeight)
    }

    var border_img = document.getElementById("img_player_border")

    if(!playerAlive[id]){
        ctx.globalAlpha = 0.5;
    }
    ctx.drawImage(border_img, x, y, border_width, border_height)
    ctx.globalAlpha = 1; //Reset alpha


    ctx.font = "32px Tahoma";
    ctx.fillStyle = "white";
    
    if(playerToAct == playerNames[id]){
        ctx.fillStyle = "#DFE729"
    }

    ctx.font = "40px Tahoma";
    ctx.fillText(playerNames[id].slice(0, -5) , x + 0.01*width, y + 0.04*height);

    var radious = border_height/3;

    var percentage = timeToAct/startTime;

    if(playerToAct == playerNames[id] & state == 1){
        //drawTimer(x-radious*1.5,y+cardHeight/4,radious);
        //drawTimer(x-(radious),y+(border_height/2),radious, 42);
        ctx.fillStyle = getGreenRedPercentage(1-percentage);
        ctx.fillRect(x + border_width*0.05, y + border_height * 0.8,border_width*0.9 * percentage, border_height *0.1)
    }


    ctx.fillStyle = "white";
    ctx.font = "60px Tahoma";
    var stackWidth = ctx.measureText(playerStacks[id]).width;

    ctx.fillText(playerStacks[id], x + 0.01*width, y + 0.10*height);

    ctx.font = "65px Tahoma";
    ctx.fillStyle =  "#EE42DA";

    if(state == 1 & playerBets[id]>0){

        var betWidth = ctx.measureText(playerBets[id]).width;

        //ctx.strokeText(playerBets[id], x + border_width - 0.01*width - betWidth, y + 0.10*height);
        ctx.fillText(playerBets[id], x + border_width  - 0.01*width -  betWidth, y + 0.10*height);
    }

    if(state >= 2 & playerResults[id]>0){
        ctx.font = "60px Tahoma";

        ctx.fillStyle = "#339966";

        //ctx.strokeText("+"+playerResults[id], x + 0.01*width + stackWidth, y + 0.10*height);
        ctx.fillText("+"+playerResults[id], x + 0.01*width + stackWidth, y + 0.10*height);
    }
}

function drawPlayers(){
    var canvas = document.getElementById("canvas");

    var width = canvas.width;
    var height = canvas.height;

    var border_width = width*0.22;
    var border_height = 0.4 * border_width

    var x, y;

    //P0
    if(playerNames[0]){
        x = 0.5 * width - border_width/2;
        y = 0.85 * height- border_height/2;

        drawProfile(x,y,0)
    }

    //P1
    if(playerNames[1]){ 
        x = 0.20*width - border_width/2
        y = 0.75*height- border_height/2
        drawProfile(x,y,1)

    }

    //P2
    if(playerNames[2]){ 
        x = 0.20*width - border_width/2
        y = 0.25*height - border_height/2
        drawProfile(x,y,2)

    }

    //P3
    if(playerNames[3]){
        x = 0.5*width - border_width/2
        y = 0.18*height - border_height/2
        drawProfile(x,y,3)

    }

    //P4
    if(playerNames[4]){
        x = 0.8*width - border_width/2
        y = 0.25*height - border_height/2
        drawProfile(x,y,4)

    }

    //P5
    if(playerNames[5]){
        x = 0.8*width - border_width/2
        y = 0.75*height - border_height/2
        drawProfile(x,y,5)
    }
}

function drawMyCards(){
    if(myCards.length > 0){
        /*
        var canvas = document.getElementById("canvas");
        var width = canvas.width;
        var height = canvas.height;

        var ctx = canvas.getContext("2d");
        var img1 = document.getElementById(cardType + "img_" + myCards[0])
        var img2 = document.getElementById(cardType + "img_" + myCards[1])

        var cardHeight = height*0.18;
        var cardWidth = cardHeight * 0.65;

        /*
        if(!playerAlive[0]){
            ctx.globalAlpha = 0.5
        }

        ctx.drawImage(img1,width * 0.5 - cardWidth - width * 0.005, height * 0.67, cardWidth, cardHeight)
        ctx.drawImage(img2,width * 0.5 + width * 0.005, height * 0.67, cardWidth, cardHeight)

        ctx.globalAlpha = 1
        
       if(playerAlive[0]){
            ctx.drawImage(img1,width * 0.5 - cardWidth - width * 0.005, height * 0.67, cardWidth, cardHeight)
            ctx.drawImage(img2,width * 0.5 + width * 0.005, height * 0.67, cardWidth, cardHeight)
       }
       */
       
        if(playerAlive[0]){
            var canvas = document.getElementById("canvas");
            var width = canvas.width;
            var height = canvas.height;

            var cardHeight = height*0.18;
            var cardWidth = cardHeight * 0.65;

            drawCard(myCards[0], width * 0.5 - cardWidth - width * 0.005, height * 0.67, cardWidth, cardHeight)
            drawCard(myCards[1], width * 0.5 + width * 0.005, height * 0.67, cardWidth, cardHeight)
        }
    }
}

function drawCard(name, x, y, width, height){
    var canvas = document.getElementById("canvas");
    var ctx = canvas.getContext("2d");
    var img;

    if(name){
        img = document.getElementById(cardType + "img_" + name)

        if(winnerCards.has(name)){
            ctx.fillStyle = "yellow"
            ctx.fillRect(x-3,y-3,width+6,height+6)
        }
    }
    else{
        img = document.getElementById("img_back")
    }
    ctx.drawImage(img,x, y, width, height)
}

function drawRevealedCards(){
    var canvas = document.getElementById("canvas");
    var width = canvas.width;
    var height = canvas.height;

    var cardHeight = height*0.15;
    var cardWidth = cardHeight * 0.65;

    var ctx = canvas.getContext("2d");

    var card, img1
    for(var i = 0; i < revealedCards.length; i++){
        card = revealedCards[i];
        if(!card) continue;

        //img1 = document.getElementById(cardType + "img_" + card)
        if(i == 0){
            //ctx.drawImage(img1,width * 0.5 - 2.5 * cardWidth - width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)
            drawCard(card, width * 0.5 - 2.5 * cardWidth - width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)

        }
        if(i == 1){
        //    ctx.drawImage(img1,width * 0.5 - 1.5 * cardWidth - width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
            drawCard(card,width * 0.5 - 1.5 * cardWidth - width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 2){
        //    ctx.drawImage(img1,width * 0.5 - 0.5 * cardWidth - width * 0.01 * 0, height * 0.42, cardWidth, cardHeight)
            drawCard(card,width * 0.5 - 0.5 * cardWidth - width * 0.01 * 0, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 3){
        //    ctx.drawImage(img1,width * 0.5 + 0.5 * cardWidth + width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
            drawCard(card,width * 0.5 + 0.5 * cardWidth + width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 4){
        //    ctx.drawImage(img1,width * 0.5 + 1.5 * cardWidth + width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)
            drawCard(card,width * 0.5 + 1.5 * cardWidth + width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)
        }

    }
}

function drawTimer(timer_x, timer_y, r_outer, font_size){
    var canvas = document.getElementById("canvas");
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");

    var outerRadius = r_outer;
    var innerRadius = r_outer*0.7;

    //Timer
    var percentage = timeToAct/startTime;

    if(timeToAct){
        if(timeToAct > 0){

            // Grey background ring
            
            ctx.beginPath();
            ctx.globalAlpha = 1;
            ctx.arc(timer_x,timer_y,outerRadius,0,6.283,false);
            ctx.arc(timer_x,timer_y,innerRadius,6.283,((Math.PI*2)),true);
            ctx.fillStyle = "#3E3E3E";
            ctx.fill();
            ctx.closePath();
            
            intAngle = Math.PI*2*(percentage);

            
            // Clock face ring
            
            ctx.beginPath();
            ctx.globalAlpha = 1;
            ctx.arc(timer_x,timer_y,outerRadius,-1.57,(-1.57 + window.intAngle),false);
            ctx.arc(timer_x,timer_y,innerRadius,(-1.57 + window.intAngle),((Math.PI*2) -1.57),true);
            ctx.fillStyle = "#832e7c"
            ctx.fill();
            ctx.closePath();
            

            // Centre circle
            
            ctx.beginPath();
            ctx.arc(timer_x,timer_y,innerRadius,0,6.283,false);
            ctx.fillStyle = "#dddddd";
            ctx.fill();
            ctx.closePath();
            

            ctx.font = "Bold "+font_size+"px Arial";
            ctx.fillStyle =  "black";

            var textWidth = ctx.measureText(""+timeToAct).width;

            //var textHeight = ctx.measureText(""+timeToAct).height;
            ctx.fillText(timeToAct, timer_x - textWidth/2 , timer_y + font_size/3 );
        }
    }
}

function drawNumbers(){
    var canvas = document.getElementById("canvas");
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");

    

    //Pot
    if(pot > 0 & state == 1){
        ctx.font = "Bold 80px Tahoma";
        ctx.fillStyle =  "black";

        var textWidth = ctx.measureText("POT: " + pot).width;
        ctx.fillText("POT: " + pot, width*0.5 - textWidth/2, height * 0.4);
    }

    if(state == 3){
        drawTimer(width*0.5, height*0.34, 80, 60)
    }

    //Bet sizes
    //ctx.fillText("")
    if(message.length >0){
        ctx.font = "Bold 50px Tahoma";
        ctx.fillStyle =  "black";

        var textWidth = ctx.measureText(message).width;
        ctx.fillText(message, width*0.5 - textWidth/2, height * 0.32);
    }
}

/*
* Helper
* 
*/
function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function getGreenRedPercentage(value) {
    //value from 0 to 1
    var hue = ((1 - value) * 120).toString(10);
    return ["hsl(", hue, ",100%,50%)"].join("");
  }