var socket = io();
var canvas = document.getElementById('canvas');

var audio_notify = new Audio('audio/notify.wav');
var audio_deal = new Audio('audio/deal.wav');
var audio_bridge = new Audio('audio/bridge.wav');

audio_notify.volume = 0.3;
audio_bridge.volume = 0.5;

var mute = 0;

var myName = ""
var room_id;
var mySeat

var pot = 0;
var revealedCards = []
var playerNames = []
var playerBets = []
var playerStacks = []
var playerAlive = []
var playerResults = [0,0,0,0,0,0]
var playerResultReason = [null,null,null,null,null,null]

var buttonRoomMap = new Map()

var playerToAct;

var myCards = []
var showdown = []

var message = ""

var state = 0;

var timeToAct;
var startTime;
var intervalId;

var modalBuyIn, modalRebuy, modalWithdraw;
var span1, span2, span3;
var buyInRange, rebuyRange, withdrawRange;

var myBalance;

//to pass to buy in modal functions
var buttonRoomdataMap = new Map()

var cur_min_buy_in;
var cur_max_buy_in;

modalBuyIn = document.getElementById("modalBuyIn");
modalRebuy = document.getElementById("modalRebuy");
modalWithdraw = document.getElementById("modalWithdraw")

span1 = document.getElementById("closeBuyIn");
span2 = document.getElementById("closeRebuy");
span3 = document.getElementById("closeWithdraw");


buyInRange = document.getElementById("buyInRange");
rebuyRange = document.getElementById("rebuyRange");
withdrawRange = document.getElementById("withdrawRange");



document.addEventListener("DOMContentLoaded", function(event){
    console.log("DOM LOADED")
});


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
    } 
};

// When the user clicks on <span> (x), close the modal
span1.onclick = function() {
    modalBuyIn.style.display = "none";
}

// When the user clicks on <span> (x), close the modal
span2.onclick = function() {
    modalRebuy.style.display = "none";
}

span3.onclick = function() {
    modalWithdraw.style.display = "none";
}
  
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

    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "none";
    document.getElementById("home").style.display = "block";
    document.getElementById("userWrapper").style.display = "block";

    myName = arg[0]
    myBalance = arg[1]

    document.getElementById("home_label_user").innerHTML = arg[0]
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[1]

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
});

socket.on('newBalance', (arg) => {
    console.log("Received: New balance ("+arg+")");
    myBalance = arg;
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg
});

socket.on('withdrawOk', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    //TODO: add popup
});

socket.on('withdrawFailed', (arg) => {
    document.getElementById("homeWithdrawButton").disabled = false;
    //TODO: add popup
});


/*
    <div class="room">
    <div class="col80">
        <div class="row50"><label>a</label></div>
        <div class="row50"><label>b</label></div>
    </div>
    <div class="col20">
        <button class="buttonJoin"> TEST </button>
    </div>
    </div>
*/
socket.on('roomList', (arg) =>{
    console.log("Received: RoomList");
    console.log(arg)

    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    var alreadyInRoom = arg[0];
    document.getElementById("labelRoomMessage").innerHTML= ""

    if(alreadyInRoom){
        document.getElementById("labelRoomMessage").innerHTML= "  Waiting for previous round to finish."
    }

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

        //New
        var div_room = document.createElement("div");
        var div_col80 = document.createElement("div");
        var div_row50_1 = document.createElement("div");
        var div_row50_2 = document.createElement("div");
        var label_room_1 = document.createElement("label");
        var label_room_2 = document.createElement("label");
        var div_col20 = document.createElement("div");
        var button_join = document.createElement("button");

        div_room.classList.add("room")
        div_col80.classList.add("col80")
        div_row50_1.classList.add("row50")
        div_row50_2.classList.add("row50")
        label_room_1.classList.add("labelRoom")
        label_room_2.classList.add("labelRoom")
        div_col20.classList.add("col20")
        button_join.classList.add("buttonJoin")

        label_room_1.innerHTML = roomName;
        label_room_2.innerHTML = "Stakes: "+sb+"/"+2*sb+"&#160&#160&#160&#160&#160Buy-in: "+20*sb*2+"-"+50*sb*2+ "&#160&#160&#160&#160&#160Players: "+numplayers+"/"+numseats
        div_row50_1.append(label_room_1)
        div_row50_2.append(label_room_2)

        div_col80.append(div_row50_1)
        div_col80.append(div_row50_2)
        button_join.innerHTML = "JOIN"

        div_col20.append(button_join)
        div_room.append(div_col80)
        div_room.append(div_col20)

        buttonRoomdataMap.set(button_join, [id, minBuyIn, maxBuyIn])

        button_join.onclick = function(){
            buttonJoinRoomClicked(buttonRoomdataMap.get(this)[0], buttonRoomdataMap.get(this)[1], buttonRoomdataMap.get(this)[2])
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

socket.on('listOutdated', (arg) => {
    console.log("Received: Room list outdated");
    console.log("Emitted: lookingForRooms");

    socket.emit("lookingForRooms")    
})

socket.on('drawnCards', (arg) => {
    console.log("Received: Drawn Cards ("+arg+")")
    if(!mute){
        audio_deal.play();
    }

    myCards = []
    myCards.push(arg[0])
    myCards.push(arg[1])
    console.log(myCards)
    message = ""
})

socket.on('roomJoined', (arg) => {
    console.log("Received: Room Joined ("+arg+")")


    var rid = arg[0]
    var seat_id = arg[1]
    myBalance = arg[2]
    cur_min_buy_in = arg[3]
    cur_max_buy_in = arg[4]
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[2]

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

    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    message = "";
})

socket.on('reconnectOK', (arg) => {
})

socket.on('waitingForPlayers', (arg) => {
    state = 0
    console.log("Received: waitingForPlayers")
    message = "Waiting for players..."

    drawGame()
} )

socket.on('namesStacks', (arg) => {
    console.log("Received: namesStacks")
    console.log(arg)

    playerNames = arg[0]
    playerStacks = arg[1]

    playerNames = playerNames.slice(mySeat).concat(playerNames.slice(0,mySeat))
    playerStacks = playerStacks.slice(mySeat).concat(playerStacks.slice(0,mySeat))

    drawGame()
    
} )

socket.on('roundStarted', (arg) => {
    console.log("Received: Round started")
    state = 1;
    if(!mute){
        audio_bridge.play();
    }

    document.getElementById("homeRebuyButton").disabled = true;

    message = "Starting...";
} )

socket.on('resetGame', (arg) => {
    myCards = []
    pot = 0;
    playerBets = []
    revealedCards = []
    playerResults = [0,0,0,0,0,0]
    playerResults = [null,null,null,null,null,null]

    this.showdown = []

    drawGame();
} )

socket.on('showdown', (arg) => {
    console.log("Received: Showdown")
    console.log(arg)

    timeToAct = 0;
    message = ""

    this.showdown = arg;
    this.showdown = showdown.slice(mySeat).concat(showdown.slice(0,mySeat))
    
    drawGame();
} )

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
} )

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
} )

socket.on('waitingForNewGame', (arg) => {
    if(playerStacks[0] < cur_min_buy_in){
        if(myBalance > 0){
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
            if(this.timeToAct > 0){
                this.timeToAct -= 1;
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
    playerToAct = arg[0]
    timeToAct = arg[1]/1000
    startTime = timeToAct;
    state = 1; //In case reconnect

    if(!intervalId){
        intervalId = window.setInterval(function(){
            /// call your function here
            if(this.timeToAct > 0){
                this.timeToAct -= 1;
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

function soundCheckboxClicked(){
    if(mute){
        mute = 0;
    } else {
        console.log("Muted")
        mute = 1;
    }
}

function homeRefreshButton(){
    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms")
}

function homePlayButton(){
    document.getElementById("homeRooms").style.display="block"
    document.getElementById("homeAccount").style.display="none"

    document.getElementById("homePlayButton").disabled = true;
    document.getElementById("homeAccountButton").disabled = false;
}

function homeAccountButton(){
    document.getElementById("homeRooms").style.display="none"
    document.getElementById("homeAccount").style.display="block"

    document.getElementById("homePlayButton").disabled = false;
    document.getElementById("homeAccountButton").disabled = true;;
}

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

function joinRoom(id, buyin) {
    console.log("Emitted: joinRoom ("+id+","+buyin+")")
    socket.emit("joinRoom", [id,buyin])
}

function rebuyRoom(id, buyin) {
    console.log("Emitted: rebuyRoom ("+id+","+buyin+")")
    socket.emit("rebuyRoom", [id,buyin])
}

function homeLeaveRoom() {
    console.log("Emitted: leaveRoom")
    socket.emit("leaveRoom")
    document.getElementById("game").style.display = "none";
    document.getElementById("home").style.display = "block";

    console.log("Emitted: lookingForRooms")
    socket.emit("lookingForRooms");
}

function homeRebuyButton() {
    console.log("Clicked rebuy button")

    var actualMax = Math.min(myBalance, cur_max_buy_in - playerStacks[0])
    rebuyRange.min = cur_min_buy_in - playerStacks[0]
    rebuyRange.max = actualMax
    rebuyRange.value = rebuyRange.max
    rebuyRange.disabled =  false;

    var rebuyNumberField = document.getElementById("rebuyNumberField");

    rebuyNumberField.min = cur_min_buy_in - playerStacks[0]
    rebuyNumberField.max = actualMax
    rebuyNumberField.value = rebuyRange.max

    modalRebuy.style.display = "block";
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

        if(showdown[id]){
            img1 = document.getElementById("img_" + showdown[id][0])
            img2 = document.getElementById("img_" + showdown[id][1])
        }
        else {
            img1 = document.getElementById("img_back")
            img2 = img1
        }

        var cardHeight = height*0.18;
        var cardWidth = cardHeight * 0.65;

        ctx.drawImage(img1,x + border_width/2- cardWidth - width * 0.005, y - height*0.10, cardWidth, cardHeight)
        ctx.drawImage(img2,x + border_width/2 + width * 0.005, y - height*0.10, cardWidth, cardHeight)
    }

    var border_img = document.getElementById("img_player_border")
    ctx.drawImage(border_img, x, y, border_width, border_height)

    ctx.font = "32px Tahoma";
    ctx.fillStyle = "white";
    
    if(playerToAct == playerNames[id]){
        ctx.fillStyle = "#DFE729"
    }

    ctx.font = "40px Tahoma";
    ctx.fillText(playerNames[id].slice(0, -5) , x + 0.01*width, y + 0.04*height);

    var radious = border_height/3;

    if(playerToAct == playerNames[id] & state == 1){
        //drawTimer(x-radious*1.5,y+cardHeight/4,radious);
        drawTimer(x-(radious),y+(border_height/2),radious, 42);
    }


    ctx.fillStyle = "white";
    ctx.font = "60px Tahoma";
    var stackWidth = ctx.measureText(playerStacks[id]).width;

    ctx.fillText(playerStacks[id], x + 0.01*width, y + 0.10*height);

    ctx.font = "65px Tahoma";
    ctx.fillStyle =  "#EE42DA";

    if(state == 1 & playerBets[id]){

        var betWidth = ctx.measureText(playerBets[id]).width;

        ctx.strokeText(playerBets[id], x + border_width - 0.01*width - betWidth, y + 0.10*height);
        ctx.fillText(playerBets[id], x + border_width  - 0.01*width -  betWidth, y + 0.10*height);
    }

    if(state >= 2 & playerResults[id]>0){
        ctx.font = "60px Tahoma";

        ctx.fillStyle = "#339966";

        ctx.strokeText("+"+playerResults[id], x + 0.01*width + stackWidth, y + 0.10*height);
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
        y = 0.16*height - border_height/2
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
        var canvas = document.getElementById("canvas");
        var width = canvas.width;
        var height = canvas.height;

        var ctx = canvas.getContext("2d");
        var img1 = document.getElementById("img_" + myCards[0])
        var img2 = document.getElementById("img_" + myCards[1])

        var cardHeight = height*0.18;
        var cardWidth = cardHeight * 0.65;

        if(!playerAlive[0]){
            ctx.globalAlpha = 0.5
        }

        ctx.drawImage(img1,width * 0.5 - cardWidth - width * 0.005, height * 0.67, cardWidth, cardHeight)
        ctx.drawImage(img2,width * 0.5 + width * 0.005, height * 0.67, cardWidth, cardHeight)

        ctx.globalAlpha = 1
    }
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

        img1 = document.getElementById("img_" + card)
        if(i == 0){
            ctx.drawImage(img1,width * 0.5 - 2.5 * cardWidth - width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 1){
            ctx.drawImage(img1,width * 0.5 - 1.5 * cardWidth - width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 2){
            ctx.drawImage(img1,width * 0.5 - 0.5 * cardWidth - width * 0.01 * 0, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 3){
            ctx.drawImage(img1,width * 0.5 + 0.5 * cardWidth + width * 0.01 * 1, height * 0.42, cardWidth, cardHeight)
        }
        if(i == 4){
            ctx.drawImage(img1,width * 0.5 + 1.5 * cardWidth + width * 0.01 * 2, height * 0.42, cardWidth, cardHeight)
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
        ctx.fillStyle =  "#832e7c";

        var textWidth = ctx.measureText("POT: " + pot).width;
        ctx.fillText("POT: " + pot, width*0.5 - textWidth/2, height * 0.4);
    }

    if(state == 3){
        drawTimer(width*0.5, height*0.3, 110, 80)
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
