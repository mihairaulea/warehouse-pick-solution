const WebSocket = require('ws');

// 1. Connect display microcontroller with id 14
// 2. Connect display microcontroller with id 24 
// 3. Connect pistol with id 1

// 4. 

// a. send awb 1112 from pistol -- should receive data for both microcontrollers - id 14 should display 100 and id 24 should display 200
// b. push complete button on one of the controllers. if it has state variables, send to server the state. the data received should be 'LAST_PRODUCTS'. erase state on the controller.
// c. push complete button on the 2nd controller. if it has state variables, send to server the state. the data received should be 'OK'. displays 9999 and blinks the led light for 5 seconds
//    ALWAYS ERASE STATE ON THE DEVICE AFTER A COMPLETE BUTTON PUSH. 

// 6. send awb 1113 from pistol -- should receive data for one microcontroller. id 14 should display 2. id 24 should not display anything. on push button, it should say complete.
// 7. send awb 0 from pistol -- should receive no data. should be able to send any awb after this.

// TEST SCENARIOS 4, 6, 7 in different orders to confirm no state dependency.
// TEST scenario 4 with different orders for a,b,c. 
//  for example, sequence b,c should have no effect on the system. 
//  going through a complete a, b, c sequence should always work, regardless of previous commands

// EVICT CONNECTIONS ON DISCONNECT
// when sending a message to a non-existant id, log it and send sms?
const pistolWss = new WebSocket.Server({ port: 8080 })
let pistolConnections = {};

let receivedIds = {};

pistolWss.on('connection', ws => {
  ws.on('message', async message => {
    message = JSON.parse(message);
    if(message.command == 'SETUP') {
      pistolConnections[message.id] = ws;
    }
    if(message.command == 'AWB' && message.awb != '0') { 
      console.log('Received from pistol with id ' + message.id + ' awb scan ' + message.awb);
      let result = null;
      if(parseInt(message.awb)%2==0)
        result = getMultipleProducts(message.awb);
      else
        result = getSingleProduct(message.awb);

      for(let i=0; i<result.products.length;i++) {
        receivedIds[result.products[i]] = 'yes';
        var objectToSend = {awb: message.awb, productId: result.products[i], quantity:result.quantities[i], command: 'SCAN'};
        sendToMicrocontroller(result.products[i], objectToSend);
      }
    }
  })
  ws.on('close', function close() {
    closeWsConnection(ws, pistolConnections, 'pistol');
  });

  ws.on('error', function close() {
    closeWsConnection(ws, pistolConnections, 'pistol');
  });
  ws.send('pong');
})

const microcontrollerWss = new WebSocket.Server({ port: 8081 });
let microcontrollerConnections = {};

microcontrollerWss.on('connection', ws => {
  ws.on('message', async message => {
    message = JSON.parse(message);
    if(message.command == 'SETUP') {
      console.log('setting up the microcontroller '+ message.id);
      microcontrollerConnections[message.id] = ws;
    }
    if(message.command == 'COMPLETE_BUTTON') {
      console.log('received complete button signal from '+ microcontrollerConnections[message.productId]);
      // i expect to receive:
      // message.id, message.awb, message.productId, message.quantity;
      receivedIds[message.productId] = 'no';
      var objectToSend = {command: 'COMPLETE_BUTTON_ANSWER', status: getStatus()};
      sendToMicrocontroller(message.productId, objectToSend);
    }
  })
  ws.on('close', function close() {
    closeWsConnection(ws, microcontrollerConnections, 'microcontroller');
  });

  ws.on('error', function close() {
    closeWsConnection(ws, microcontrollerConnections, 'microcontroller');
  });
  ws.send('pong');
})
  
  async function sendToMicrocontroller(productId, objectToSend) {
    var socket = microcontrollerConnections[ productId ];
    if(socket!=null) socket.send(JSON.stringify(objectToSend));
      else console.log('found a product that does not have an attached microcontroller')
  }

  function getMultipleProducts(awb) {
    let result = {};
    result.awb = awb;
    result.products = [0, 3];
    result.quantities = [100, 200];
    return result;
  }

  function getSingleProduct(awb) {
    let result = {};
    result.awb = awb;
    result.products = [14];
    result.quantities = [2];
    return result;
  }

  function getStatus() {
    for (const property in receivedIds) {
        if(receivedIds[property] == 'yes') return 'OK';
    }      

    receivedIds = {};
    return 'LAST_PRODUCTS';
  }

  function closeWsConnection(ws, connectionsRepository, debugText='default') {
    console.log('Before the function '+ iterateThroughObject(connectionsRepository));
    for (const wsConnectionId in connectionsRepository)
      if(ws === connectionsRepository[wsConnectionId]) {
        connectionsRepository[wsConnectionId] = null;
        console.log('Disconnected connection ' + wsConnectionId+ ' '+ debugText);
      }
    console.log('After the function '+ iterateThroughObject(connectionsRepository));
  }

  function iterateThroughObject(objectToIterate) {
    for (const property in objectToIterate) {
      console.log(property+':'+objectToIterate[property]);
    }
  }

  console.log("MOCK FULLY OPERATIONAL");