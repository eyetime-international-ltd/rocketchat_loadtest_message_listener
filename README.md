# Load tests for Rocket.Chat

This repository implements a load test for [Rocket.Chat](https://github.com/RocketChat).


## Required Software:

- **apg** password generator used for generating random usernames
- **node**
- **python-pip** – `apt-get install python-pip` or `brew install 
python@2`
- **numpy** - pip install numpy (for the outcome parser)

# Instruction

## Generate random users
    ./message_listener/lib/generate-users.sh <usercount>
generates two files, user_insert_script.js for inserting into mongo and userdata.js to have the usernames in the script - every testuser has the PW:test123

## Import Users
Execute newly generated script to import the users on the mongodb shell - 
    
     mongo <serverurl>/<database> user_insert_script.js

    Example mongo 127.0.0.1/meteor ./message_listener/lib/user_insert_script.js)

# Execute the test
Execute the message listener testcase with the following instructions:

## Synopsis

    Usage: apps.js OFFSET [options]
        --help, -h
        --message-interval VAL, -i VAL
        --message-interval-jitter VAL, -j VAL
        --message-count VAL, -n VAL
        --server-url VAL, -s VAL
        --receiver-additional-waiting-time VAL, -w VAL
        --user-count VAL, -u VAL


## Options

    OFFSET:
        User offset (lib/userdata.js), useful when running multiple instances with the same dataset (offset by N).

    --message-interval, -i:
        Interval between messages in seconds. Default: 1

    --message-interval-jitter, -j:
        Random jitter to add/substract from the message interval. Default: 0.5

    --message-count, -n:
        How many messages the sender should send. Default: 10

    --server-url, -s:
        RocketChat server url. Default: https://open.rocket.chat/

    --receiver-additional-waiting-time, -w:
        Time in seconds to wait for messages after the sender has stopped. Default: 1
    
    --user-count, -u:
        How many clients should be started. Must be a multiple of 2 (sender/receiver). Default: 2


## Example

    node message_listener/app.js 0 -i 0.1 -j 0.05 -n 10 -u 100 -w 5

Start 100 clients (50 receiver, 50 sender). The sender posts 10 messages at an interval of 0.1 ± 0.05 seconds. The receiver will wait up to 5 seconds for pending messages.

## Results
The results can be piped to a file an parsed via the parse_outcome.py

    ./parse_outcome.py <filename>