var socket = io();
var canvas = document.getElementById('canvas');

var audio_notify = new Audio('audio/notify.wav');
var audio_deal = new Audio('audio/deal.wav');
var audio_bridge = new Audio('audio/bridge.wav');

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

var buttonRoomMap = new Map()

var playerToAct;

var myCards = []
var showdown = []

var message = ""

var state = 0;

var timeToAct;
var startTime;
var intervalId;
var modalBuyIn;
var span;
var buyInRange;

var myBalance;

modalBuyIn = document.getElementById("modalBuyIn");
span = document.getElementById("close");
buyInRange = document.getElementById("buyInRange");

document.addEventListener("DOMContentLoaded", function(event){
    console.log("DOM LOADED")
});



window.onload = function(){ 
    window.onclick = function(event) {
        if (event.target == modalBuyIn) {
            modalBuyIn.style.display = "none";
        }
    } 
};

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
    modalBuyIn.style.display = "none";
}
  


socket.on("registrationFailed", (arg) => {
  console.log("Registration failed "+ arg); 
  document.getElementById("error_label_register").innerHTML = "Registration failed: "+ arg+"."
  document.getElementById("error_label_register").style.display="block"
});

socket.on("loginFailed", (arg) => {
  console.log("Login failed "+ arg); 
  document.getElementById("error_label_login").innerHTML = "Login failed: "+ arg+"."
  document.getElementById("error_label_login").style.dsisplay="block"
});

socket.on('loginOk', (arg) => {
    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "none";
    document.getElementById("home").style.display = "block";
    document.getElementById("userWrapper").style.display = "block";

    myName = arg[0]
    myBalance = arg[1]

    document.getElementById("home_label_user").innerHTML = arg[0]
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[1]

    socket.emit("lookingForRooms");
});

socket.on('newBalance', (arg) => {
    myBalance = arg;
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg
});

socket.on('roomList', (arg) =>{
    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';

    console.log(arg)
    var alreadyInRoom = arg[0];
    document.getElementById("labelRoomMessage").innerHTML= ""

    if(alreadyInRoom){
        document.getElementById("labelRoomMessage").innerHTML= "  Waiting for round to finish."
    }

    var room_list = arg[1];
    var button;
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

        var placeholder = "Placeholder"
        label_room_1.innerHTML = roomName;
        label_room_2.innerHTML = "Stakes: "+sb+"/"+2*sb+"  Buy-in: "+20*sb*2+"-"+50*sb*2+ " Players: "+numplayers+"/"+numseats
        div_row50_1.append(label_room_1)
        div_row50_2.append(label_room_2)

        div_col80.append(div_row50_1)
        div_col80.append(div_row50_2)
        button_join.innerHTML = "JOIN"
        button_join.room_id = id;
        button_join.minBuyIn = minBuyIn;
        button_join.maxBuyIn = maxBuyIn;

        div_col20.append(button_join)
        div_room.append(div_col80)
        div_room.append(div_col20)


       button_join.addEventListener ("click", function() {
            console.log("Clicked room button")
            console.log(button_join.room_id)

            buyInRange.min = this.minBuyIn;
            var actualMax = Math.min(myBalance, this.maxBuyIn);
            buyInRange.max = actualMax;
            buyInRange.value = actualMax;

            var modalButton = document.getElementById("modalButton");
            modalButton.room_id = this.room_id;

            document.getElementById("buyinTextField").value = actualMax;

            modalBuyIn.style.display = "block";
        });

        if(arg[0]){
            button_join.disabled = true;
            console.log("Waiting for last round to end")
        }

        var containerRooms = document.getElementById("containerRooms");
        containerRooms.append(div_room)
        containerRooms.append(document.createElement("br"))
    }
});

socket.on('listOutdated', (arg) => {
    socket.emit("lookingForRooms")    
})

socket.on('drawnCards', (arg) => {
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
    var rid = arg[0]
    var seat_id = arg[1]
    document.getElementById("home_label_balance").innerHTML = "Balance: " + arg[2]

    room_id = rid

    console.log("JOINED ROOM "+rid+". Seat id:"+seat_id+".")
    mySeat = seat_id;

    document.getElementById("welcome").style.display = "none";
    document.getElementById("registration").style.display = "none";
    document.getElementById("home").style.display = "none";
    document.getElementById("game").style.display = "block";



    console.log("Buttons disabled")

    document.getElementById("raiseRange").disabled = true;
    document.getElementById('homeRaiseButton').disabled = true;
    document.getElementById('homeCallButton').disabled = true;
    document.getElementById('homeFoldButton').disabled = true;

    var myNode = document.getElementById("containerRooms");
    myNode.innerHTML = '';
})

socket.on('waitingForPlayers', (arg) => {
    console.log('Waiting for players...')
    message = "Waiting for players..."

    playerNames = arg[0]
    playerStacks = arg[1]

    console.log(arg)
    playerNames = playerNames.slice(mySeat).concat(playerNames.slice(0,mySeat))
    playerStacks = playerStacks.slice(mySeat).concat(playerStacks.slice(0,mySeat))

    message = "Waiting for players..."

    drawGame()
    
} )

socket.on('roundStarted', (arg) => {
    if(!mute){
        audio_bridge.play();
    }

    console.log("Round started")
    message = "Starting...";
} )

socket.on('resetGame', (arg) => {
    myCards = []
    pot = 0;
    playerBets = []
    revealedCards = []
    this.showdown = []

    drawGame();
} )

socket.on('showdown', (arg) => {
    console.log("showdown")
    console.log(arg)

    timeToAct = 0;
    message = ""

    this.showdown = arg;
    console.log(mySeat)
    this.showdown = showdown.slice(mySeat).concat(showdown.slice(0,mySeat))
    
    console.log(showdown)

    drawGame();
} )

socket.on('gameState', (arg) => {
    console.log("Received game state:")
    console.log(arg)
    pot = arg[0]
    revealedCards = arg[1]
    playerNames = arg[2]
    playerBets = arg[3]
    playerStacks = arg[4]
    playerAlive = arg[5]

    playerNames = playerNames.slice(mySeat).concat(playerNames.slice(0,mySeat))
    playerBets = playerBets.slice(mySeat).concat(playerBets.slice(0,mySeat))
    playerStacks = playerStacks.slice(mySeat).concat(playerStacks.slice(0,mySeat))
    playerAlive = playerAlive.slice(mySeat).concat(playerAlive.slice(0,mySeat))

    drawGame();
} )

socket.on('winner', (arg) =>{
    if(message == "Your turn!"){
        message = "";
    }
    console.log("Winner")
    console.log(arg)
    this.message += arg;
    timeToAct = 0;
});

socket.on('roomJoinFailed', (arg) => {
    console.log("Room join failed: " + arg)
});

socket.on('roomKick', (arg) =>{
    document.getElementById("game").style.display = "none";
    document.getElementById("content").style.display = "block";

    socket.emit("lookingForRooms");
} )

socket.on('waitingForNewGame', (arg) => {
    timeToAct = arg;
    startTime = timeToAct;

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
    console.log("Action required; " + arg)
    playerToAct = arg[0]
    timeToAct = arg[1]/1000
    startTime = timeToAct;

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

    var curBetSize = arg[2]
    if(playerToAct == myName){
        message = "Your turn!"
        if(!mute){
            audio_notify.play();
        }
        console.log("That is you...")

        var max = playerStacks[0]
        var min = curBetSize;
        if(min == 0){
            min = 1;
        }

        document.getElementById('raiseRange').max = max;
        document.getElementById('raiseRange').min = min;
        document.getElementById('raiseRange').value = min;
        document.getElementById('rangeTextField').value = min;

        document.getElementById("raiseRange").disabled = false;

        document.getElementById('homeRaiseButton').disabled = false;
        document.getElementById('homeCallButton').disabled = false;
        document.getElementById('homeFoldButton').disabled = false;

    } else {
        message = "";
    }
    drawGame();
} );

function modalButtonClicked(){

    var modalButton = document.getElementById("modalButton");
    var rangeSlider = document.getElementById("buyInRange");

    if(modalButton.room_id){
        joinRoom(modalButton.room_id,rangeSlider.value)
    }

    modalBuyIn.style.display = "none";
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

    socket.emit("lookingForRooms")
}

function welcomeLoginButton() {
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

    console.log("test OK")

    //SEND STUFF TO SERVER
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
        document.getElementById("error_label_register").innerHTML = "Password must be least 8 symbols long."
        document.getElementById("error_label_register").style.display="block"
        return
    }

    if(password !== repeat_password){
        console.log(repeat_password)

        document.getElementById("error_label_register").innerHTML = "Passwords do not match."
        document.getElementById("error_label_register").style.display="block"
        return
    }

    console.log("test OK")

    //SEND STUFF TO SERVER
    socket.emit('registration',{name,password,api,email});
}

function registrationBackButton() {
    document.getElementById("welcome").style.display = "block";
    document.getElementById("registration").style.display = "none";
}

function joinRoom(id, buyin) {
    socket.emit("joinRoom", [id,buyin])
    //socket.emit("joinRoom", "room1")
    //room_id = "room1"
}

function homeLeaveRoom() {
    socket.emit("leaveRoom")
    document.getElementById("game").style.display = "none";
    document.getElementById("home").style.display = "block";

    socket.emit("lookingForRooms");
}


function homeFoldButton() {
    socket.emit("actionRequest", [room_id,"fold"])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
}

function homeCallButton() {
    socket.emit("actionRequest", [room_id,"checkcall"])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
}

function homeRaiseButton() {
    var val = document.getElementById("raiseRange").value;
    val = parseInt(val)

    console.log("VAL:" + val)
    socket.emit("actionRequest", [room_id,"raise", val])
    document.getElementById("raiseRange").disabled = true;
    document.getElementById("homeCallButton").disabled = true;
    document.getElementById("homeRaiseButton").disabled = true;
    document.getElementById("homeFoldButton").disabled = true;
}

function rangeChange() {
    var val = document.getElementById("raiseRange").value;
    document.getElementById("rangeTextField").value = val;
}

function rangeBuyinChange() {
    var val = document.getElementById("buyInRange").value;
    document.getElementById("buyinTextField").value = val;
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
    ctx.drawImage(img,0 + width*0.10,0 + height * 0.10, width*0.8, height*0.8)
}

function drawProfile(x,y,id){
    var canvas = document.getElementById("canvas");

    var width = canvas.width;
    var height = canvas.height;

    var ctx = canvas.getContext("2d");

    var border_width = width*0.22;
    var border_height = 0.4 * border_width

    var img1,img2
    if(id != 0 && playerAlive[id] && myCards.length==2){

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

    ctx.fillStyle = "white";

    ctx.font = "60px Tahoma";
    ctx.fillText(playerStacks[id], x + 0.01*width, y + 0.10*height);

    ctx.font = "65px Tahoma";
    ctx.fillStyle =  "#EE42DA";

    if(playerBets[id]){
        ctx.strokeText(playerBets[id], x + border_width/2, y + 0.10*height);
        ctx.fillText(playerBets[id], x + border_width/2, y + 0.10*height);
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
        x = 0.25*width - border_width/2
        y = 0.75*height- border_height/2
        drawProfile(x,y,1)

    }

    //P2
    if(playerNames[2]){ 
        x = 0.25*width - border_width/2
        y = 0.25*height - border_height/2
        drawProfile(x,y,2)

    }

    //P3
    if(playerNames[3]){
        x = 0.5*width - border_width/2
        y = 0.15*height - border_height/2
        drawProfile(x,y,3)

    }

    //P4
    if(playerNames[4]){
        x = 0.75*width - border_width/2
        y = 0.25*height - border_height/2
        drawProfile(x,y,4)

    }

    //P5
    if(playerNames[5]){
        x = 0.75*width - border_width/2
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

function drawShowdown(){

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

function drawNumbers(){
    var canvas = document.getElementById("canvas");
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");

    var ctx = canvas.getContext("2d");

    var outerRadius = 100;
    var innerRadius = 70;
    var timer_x = 160;
    var timer_y = 160;

    //Timer
    var percentage = timeToAct/startTime;

    if(timeToAct){
        if(timeToAct > 0){

            // Grey background ring
            
            ctx.beginPath();
            ctx.globalAlpha = 1;
            ctx.arc(timer_x,timer_y,outerRadius,0,6.283,false);
            ctx.arc(timer_x,timer_y,innerRadius,6.283,((Math.PI*2)),true);
            ctx.fillStyle = "#bbb";
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
            

            ctx.font = "Bold 80px Arial";
            ctx.fillStyle =  "black";

            var textWidth = ctx.measureText(""+timeToAct).width;

            //var textHeight = ctx.measureText(""+timeToAct).height;
            console.log(textWidth)
            ctx.fillText(timeToAct, timer_x - textWidth/2 , timer_y + 25 );
        }
    }

    //Pot
    if(pot > 0){
        ctx.font = "Bold 80px Tahoma";
        ctx.fillStyle =  "#832e7c";

        var textWidth = ctx.measureText("POT: " + pot).width;
        ctx.fillText("POT: " + pot, width*0.5 - textWidth/2, height * 0.4);
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
