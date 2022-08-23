const consts = require("./consts");
const net = require("net");
const dgram = require("dgram");

// Variables
const server = net.createServer();
const discoverDeliveryServer = dgram.createSocket('udp6')

var friendsRoom = {}

// Use this map for a gurantee disconnect. In case a pass change not sent
// We can still delete it
var friendPassLookup = {}

function handleUserRequest(socket, data) {
    if (data.length >= 2) {
        var sockAddr = socket.remoteAddress
        const lookupStr = sockAddr;

        if (String.fromCharCode(data[0]) == 'l') {
            if (String.fromCharCode(data[1]) == '0') {
                const passLen = data[2]
                const pass = (passLen <= 0) ? '' : data.toString().substring(3, 3 + passLen).trim()

                if (!friendsRoom[pass]) {
                    friendsRoom[pass] = [ sockAddr ]
                } else {
                    if (friendsRoom[pass].indexOf(sockAddr) == -1)
                        friendsRoom[pass].push(sockAddr)
                }

                friendPassLookup[lookupStr] = pass;
            } else {
                // Logout, don't care what it is
                let pass = friendPassLookup[lookupStr]
                if (!pass) {
                    return;
                }

                friendsRoom[pass] = friendsRoom[pass].filter(addr => addr != sockAddr)
            }
        } else if ((String.fromCharCode(data[0]) == 'c') && (String.fromCharCode(data[1]) == 'r')) {
            let pass = friendPassLookup[lookupStr]
            if (!pass) {
                return;
            }

            if (friendsRoom[pass]) {
                friendsRoom[pass].forEach(addr => {
                    if (addr == sockAddr) {
                        return;
                    }

                    const buffer = Buffer.alloc(4 + sockAddr.length)
                    buffer[0] = 'c'.charCodeAt(0)
                    buffer[1] = 'r'.charCodeAt(0)
                    buffer[2] = ((socket.remoteFamily == 'ipv4') ? '0' : '1').charCodeAt(0)
                    buffer[3] = sockAddr.length

                    for (let i = 0; i < sockAddr.length; i++) {
                        buffer[4 + i] = sockAddr.charCodeAt(i)
                    }

                    // Don't care error (maybe we should)
                    discoverDeliveryServer.send(buffer, consts.USER_HARBOUR_PORT, addr)
                })
            }
        }
    }
}

function setupServerSocket() {
    server.listen(consts.STANDARD_SERVER_PORT, () => {
        console.log('Central server is listening on port %d', consts.STANDARD_SERVER_PORT)
    })
    
    server.on('connection', socket => {
        socket.on('data', data => handleUserRequest(socket, data))
        socket.on('end', () => handleUserRequest(socket, Buffer.from("l1")))
        socket.on('error', err => {
            console.log('Socket encountered error %d, disconnecting...', err)
            handleUserRequest(socket, Buffer.from("l1"))
        });
    })
}

setupServerSocket()