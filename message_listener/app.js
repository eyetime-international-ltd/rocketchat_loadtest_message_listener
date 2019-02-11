const util = require('util');
const cluster = require('cluster');
const driver = require('@rocket.chat/sdk').driver;
const options = require('options-parser');
const users = require('./lib/userdata.js').USERNAMES;

const CMD_START_SENDER = 'start-sender';
const CMD_START_RECEIVER = 'start-receiver';
const CMD_STOP_SENDER = 'stop-sender';
const CMD_STOP_RECEIVER = 'stop-receiver';
const CMD_EXIT = 'exit';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send messages to user (count, interval between messages & jitter)
 * 
 * TODO: move to separate module
 */
async function runSender(result, serverUrl, username, receiver, msgcnt, msgInterval, msgIntervalJitter, initialDelay) {
    // disable logging to stdout
    driver.useLog({debug: _ => {}, info: _ => {}, warn: _ => {}, error: _ => {}})

    // wait for receivers to connect
    await sleep(initialDelay);

    await driver.connect({
        host: serverUrl,
        useSsl: serverUrl.startsWith('https://')
    });
    await driver.login({
        username: username,
        password: 'test123'
    });

    sendMessage = async(payload, receiver) => {
        const t1 = new Date().getTime();
        const msg = JSON.stringify({type: 'ping', ts: (new Date()).getTime(), msg: payload})

        result.msgTotal += 1;
        await driver.sendDirectToUser(msg, receiver)
        .then(resp => {
            if (resp) {
                result.msgSuccess += 1;
            } else {
                result.msgFail += 1;
            }
        }).catch(err => {
            result.msgFail += 1;
            result.info.push(err);

            process.stderr.write(err + '\n');
        }).then(() => {
            result.msgDurations.push(new Date().getTime() - t1);
        });
    };

    const arr = [];
    for (var i = 0; i < msgcnt; i++) {
        arr.push(i);
    }

    const t1 = new Date().getTime();

    await Promise.all(arr.map(async (i) => {
        // 1000 ± 500
        const interval = i * msgInterval * 1000 + Math.floor((Math.random() - 0.5) * msgIntervalJitter * 1000);

        if (i > 0) {
            await sleep(interval);
        }
        await sendMessage('Message ' + i, receiver)
    }));

    result.durationSec = new Date().getTime() - t1;
}

/**
 * Receiving part, only counts messages from sender.
 * 
 * TODO: move to separate module
 */
async function runReceiver(result, serverUrl, username, sender) {
    // disable logging to stdout
    driver.useLog({debug: _ => {}, info: _ => {}, warn: _ => {}, error: _ => {}})

    await driver.connect({
        host: serverUrl,
        useSsl: serverUrl.startsWith('https://')
    });
    await driver.login({
        username: username,
        password: 'test123'
    });

    const subscription = await driver.subscribeToMessages();
    const handler = await driver.reactToMessages(async(err, message, opts) => {
        if (err) {
            throw err;
        }

        // filter out own message(s)
        if (message.u._id === driver.userId) {
            return
        };
        
        // we received a message from our target
        if (message.u.username === sender) {
            const payload = JSON.parse(message.msg);
            const duration = (new Date()).getTime() - payload.ts;

            result.msgTotal += 1;
            result.msgDurations.push(duration);
        }
    });
}


(function main() {
    const result = options.parse({
        'help': {
            short: 'h',
            flag: true,
            showHelp: {
                banner: 'Usage: apps.js OFFSET [options]'
            }
        },
        'message-interval': {
            short: 'i', default: '1.0'
        },
        'message-interval-jitter': {
            short: 'j', default: '0.5'
        },
        'message-count': {
            short: 'n', default: '10', type: options.type.int()
        },
        'server-url': {
            short: 's', default: 'http://open.rocket.chat/'
        },
        'receiver-additional-waiting-time': {
            short: 'w', default: '1', type: options.type.int()
        },
        'user-count': {
            short: 'u', default: '2', type: options.type.int()
        }
    })

    opts = result.opt;
    args = result.args;

    if (args.length != 1) {
        process.stdout.write(util.format('Usage: %s OFFSET [options]\n', process.argv[1]))
        process.exit(2);
    }

    // force odd to even number, limit to at least 2 users
    var userCount = parseInt(opts['user-count']);
    if (userCount % 2 != 0) {
        userCount = Math.max(userCount - 1, 2);
    }

    // user data offset
    const offset = parseInt(args[0]);
    const initialDelay = userCount * 50;

    // driver cannot handle trailing slash
    var serverUrl = opts['server-url'];
    if (serverUrl.endsWith('/')) {
        serverUrl = serverUrl.substring(0, serverUrl.length - 1);
    }

    const configuration = {
        serverUrl: serverUrl,
        msgInterval: parseFloat(opts['message-interval']),
        msgIntervalJitter: parseFloat(opts['message-interval-jitter']),
        msgcnt: parseInt(opts['message-count']),
        waitingTime: parseInt(opts['receiver-additional-waiting-time']) * 1000
    }

    if (cluster.isMaster) {
        process.stderr.write('[+] Running sender/receiver\n');

        const senderJobs = [];
        const receiverJobs = [];

        for (var i = 0; i < userCount; i += 2) {
            configuration.sender = users[offset + i];
            configuration.receiver = users[offset + i + 1];

            const receiver = cluster.fork();
            receiver.send({cmd: CMD_START_RECEIVER, cfg: configuration})

            const sender = cluster.fork();
            sender.send({cmd: CMD_START_SENDER, cfg: configuration})

            receiverJobs.push(receiver);
            senderJobs.push(sender);
        }

        // active sender, when 0 -> stop script
        var senderCount = senderJobs.length;

        for (const id in cluster.workers) {
            const worker = cluster.workers[id];
            worker.on('message', msg => {
                if (msg.cmd === CMD_EXIT) {
                    // stop receiver when all sender have finished
                    senderCount--;
                    if (senderCount > 0) {
                        return;
                    }

                    // print stats of sender
                    senderJobs.forEach(job => {
                        job.send({cmd: CMD_STOP_SENDER})
                    })

                    // wait a bit for receiver
                    sleep(configuration.waitingTime)
                    .then(() => {
                        receiverJobs.forEach(job => {
                            job.send({cmd: CMD_STOP_RECEIVER})
                        })
                    })
                    
                    // wait for logging & exit
                    sleep(configuration.waitingTime + 100).then(() => {
                        process.stderr.write('[+] Shutting down\n');
                        process.exit(0);
                    });
                }
            })
        }
    } else if (cluster.isWorker) {
        const senderResult = {
            type: 'sender',
            msgTotal: 0,
            msgSuccess: 0,
            msgFail: 0,
            durationSec: 0,
            info: [],
            msgDurations: []
        };

        const receiverResult = {
            type: 'receiver',
            msgTotal: 0,
            msgDurations: []
        }

        process.on('message', msg => {
            if (msg.cmd === CMD_START_SENDER) {
                process.stderr.write(util.format('[+] %s sending %s private messages to %s\n', msg.cfg.sender, msg.cfg.msgcnt, msg.cfg.receiver));
                runSender(senderResult, msg.cfg.serverUrl, msg.cfg.sender, msg.cfg.receiver, msg.cfg.msgcnt, msg.cfg.msgInterval, msg.cfg.msgIntervalJitter, initialDelay)
                .then(() => {
                    // request shutdown
                    process.send({cmd: CMD_EXIT})
                })
                .catch(err => {
                    process.stderr.write(err + '\n');
                });
            } else if (msg.cmd === CMD_STOP_SENDER) {
                process.stderr.write(util.format('[+] Successfully sent %s messages\n', senderResult.msgSuccess))
                process.stdout.write(JSON.stringify(senderResult) + '\n');
            } else if (msg.cmd === CMD_STOP_RECEIVER) {
                process.stderr.write(util.format('[+] Received %s messages\n', receiverResult.msgTotal))
                process.stdout.write(JSON.stringify(receiverResult) + '\n');
            } else if (msg.cmd === CMD_START_RECEIVER) {
                process.stderr.write(util.format('[+] %s receives messages from %s\n', msg.cfg.receiver, msg.cfg.sender));
                runReceiver(receiverResult, msg.cfg.serverUrl, msg.cfg.receiver, msg.cfg.sender)
                .catch(err => {
                    process.stderr.write(err + '\n');
                });
            }
        });
    }
})();
